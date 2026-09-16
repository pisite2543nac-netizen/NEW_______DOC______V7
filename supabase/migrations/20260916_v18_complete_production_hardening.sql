-- DOC-FULL-NR V18 COMPLETE PRODUCTION HARDENING
-- 2026-09-16
-- Additive hardening for immutable evidence, multi-page paper packets,
-- grade revision history, exam-safe payloads, join-code throttling,
-- capacity/integrity monitoring, and V18 RPC contracts.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Immutable submission evidence metadata
-- ---------------------------------------------------------------------------
alter table public.submission_files add column if not exists sha256 text;
alter table public.submission_files add column if not exists immutable_at timestamptz;
alter table public.submission_files add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='submission_files_sha256_format_v18') then
    alter table public.submission_files add constraint submission_files_sha256_format_v18
      check(sha256 is null or sha256 ~ '^[0-9a-f]{64}$');
  end if;
end $$;

-- Student-owned evidence can be read by its owner, but once uploaded cannot be
-- updated/deleted by that owner. Admin may manage evidence for incident recovery.
drop policy if exists nangrong_submissions_owner_all on storage.objects;
drop policy if exists nangrong_submissions_owner_read_v18 on storage.objects;
drop policy if exists nangrong_submissions_owner_insert_v18 on storage.objects;
drop policy if exists nangrong_submissions_admin_update_v18 on storage.objects;
drop policy if exists nangrong_submissions_admin_delete_v18 on storage.objects;

create policy nangrong_submissions_owner_read_v18 on storage.objects
for select to authenticated
using(
  bucket_id='submissions' and
  (((storage.foldername(name))[1]=auth.uid()::text) or private.is_admin())
);

create policy nangrong_submissions_owner_insert_v18 on storage.objects
for insert to authenticated
with check(
  bucket_id='submissions' and (
    private.is_admin()
    or (
      (storage.foldername(name))[1]=auth.uid()::text
      and exists(
        select 1
        from public.worksheets w
        join public.worksheet_assignments a on a.worksheet_id=w.id and a.user_id=auth.uid()
        left join public.submissions s on s.worksheet_id=w.id and s.user_id=auth.uid()
        where w.id::text=(storage.foldername(name))[2]
          and w.mode='digital'
          and w.status='published'
          and (w.open_at is null or clock_timestamp()>=w.open_at)
          and (w.due_at is null or clock_timestamp()<=w.due_at)
          and coalesce(s.status::text,'draft')='draft'
      )
    )
  )
);

create policy nangrong_submissions_admin_update_v18 on storage.objects
for update to authenticated
using(bucket_id='submissions' and private.is_admin())
with check(bucket_id='submissions' and private.is_admin());

create policy nangrong_submissions_admin_delete_v18 on storage.objects
for delete to authenticated
using(bucket_id='submissions' and private.is_admin());

-- Official profile photos: student owner can read; writes are Admin/service only.
drop policy if exists nangrong_avatars_insert on storage.objects;
drop policy if exists nangrong_avatars_update on storage.objects;
drop policy if exists nangrong_avatars_delete on storage.objects;
drop policy if exists nangrong_avatars_admin_write_v18 on storage.objects;
create policy nangrong_avatars_admin_write_v18 on storage.objects
for all to authenticated
using(bucket_id='avatars' and private.is_admin())
with check(bucket_id='avatars' and private.is_admin());

-- ---------------------------------------------------------------------------
-- 2) Append-only grade revision history
-- ---------------------------------------------------------------------------
create table if not exists public.submission_grade_history(
  id bigserial primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text,
  old_value jsonb,
  new_value jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists submission_grade_history_submission_idx on public.submission_grade_history(submission_id,created_at desc);
alter table public.submission_grade_history enable row level security;
drop policy if exists submission_grade_history_admin_read_v18 on public.submission_grade_history;
create policy submission_grade_history_admin_read_v18 on public.submission_grade_history for select to authenticated using(private.is_admin());

create table if not exists public.exam_grade_history(
  id bigserial primary key,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text,
  old_value jsonb,
  new_value jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists exam_grade_history_attempt_idx on public.exam_grade_history(attempt_id,created_at desc);
alter table public.exam_grade_history enable row level security;
drop policy if exists exam_grade_history_admin_read_v18 on public.exam_grade_history;
create policy exam_grade_history_admin_read_v18 on public.exam_grade_history for select to authenticated using(private.is_admin());

create or replace function private.capture_submission_grade_history_v18() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_reason text:=nullif(current_setting('docnr.grade_reason',true),'');
begin
  if tg_op='INSERT' or old.score is distinct from new.score or old.max_score is distinct from new.max_score or old.grade is distinct from new.grade or old.grading_status is distinct from new.grading_status or old.admin_comment is distinct from new.admin_comment then
    insert into public.submission_grade_history(submission_id,actor_id,reason,old_value,new_value)
    values(new.submission_id,auth.uid(),coalesce(v_reason,case when tg_op='INSERT' then 'initial_grade' else 'grade_revision' end),case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
  end if;
  return new;
end $$;

drop trigger if exists trg_submission_grade_history_v18 on public.submission_grades;
create trigger trg_submission_grade_history_v18 after insert or update on public.submission_grades
for each row execute function private.capture_submission_grade_history_v18();

create or replace function private.capture_exam_grade_history_v18() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_reason text:=nullif(current_setting('docnr.grade_reason',true),'');
begin
  if old.score is distinct from new.score or old.max_score is distinct from new.max_score or old.grading_status is distinct from new.grading_status or old.admin_comment is distinct from new.admin_comment then
    insert into public.exam_grade_history(attempt_id,actor_id,reason,old_value,new_value)
    values(new.id,auth.uid(),coalesce(v_reason,'exam_grade_revision'),to_jsonb(old),to_jsonb(new));
  end if;
  return new;
end $$;

drop trigger if exists trg_exam_grade_history_v18 on public.exam_attempts;
create trigger trg_exam_grade_history_v18 after update of score,max_score,grading_status,admin_comment on public.exam_attempts
for each row execute function private.capture_exam_grade_history_v18();

-- ---------------------------------------------------------------------------
-- 3) Multi-page Paper evidence packets
-- ---------------------------------------------------------------------------
create table if not exists public.paper_scan_packets(
  id uuid primary key default gen_random_uuid(),
  paper_token_id uuid not null unique references public.paper_tokens(id) on delete cascade,
  worksheet_id uuid not null references public.worksheets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expected_pages integer not null,
  status text not null default 'collecting' check(status in ('collecting','complete','rejected')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  finalized_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint paper_scan_packets_pages_v18 check(expected_pages between 2 and 50)
);
create index if not exists paper_scan_packets_user_idx on public.paper_scan_packets(user_id,created_at desc);
alter table public.paper_scan_packets enable row level security;
drop policy if exists paper_scan_packets_admin_all_v18 on public.paper_scan_packets;
create policy paper_scan_packets_admin_all_v18 on public.paper_scan_packets for all to authenticated using(private.is_admin()) with check(private.is_admin());

create table if not exists public.paper_scan_pages(
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.paper_scan_packets(id) on delete cascade,
  page_no integer not null,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  captured_by uuid references public.profiles(id) on delete set null,
  captured_at timestamptz not null default clock_timestamp(),
  metadata jsonb not null default '{}'::jsonb,
  unique(packet_id,page_no),
  unique(storage_path),
  constraint paper_scan_pages_page_no_v18 check(page_no between 1 and 50),
  constraint paper_scan_pages_sha256_v18 check(sha256 is null or sha256 ~ '^[0-9a-f]{64}$')
);
alter table public.paper_scan_pages enable row level security;
drop policy if exists paper_scan_pages_admin_all_v18 on public.paper_scan_pages;
create policy paper_scan_pages_admin_all_v18 on public.paper_scan_pages for all to authenticated using(private.is_admin()) with check(private.is_admin());

create or replace function public.admin_record_paper_scan_page_v18(
  p_token text,p_page_no integer,p_storage_path text,p_original_name text,
  p_mime_type text default 'image/jpeg',p_size_bytes bigint default null,p_sha256 text default null,
  p_accept_expired boolean default false,p_metadata jsonb default '{}'::jsonb,p_request_key uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_uid uuid:=auth.uid();t public.paper_tokens%rowtype;w public.worksheets%rowtype;d public.worksheets%rowtype;
  v_now timestamptz:=clock_timestamp();v_expired boolean:=false;v_expected int;v_packet public.paper_scan_packets%rowtype;
  v_page public.paper_scan_pages%rowtype;v_pair text;v_old jsonb;v_key text;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_request_key is null then raise exception 'REQUEST_KEY_REQUIRED'; end if;
  if nullif(trim(coalesce(p_storage_path,'')),'') is null then raise exception 'STORAGE_PATH_REQUIRED'; end if;
  if lower(coalesce(p_mime_type,'image/jpeg')) not in ('image/jpeg','image/png','image/webp') then raise exception 'PAPER_SCAN_IMAGE_REQUIRED'; end if;
  if coalesce(p_size_bytes,0)>26214400 then raise exception 'PAPER_SCAN_TOO_LARGE'; end if;
  if p_sha256 is not null and p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_SHA256'; end if;
  select * into t from public.paper_tokens where token=trim(p_token) for update;
  if t.id is null then raise exception 'INVALID_PAPER_TOKEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended('paper-packet:'||t.id::text,0));
  if t.revoked_at is not null then raise exception 'PAPER_TOKEN_REVOKED'; end if;
  if split_part(p_storage_path,'/',1)<>t.user_id::text then raise exception 'INVALID_PAPER_SCAN_PATH'; end if;
  select * into w from public.worksheets where id=t.worksheet_id;
  if w.id is null or w.mode<>'paper' then raise exception 'PAPER_WORKSHEET_REQUIRED'; end if;
  if not exists(select 1 from public.worksheet_assignments where worksheet_id=w.id and user_id=t.user_id) then raise exception 'NOT_ASSIGNED'; end if;
  if not exists(select 1 from public.subject_enrollments where subject_id=w.subject_id and user_id=t.user_id and status='approved') then raise exception 'STUDENT_NOT_APPROVED_FOR_SUBJECT'; end if;
  v_pair:=nullif(w.settings->>'work_pair_key','');
  select * into d from public.worksheets x where x.subject_id=w.subject_id and x.mode='digital' and nullif(x.settings->>'work_pair_key','')=v_pair order by x.created_at limit 1;
  if d.id is null then raise exception 'DIGITAL_PAIR_NOT_FOUND'; end if;
  if d.due_at is null or v_now<=d.due_at then raise exception 'DIGITAL_WINDOW_STILL_OPEN'; end if;
  if exists(select 1 from public.submissions s where s.worksheet_id=d.id and s.user_id=t.user_id and s.status in ('submitted','confirmed','graded')) then raise exception 'DIGITAL_ALREADY_SUBMITTED'; end if;
  v_expired:=t.expires_at is not null and v_now>t.expires_at;
  if v_expired and not p_accept_expired then raise exception 'PAPER_TOKEN_EXPIRED'; end if;
  v_expected:=greatest(2,least(50,coalesce(nullif(w.settings->>'page_count','')::integer,2)));
  if p_page_no<1 or p_page_no>v_expected then raise exception 'INVALID_PAPER_PAGE'; end if;
  v_key:=t.id::text||':'||p_page_no::text;
  select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='paper_page_v18' and entity_key=v_key and request_key=p_request_key;
  if v_old is not null then return v_old||jsonb_build_object('idempotent_replay',true); end if;
  insert into public.paper_scan_packets(paper_token_id,worksheet_id,user_id,expected_pages,created_by,metadata)
  values(t.id,w.id,t.user_id,v_expected,v_uid,jsonb_build_object('reference_code',w.reference_code,'digital_due_at',d.due_at,'token_expires_at',t.expires_at))
  on conflict(paper_token_id) do update set expected_pages=excluded.expected_pages
  returning * into v_packet;
  if v_packet.status='complete' then raise exception 'PAPER_PACKET_ALREADY_COMPLETE'; end if;
  insert into public.paper_scan_pages(packet_id,page_no,storage_path,original_name,mime_type,size_bytes,sha256,captured_by,metadata)
  values(v_packet.id,p_page_no,p_storage_path,coalesce(nullif(trim(coalesce(p_original_name,'')),''),format('page-%s.jpg',p_page_no)),p_mime_type,p_size_bytes,lower(p_sha256),v_uid,
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('page_no',p_page_no,'expected_pages',v_expected,'full_sheet',true,'verified_server_at',v_now))
  on conflict(packet_id,page_no) do update set storage_path=excluded.storage_path,original_name=excluded.original_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,sha256=excluded.sha256,captured_by=excluded.captured_by,captured_at=clock_timestamp(),metadata=excluded.metadata
  returning * into v_page;
  update public.paper_tokens set last_verified_at=v_now where id=t.id;
  v_old:=jsonb_build_object('ok',true,'packet_id',v_packet.id,'page_id',v_page.id,'page_no',p_page_no,'expected_pages',v_expected,
    'captured_pages',(select count(*) from public.paper_scan_pages where packet_id=v_packet.id),'expired',v_expired,'complete',false,'server_time',v_now);
  insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'paper_page_v18',v_key,p_request_key,v_old) on conflict do nothing;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'CAPTURE_PAPER_PAGE_V18','paper_scan_packet',v_packet.id::text,jsonb_build_object('page_no',p_page_no,'expected_pages',v_expected,'storage_path',p_storage_path,'sha256',p_sha256));
  return v_old||jsonb_build_object('request_key',p_request_key,'idempotent_replay',false);
end $$;

create or replace function public.admin_finalize_paper_scan_packet_v18(p_packet_id uuid,p_request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_uid uuid:=auth.uid();v_packet public.paper_scan_packets%rowtype;t public.paper_tokens%rowtype;w public.worksheets%rowtype;d public.worksheets%rowtype;
  sub public.submissions%rowtype;v_now timestamptz:=clock_timestamp();v_count int;v_missing int;v_old jsonb;v_result jsonb;v_page record;v_status text;v_expired boolean;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_request_key is null then raise exception 'REQUEST_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('paper-packet-final:'||p_packet_id::text,0));
  select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='paper_packet_finalize_v18' and entity_key=p_packet_id::text and request_key=p_request_key;
  if v_old is not null then return v_old||jsonb_build_object('idempotent_replay',true); end if;
  select * into v_packet from public.paper_scan_packets where id=p_packet_id for update;
  if v_packet.id is null then raise exception 'PAPER_PACKET_NOT_FOUND'; end if;
  if v_packet.status='complete' then
    select * into sub from public.submissions where worksheet_id=v_packet.worksheet_id and user_id=v_packet.user_id;
    v_result:=jsonb_build_object('ok',true,'packet_id',v_packet.id,'submission_id',sub.id,'status',sub.status,'already_complete',true,'expected_pages',v_packet.expected_pages);
    insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'paper_packet_finalize_v18',p_packet_id::text,p_request_key,v_result) on conflict do nothing;
    return v_result||jsonb_build_object('idempotent_replay',false);
  end if;
  select count(*) into v_count from public.paper_scan_pages where packet_id=v_packet.id;
  select count(*) into v_missing from generate_series(1,v_packet.expected_pages) g where not exists(select 1 from public.paper_scan_pages p where p.packet_id=v_packet.id and p.page_no=g);
  if v_count<>v_packet.expected_pages or v_missing<>0 then raise exception 'PAPER_PACKET_INCOMPLETE'; end if;
  select * into t from public.paper_tokens where id=v_packet.paper_token_id for update;
  select * into w from public.worksheets where id=v_packet.worksheet_id;
  select * into d from public.worksheets x where x.subject_id=w.subject_id and x.mode='digital' and nullif(x.settings->>'work_pair_key','')=nullif(w.settings->>'work_pair_key','') order by x.created_at limit 1;
  if d.id is null then raise exception 'DIGITAL_PAIR_NOT_FOUND'; end if;
  if d.due_at is null or v_now<=d.due_at then raise exception 'DIGITAL_WINDOW_STILL_OPEN'; end if;
  if exists(select 1 from public.submissions s where s.worksheet_id=d.id and s.user_id=v_packet.user_id and s.status in ('submitted','confirmed','graded')) then raise exception 'DIGITAL_ALREADY_SUBMITTED'; end if;
  select * into sub from public.submissions where worksheet_id=w.id and user_id=v_packet.user_id for update;
  if sub.id is null then
    insert into public.submissions(worksheet_id,user_id,status,paper_token_id,confirmed_at,attempt_count,is_late,updated_at)
    values(w.id,v_packet.user_id,'confirmed',t.id,v_now,1,true,v_now) returning * into sub;
  elsif sub.status='draft' then
    update public.submissions set status='confirmed',paper_token_id=t.id,confirmed_at=v_now,attempt_count=greatest(attempt_count,0)+1,is_late=true,updated_at=v_now where id=sub.id returning * into sub;
  elsif sub.status not in ('confirmed','graded') then raise exception 'INVALID_PAPER_SUBMISSION_STATE'; end if;
  v_expired:=t.expires_at is not null and v_now>t.expires_at;
  v_status:=case when v_expired then 'expired_accepted' else 'accepted' end;
  for v_page in select * from public.paper_scan_pages where packet_id=v_packet.id order by page_no loop
    insert into public.submission_files(submission_id,user_id,storage_path,original_name,mime_type,size_bytes,sha256,immutable_at,metadata)
    values(sub.id,v_packet.user_id,v_page.storage_path,v_page.original_name,v_page.mime_type,v_page.size_bytes,v_page.sha256,v_now,
      jsonb_build_object('paper_packet_id',v_packet.id,'page_no',v_page.page_no,'expected_pages',v_packet.expected_pages,'immutable',true))
    on conflict(submission_id,storage_path) do update set sha256=excluded.sha256,immutable_at=coalesce(public.submission_files.immutable_at,excluded.immutable_at),metadata=excluded.metadata;
    insert into public.paper_scans(worksheet_id,user_id,submission_id,paper_token_id,storage_path,original_name,mime_type,size_bytes,barcode_value,barcode_format,scan_status,scanned_by,metadata)
    values(w.id,v_packet.user_id,sub.id,t.id,v_page.storage_path,v_page.original_name,v_page.mime_type,v_page.size_bytes,coalesce(t.barcode_payload,t.token),coalesce(t.code_kind,'code_128'),v_status,v_uid,
      v_page.metadata||jsonb_build_object('packet_id',v_packet.id,'page_no',v_page.page_no,'expected_pages',v_packet.expected_pages,'packet_complete',true,'credit_factor',0.50,'sha256',v_page.sha256))
    on conflict(paper_token_id,storage_path) do nothing;
  end loop;
  update public.paper_tokens set used_at=coalesce(used_at,v_now),last_verified_at=v_now where id=t.id;
  update public.paper_scan_packets set status='complete',finalized_at=v_now,metadata=metadata||jsonb_build_object('submission_id',sub.id,'credit_factor',0.50) where id=v_packet.id;
  insert into public.app_notifications(user_id,type,title,message,metadata) values(v_packet.user_id,'paper_received','รับงานย้อนหลังครบทุกหน้าแล้ว',format('ระบบบันทึกรับงาน %s ครบ %s หน้าแล้ว',w.title,v_packet.expected_pages),jsonb_build_object('worksheet_id',w.id,'submission_id',sub.id,'packet_id',v_packet.id));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'FINALIZE_PAPER_PACKET_V18','paper_scan_packet',v_packet.id::text,jsonb_build_object('submission_id',sub.id,'expected_pages',v_packet.expected_pages,'credit_factor',0.50));
  v_result:=jsonb_build_object('ok',true,'packet_id',v_packet.id,'submission_id',sub.id,'status',sub.status,'expected_pages',v_packet.expected_pages,'credit_factor',0.50,'server_time',v_now);
  insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'paper_packet_finalize_v18',p_packet_id::text,p_request_key,v_result) on conflict do nothing;
  return v_result||jsonb_build_object('request_key',p_request_key,'idempotent_replay',false);
end $$;

-- ---------------------------------------------------------------------------
-- 4) Grade RPCs with revision reason
-- ---------------------------------------------------------------------------
create or replace function public.admin_grade_submission_v18(
 p_submission_id uuid,p_score numeric,p_max_score numeric default null,p_grade text default null,
 p_admin_comment text default null,p_rubric_result jsonb default '{}'::jsonb,p_reason text default 'ตรวจงาน',p_request_key uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_old jsonb;v_result jsonb;v_key text:=p_submission_id::text;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'GRADE_REASON_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('grade-v18:'||v_key,0));
  select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='grade_submission_v18' and entity_key=v_key and request_key=p_request_key;
  if v_old is not null then return v_old||jsonb_build_object('idempotent_replay',true); end if;
  perform set_config('docnr.grade_reason',left(trim(p_reason),500),true);
  v_result:=public.admin_grade_submission_v177(p_submission_id,p_score,p_max_score,p_grade,p_admin_comment,coalesce(p_rubric_result,'{}'::jsonb));
  v_result:=v_result||jsonb_build_object('reason',trim(p_reason));
  insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'grade_submission_v18',v_key,p_request_key,v_result);
  return v_result||jsonb_build_object('request_key',p_request_key,'idempotent_replay',false);
end $$;

create or replace function public.admin_grade_exam_attempt_v18(
 p_attempt_id uuid,p_score numeric,p_comment text default null,p_reason text default 'ตรวจข้อสอบ',p_request_key uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_old jsonb;v_result jsonb;v_key text:=p_attempt_id::text;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'GRADE_REASON_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('grade-exam-v18:'||v_key,0));
  select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='grade_exam_v18' and entity_key=v_key and request_key=p_request_key;
  if v_old is not null then return v_old||jsonb_build_object('idempotent_replay',true); end if;
  perform set_config('docnr.grade_reason',left(trim(p_reason),500),true);
  v_result:=public.admin_grade_exam_attempt(p_attempt_id,p_score,p_comment);
  insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'grade_exam_v18',v_key,p_request_key,v_result);
  return v_result||jsonb_build_object('reason',trim(p_reason),'request_key',p_request_key,'idempotent_replay',false);
end $$;

-- ---------------------------------------------------------------------------
-- 5) Exam safety + adapted 50Q/75m/20pt bank contract
-- ---------------------------------------------------------------------------
create or replace function private.assert_exam_questions_safe_v18(p_questions jsonb) returns void
language plpgsql immutable set search_path=pg_catalog as $$
declare q jsonb;k text;
begin
  if jsonb_typeof(coalesce(p_questions,'[]'::jsonb))<>'array' then raise exception 'EXAM_QUESTIONS_MUST_BE_ARRAY'; end if;
  for q in select value from jsonb_array_elements(coalesce(p_questions,'[]'::jsonb)) loop
    if jsonb_typeof(q)<>'object' then raise exception 'INVALID_EXAM_QUESTION'; end if;
    for k in select jsonb_object_keys(q) loop
      if lower(k) in ('answer','answers','correct','correct_answer','correctanswer','answer_key','answerkey','solution','explanation','rubric') then raise exception 'EXAM_QUESTION_CONTAINS_SECRET_FIELD'; end if;
    end loop;
    if q ? 'options' and (jsonb_typeof(q->'options')<>'array' or jsonb_array_length(q->'options')<>4) then raise exception 'FOUR_OPTIONS_REQUIRED'; end if;
  end loop;
end $$;

create or replace function private.exams_safe_questions_trigger_v18() returns trigger
language plpgsql set search_path=public,private,pg_temp as $$
begin
  perform private.assert_exam_questions_safe_v18(new.questions);
  return new;
end $$;

drop trigger if exists trg_exams_safe_questions_v18 on public.exams;
create trigger trg_exams_safe_questions_v18 before insert or update of questions on public.exams
for each row execute function private.exams_safe_questions_trigger_v18();

create or replace function private.sanitize_exam_questions_v18(p_questions jsonb) returns jsonb
language sql immutable set search_path=pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id',q->>'id','type',coalesce(q->>'type','mcq'),'prompt',q->>'prompt','options',q->'options',
    'points',coalesce((q->>'points')::numeric,0.4),'required',coalesce((q->>'required')::boolean,true)
  ))),'[]'::jsonb) from jsonb_array_elements(coalesce(p_questions,'[]'::jsonb)) q;
$$;

create or replace function public.start_exam_v18(p_exam_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_result jsonb;v_safe jsonb;
begin
  v_result:=public.start_exam_v179(p_exam_id);
  if v_result ? 'exam' then
    v_safe:=private.sanitize_exam_questions_v18(v_result#>'{exam,questions}');
    v_result:=jsonb_set(v_result,'{exam,questions}',v_safe,true);
  end if;
  return v_result;
end $$;

create or replace function public.submit_exam_attempt_v18(p_attempt_id uuid,p_answers jsonb,p_request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  return public.submit_exam_attempt_v179(p_attempt_id,p_answers,p_request_key);
end $$;

create or replace function public.admin_create_exam_from_bank_v18(
 p_subject_id uuid,p_title text,p_exam_kind text,p_open_at timestamptz default null,p_due_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_exam uuid;v_questions jsonb;v_key jsonb;v_count int;v_basic int;v_easy int;v_hard int;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_exam_kind not in ('midterm','final','practice') then raise exception 'INVALID_EXAM_KIND'; end if;
  if p_open_at is not null and p_due_at is not null and p_due_at<=p_open_at then raise exception 'INVALID_SCHEDULE'; end if;
  select count(*) filter(where lower(coalesce(difficulty,''))='basic'),count(*) filter(where lower(coalesce(difficulty,''))='easy'),count(*) filter(where lower(coalesce(difficulty,''))='hard')
    into v_basic,v_easy,v_hard from public.exam_question_bank where subject_id=p_subject_id and active;
  if v_basic<10 or v_easy<15 or v_hard<25 then raise exception 'QUESTION_BANK_DIFFICULTY_NEEDS_10_15_25'; end if;
  with picked as (
    (select * from public.exam_question_bank where subject_id=p_subject_id and active and lower(coalesce(difficulty,''))='basic' order by random() limit 10)
    union all
    (select * from public.exam_question_bank where subject_id=p_subject_id and active and lower(coalesce(difficulty,''))='easy' order by random() limit 15)
    union all
    (select * from public.exam_question_bank where subject_id=p_subject_id and active and lower(coalesce(difficulty,''))='hard' order by random() limit 25)
  )
  select count(*),jsonb_agg(jsonb_build_object('id',id::text,'type','mcq','prompt',prompt,'options',options,'points',0.4,'required',true)),jsonb_object_agg(id::text,to_jsonb(correct_answer))
  into v_count,v_questions,v_key from picked;
  if v_count<>50 then raise exception 'QUESTION_BANK_NEEDS_50'; end if;
  perform private.assert_exam_questions_safe_v18(v_questions);
  insert into public.exams(subject_id,title,status,open_at,due_at,duration_minutes,max_attempts,shuffle_questions,shuffle_options,questions,created_by,exam_kind,full_score,question_count_target,anti_cheat_enabled,require_fullscreen,settings)
  values(p_subject_id,trim(p_title),'draft',p_open_at,p_due_at,75,1,true,true,v_questions,auth.uid(),p_exam_kind,20,50,true,true,
    jsonb_build_object('source','question_bank_v18','student_score_visible',false,'student_answer_key_visible',false,'score_formula','correct*20/50','difficulty_distribution',jsonb_build_object('basic',10,'easy',15,'hard',25))) returning id into v_exam;
  insert into public.exam_answer_keys(exam_id,answer_key,rubric,updated_by,updated_at)
  values(v_exam,v_key,jsonb_build_object('question_count',50,'full_score',20,'difficulty_distribution',jsonb_build_object('basic',10,'easy',15,'hard',25)),auth.uid(),clock_timestamp());
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'CREATE_EXAM_FROM_BANK_V18','exam',v_exam::text,jsonb_build_object('subject_id',p_subject_id,'kind',p_exam_kind,'questions',50,'duration_minutes',75,'full_score',20));
  return v_exam;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Join-code attempt throttling
-- ---------------------------------------------------------------------------
create table if not exists private.subject_join_attempts(
  user_id uuid not null,
  subject_id uuid not null,
  window_started timestamptz not null default clock_timestamp(),
  fail_count integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(user_id,subject_id)
);
revoke all on private.subject_join_attempts from public,anon,authenticated;

create or replace function public.join_subject_with_code_v18(p_subject_id uuid,p_code text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_a private.subject_join_attempts%rowtype;v_result jsonb;v_msg text;v_now timestamptz:=clock_timestamp();
begin
  if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('join-rate:'||v_uid::text||':'||p_subject_id::text,0));
  select * into v_a from private.subject_join_attempts where user_id=v_uid and subject_id=p_subject_id for update;
  if v_a.blocked_until is not null and v_a.blocked_until>v_now then
    return jsonb_build_object('ok',false,'error','JOIN_RATE_LIMITED','retry_after_seconds',greatest(1,extract(epoch from (v_a.blocked_until-v_now))::int));
  end if;
  begin
    v_result:=public.join_subject_with_code(p_subject_id,p_code);
    delete from private.subject_join_attempts where user_id=v_uid and subject_id=p_subject_id;
    return v_result;
  exception when others then
    v_msg:=sqlerrm;
    if v_msg like '%JOIN_CODE_INVALID%' then
      insert into private.subject_join_attempts(user_id,subject_id,window_started,fail_count,updated_at)
      values(v_uid,p_subject_id,v_now,1,v_now)
      on conflict(user_id,subject_id) do update set
        window_started=case when private.subject_join_attempts.window_started<v_now-interval '10 minutes' then v_now else private.subject_join_attempts.window_started end,
        fail_count=case when private.subject_join_attempts.window_started<v_now-interval '10 minutes' then 1 else private.subject_join_attempts.fail_count+1 end,
        updated_at=v_now;
      update private.subject_join_attempts set blocked_until=v_now+interval '15 minutes'
      where user_id=v_uid and subject_id=p_subject_id and fail_count>=8;
      select * into v_a from private.subject_join_attempts where user_id=v_uid and subject_id=p_subject_id;
      insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(v_uid,'JOIN_SUBJECT_CODE_FAILED_V18','subject',p_subject_id::text,jsonb_build_object('fail_count',v_a.fail_count,'blocked_until',v_a.blocked_until));
      return jsonb_build_object('ok',false,'error',case when v_a.blocked_until is not null and v_a.blocked_until>v_now then 'JOIN_RATE_LIMITED' else 'JOIN_CODE_INVALID' end,'attempts',v_a.fail_count,'blocked_until',v_a.blocked_until);
    end if;
    raise;
  end;
end $$;

-- Registration Edge Function uses this service-role-only RPC.
create table if not exists private.registration_rate_limits(
  fingerprint text primary key,
  window_started timestamptz not null default clock_timestamp(),
  fail_count integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);
revoke all on private.registration_rate_limits from public,anon,authenticated;

create or replace function public.registration_rate_check_v18(p_fingerprint text,p_success boolean default false)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_now timestamptz:=clock_timestamp();v_r private.registration_rate_limits%rowtype;v_key text:=encode(digest(coalesce(p_fingerprint,''),'sha256'),'hex');
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('register-rate:'||v_key,0));
  if p_success then delete from private.registration_rate_limits where fingerprint=v_key;return jsonb_build_object('ok',true,'cleared',true); end if;
  select * into v_r from private.registration_rate_limits where fingerprint=v_key for update;
  if v_r.blocked_until is not null and v_r.blocked_until>v_now then return jsonb_build_object('ok',false,'blocked',true,'retry_after_seconds',extract(epoch from (v_r.blocked_until-v_now))::int); end if;
  insert into private.registration_rate_limits(fingerprint,window_started,fail_count,updated_at)
  values(v_key,v_now,1,v_now)
  on conflict(fingerprint) do update set
    window_started=case when private.registration_rate_limits.window_started<v_now-interval '15 minutes' then v_now else private.registration_rate_limits.window_started end,
    fail_count=case when private.registration_rate_limits.window_started<v_now-interval '15 minutes' then 1 else private.registration_rate_limits.fail_count+1 end,
    updated_at=v_now;
  update private.registration_rate_limits set blocked_until=v_now+interval '30 minutes' where fingerprint=v_key and fail_count>=10;
  select * into v_r from private.registration_rate_limits where fingerprint=v_key;
  return jsonb_build_object('ok',true,'blocked',false,'attempts',v_r.fail_count,'blocked_until',v_r.blocked_until);
end $$;

-- ---------------------------------------------------------------------------
-- 7) Capacity / integrity monitoring
-- ---------------------------------------------------------------------------
create or replace function public.admin_capacity_report_v18() returns jsonb
language plpgsql security definer set search_path=public,private,storage,pg_temp as $$
declare v_uid uuid:=auth.uid();v_db bigint;v_storage bigint;v_objects bigint;v_orphan bigint;v_largest jsonb;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  select pg_database_size(current_database()) into v_db;
  select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0),count(*) into v_storage,v_objects from storage.objects;
  select count(*) into v_orphan from storage.objects o where o.bucket_id='submissions' and o.created_at<clock_timestamp()-interval '7 days'
    and not exists(select 1 from public.submission_files f where f.storage_path=o.name)
    and not exists(select 1 from public.paper_scan_pages p where p.storage_path=o.name);
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_largest from (
    select bucket_id,name,coalesce((metadata->>'size')::bigint,0) size_bytes from storage.objects order by coalesce((metadata->>'size')::bigint,0) desc nulls last limit 10
  ) x;
  return jsonb_build_object('ok',true,'database_bytes',v_db,'storage_bytes',v_storage,'storage_objects',v_objects,'orphan_submission_objects_over_7d',v_orphan,'largest_objects',v_largest,'server_time',clock_timestamp());
end $$;

create or replace function public.admin_integrity_report_v18() returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_base jsonb;v_paper_incomplete int;v_mutable int;v_bank int;v_history int;
begin
  if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED'; end if;
  v_base:=public.admin_integrity_report_v179();
  select count(*) into v_paper_incomplete from public.submissions s join public.worksheets w on w.id=s.worksheet_id
  where w.mode='paper' and s.status in ('confirmed','graded') and
    (select count(*) from public.paper_scans ps where ps.submission_id=s.id and ps.scan_status in ('accepted','expired_accepted','duplicate')) < greatest(2,least(50,coalesce(nullif(w.settings->>'page_count','')::integer,2)));
  select count(*) into v_mutable from public.submission_files where immutable_at is null and created_at<clock_timestamp()-interval '5 minutes';
  select count(*) into v_bank from public.subjects s where s.active and s.subject_type='subject' and (select count(*) from public.exam_question_bank q where q.subject_id=s.id and q.active)<50;
  select count(*) into v_history from public.submission_grades g where g.grading_status='final' and not exists(select 1 from public.submission_grade_history h where h.submission_id=g.submission_id);
  return v_base||jsonb_build_object('ok',coalesce((v_base->>'ok')::boolean,false) and v_paper_incomplete=0 and v_bank=0,
    'paper_incomplete_pages',v_paper_incomplete,'submission_files_without_immutable_mark',v_mutable,'subjects_exam_bank_under_50',v_bank,'final_grades_without_history',v_history,'v18',true);
end $$;

create or replace function public.admin_system_health_v18() returns jsonb
language plpgsql security definer set search_path=public,private,storage,cron,pg_temp as $$
declare v_base jsonb;v_integrity jsonb;v_cap jsonb;v_bank int;v_rpc int;
begin
  if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED'; end if;
  v_base:=public.admin_system_health_v17();
  v_integrity:=public.admin_integrity_report_v18();
  v_cap:=public.admin_capacity_report_v18();
  select count(*) into v_bank from public.exam_question_bank where active;
  select count(distinct p.proname) into v_rpc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
    'join_subject_with_code_v18','admin_grade_submission_v18','admin_grade_exam_attempt_v18','start_exam_v18','submit_exam_attempt_v18',
    'admin_record_paper_scan_page_v18','admin_finalize_paper_scan_packet_v18','admin_create_exam_from_bank_v18','admin_capacity_report_v18','admin_integrity_report_v18'
  ]);
  return v_base||jsonb_build_object('version','V18-COMPLETE-PRODUCTION-HARDENED','backend_ok',coalesce((v_integrity->>'ok')::boolean,false),
    'v18_rpc_count',v_rpc,'exam_question_bank',v_bank,'paper_multi_page_packet',true,'immutable_submission_evidence',true,'grade_revision_history',true,
    'exam_safe_payload',true,'join_code_rate_limit',true,'capacity_monitor',true,'database_bytes',v_cap->'database_bytes','storage_bytes',v_cap->'storage_bytes');
end $$;

-- Keep stable health alias for existing frontends while exposing V18 details.
create or replace function public.admin_system_health_v17() returns jsonb
language sql stable security definer set search_path=public,private,storage,cron,pg_temp as $$
  select public.admin_system_health_v179() || jsonb_build_object('frontend_router_contract','single-owner','v18_available',true);
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.admin_record_paper_scan_page_v18(text,integer,text,text,text,bigint,text,boolean,jsonb,uuid) from public,anon;
grant execute on function public.admin_record_paper_scan_page_v18(text,integer,text,text,text,bigint,text,boolean,jsonb,uuid) to authenticated;
revoke all on function public.admin_finalize_paper_scan_packet_v18(uuid,uuid) from public,anon;
grant execute on function public.admin_finalize_paper_scan_packet_v18(uuid,uuid) to authenticated;
revoke all on function public.admin_grade_submission_v18(uuid,numeric,numeric,text,text,jsonb,text,uuid) from public,anon;
grant execute on function public.admin_grade_submission_v18(uuid,numeric,numeric,text,text,jsonb,text,uuid) to authenticated;
revoke all on function public.admin_grade_exam_attempt_v18(uuid,numeric,text,text,uuid) from public,anon;
grant execute on function public.admin_grade_exam_attempt_v18(uuid,numeric,text,text,uuid) to authenticated;
revoke all on function public.start_exam_v18(uuid) from public,anon;
grant execute on function public.start_exam_v18(uuid) to authenticated;
revoke all on function public.submit_exam_attempt_v18(uuid,jsonb,uuid) from public,anon;
grant execute on function public.submit_exam_attempt_v18(uuid,jsonb,uuid) to authenticated;
revoke all on function public.admin_create_exam_from_bank_v18(uuid,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_create_exam_from_bank_v18(uuid,text,text,timestamptz,timestamptz) to authenticated;
revoke all on function public.join_subject_with_code_v18(uuid,text) from public,anon;
grant execute on function public.join_subject_with_code_v18(uuid,text) to authenticated;
revoke all on function public.registration_rate_check_v18(text,boolean) from public,anon,authenticated;
grant execute on function public.registration_rate_check_v18(text,boolean) to service_role;
revoke all on function public.admin_capacity_report_v18() from public,anon;
grant execute on function public.admin_capacity_report_v18() to authenticated;
revoke all on function public.admin_integrity_report_v18() from public,anon;
grant execute on function public.admin_integrity_report_v18() to authenticated;
revoke all on function public.admin_system_health_v18() from public,anon;
grant execute on function public.admin_system_health_v18() to authenticated;

-- Realtime grade history is intentionally NOT published; Admin reads on demand.
notify pgrst,'reload schema';
