-- DOC-FULL-NR V16.7 paper barcode + runtime hardening
-- This file mirrors schema changes already applied to Production on 2026-09-15.
-- Do not reseed worksheets. Standard templates remain 198 (55 paper / 143 digital).

alter table public.paper_tokens add column if not exists barcode_payload text;
alter table public.paper_tokens add column if not exists payload_version integer not null default 1;

create or replace function private.docnr_b64url_utf8(p_text text)
returns text language sql immutable strict set search_path = pg_catalog as $$
  select translate(encode(convert_to(p_text,'UTF8'),'base64'), E'+/\n\r=', '-_')
$$;

create or replace function private.sync_paper_token_runtime()
returns trigger language plpgsql security invoker
set search_path = public, private, pg_temp as $$
declare v_title text; v_due timestamptz; v_ref text;
begin
  select w.title,w.due_at,w.reference_code into v_title,v_due,v_ref
  from public.worksheets w where w.id=new.worksheet_id and w.mode='paper';
  if not found then return new; end if;
  new.code_kind := 'barcode';
  new.expires_at := v_due;
  new.payload_version := 1;
  new.barcode_payload := '?token='||new.token
    ||'&n64='||private.docnr_b64url_utf8(coalesce(v_title,''))
    ||'&d='||coalesce(floor(extract(epoch from v_due))::bigint::text,'0')
    ||'&ref='||regexp_replace(coalesce(v_ref,''),'[^A-Za-z0-9._-]','','g');
  return new;
end $$;

drop trigger if exists paper_tokens_sync_runtime on public.paper_tokens;
create trigger paper_tokens_sync_runtime
before insert or update of worksheet_id,token,expires_at,code_kind
on public.paper_tokens for each row execute function private.sync_paper_token_runtime();

create or replace function private.sync_worksheet_paper_tokens()
returns trigger language plpgsql security invoker
set search_path = public,private,pg_temp as $$
begin
  if new.mode='paper' and (old.due_at is distinct from new.due_at or old.title is distinct from new.title or old.reference_code is distinct from new.reference_code) then
    update public.paper_tokens set expires_at=new.due_at,code_kind='barcode' where worksheet_id=new.id;
  end if;
  return new;
end $$;

drop trigger if exists worksheets_sync_paper_tokens on public.worksheets;
create trigger worksheets_sync_paper_tokens
after update of due_at,title,reference_code on public.worksheets
for each row execute function private.sync_worksheet_paper_tokens();

update public.paper_tokens pt set expires_at=w.due_at,code_kind='barcode'
from public.worksheets w where w.id=pt.worksheet_id and w.mode='paper';

create or replace function public.admin_prepare_paper_print_pack(p_worksheet_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_w public.worksheets%rowtype;
  v_subject_code text; v_subject_name text; v_students jsonb;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_w from public.worksheets where id=p_worksheet_id;
  if v_w.id is null then raise exception 'WORKSHEET_NOT_FOUND'; end if;
  if v_w.mode<>'paper' then raise exception 'PAPER_WORKSHEET_REQUIRED'; end if;
  select code,name into v_subject_code,v_subject_name from public.subjects where id=v_w.subject_id;

  insert into public.paper_tokens(worksheet_id,user_id,expires_at,code_kind)
  select v_w.id,a.user_id,v_w.due_at,'barcode'
  from public.worksheet_assignments a where a.worksheet_id=v_w.id
  on conflict(worksheet_id,user_id) do update set expires_at=excluded.expires_at,code_kind='barcode';

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',p.id,'full_name',p.full_name,'student_code',p.student_code,'class_name',p.class_name,
    'grade_level',p.grade_level,'room_label',p.room_label,'seat_number',p.seat_number,
    'token',pt.token,'expires_at',pt.expires_at,'barcode_payload',pt.barcode_payload,
    'payload_version',pt.payload_version,'revoked_at',pt.revoked_at,'used_at',pt.used_at
  ) order by coalesce(p.student_code,''),coalesce(p.full_name,'')),'[]'::jsonb) into v_students
  from public.worksheet_assignments a
  join public.profiles p on p.id=a.user_id
  join public.paper_tokens pt on pt.worksheet_id=a.worksheet_id and pt.user_id=a.user_id
  where a.worksheet_id=v_w.id;

  return jsonb_build_object('worksheet',jsonb_build_object(
    'id',v_w.id,'subject_id',v_w.subject_id,'subject_code',v_subject_code,'subject_name',v_subject_name,
    'title',v_w.title,'description',v_w.description,'instructions',v_w.instructions,
    'reference_code',v_w.reference_code,'questions',coalesce(v_w.questions,'[]'::jsonb),
    'settings',coalesce(v_w.settings,'{}'::jsonb),'open_at',v_w.open_at,'due_at',v_w.due_at,'status',v_w.status
  ),'students',v_students,'server_time',clock_timestamp());
end $$;

revoke all on function public.admin_prepare_paper_print_pack(uuid) from public,anon;
grant execute on function public.admin_prepare_paper_print_pack(uuid) to authenticated;

create or replace function public.admin_record_paper_scan(
  p_token text,p_storage_path text,p_original_name text,p_mime_type text default 'image/jpeg',
  p_size_bytes bigint default null,p_barcode_format text default null,
  p_accept_expired boolean default false,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); t public.paper_tokens%rowtype; w public.worksheets%rowtype;
  sub public.submissions%rowtype; v_now timestamptz:=clock_timestamp();
  v_expired boolean:=false; v_duplicate boolean:=false; v_scan uuid; v_status text; v_meta jsonb;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if nullif(trim(coalesce(p_storage_path,'')),'') is null then raise exception 'STORAGE_PATH_REQUIRED'; end if;
  if coalesce(p_size_bytes,0)>26214400 then raise exception 'PAPER_SCAN_TOO_LARGE'; end if;
  if lower(coalesce(p_mime_type,'image/jpeg')) not in ('image/jpeg','image/png','image/webp') then raise exception 'PAPER_SCAN_IMAGE_REQUIRED'; end if;

  select * into t from public.paper_tokens where token=trim(p_token) for update;
  if not found then raise exception 'INVALID_PAPER_TOKEN'; end if;
  if t.revoked_at is not null then raise exception 'PAPER_TOKEN_REVOKED'; end if;
  if split_part(p_storage_path,'/',1)<>t.user_id::text then raise exception 'INVALID_PAPER_SCAN_PATH'; end if;

  select * into w from public.worksheets where id=t.worksheet_id;
  if w.id is null or w.mode<>'paper' then raise exception 'PAPER_WORKSHEET_REQUIRED'; end if;
  if not exists(select 1 from public.worksheet_assignments where worksheet_id=t.worksheet_id and user_id=t.user_id) then raise exception 'NOT_ASSIGNED'; end if;

  v_expired:=t.expires_at is not null and v_now>t.expires_at;
  if v_expired and not p_accept_expired then raise exception 'PAPER_TOKEN_EXPIRED'; end if;
  select exists(select 1 from public.paper_scans ps where ps.paper_token_id=t.id and ps.scan_status in ('accepted','expired_accepted')) into v_duplicate;

  select * into sub from public.submissions where worksheet_id=t.worksheet_id and user_id=t.user_id for update;
  if sub.id is null then
    insert into public.submissions(worksheet_id,user_id,status,paper_token_id,confirmed_at,attempt_count,is_late,updated_at)
    values(t.worksheet_id,t.user_id,'confirmed',t.id,v_now,1,(w.due_at is not null and v_now>w.due_at),v_now) returning * into sub;
  elsif sub.status='draft' then
    update public.submissions set status='confirmed',paper_token_id=t.id,confirmed_at=v_now,
      attempt_count=greatest(attempt_count,0)+1,is_late=(w.due_at is not null and v_now>w.due_at),updated_at=v_now
    where id=sub.id returning * into sub;
  end if;

  insert into public.submission_files(submission_id,user_id,storage_path,original_name,mime_type,size_bytes)
  values(sub.id,t.user_id,p_storage_path,coalesce(nullif(trim(coalesce(p_original_name,'')),''),'paper-scan.jpg'),p_mime_type,p_size_bytes);

  v_status:=case when v_duplicate then 'duplicate' when v_expired then 'expired_accepted' else 'accepted' end;
  v_meta:=coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object(
    'full_sheet',true,'payload_version',coalesce(t.payload_version,1),'barcode_payload',coalesce(t.barcode_payload,t.token),
    'worksheet_title',w.title,'reference_code',w.reference_code,'worksheet_due_at',w.due_at,
    'token_expires_at',t.expires_at,'verified_server_at',v_now,'duplicate',v_duplicate
  );

  insert into public.paper_scans(worksheet_id,user_id,submission_id,paper_token_id,storage_path,original_name,mime_type,size_bytes,barcode_value,barcode_format,scan_status,scanned_by,metadata)
  values(t.worksheet_id,t.user_id,sub.id,t.id,p_storage_path,coalesce(nullif(trim(coalesce(p_original_name,'')),''),'paper-scan.jpg'),
    p_mime_type,p_size_bytes,coalesce(t.barcode_payload,t.token),coalesce(p_barcode_format,'code_128'),v_status,v_uid,v_meta)
  returning id into v_scan;

  update public.paper_tokens set used_at=coalesce(used_at,v_now),last_verified_at=v_now where id=t.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'SCAN_PAPER_SUBMISSION','paper_scan',v_scan::text,
    jsonb_build_object('worksheet_id',t.worksheet_id,'user_id',t.user_id,'expired',v_expired,'duplicate',v_duplicate,'storage_path',p_storage_path));

  return jsonb_build_object('ok',true,'scan_id',v_scan,'submission_id',sub.id,'expired',v_expired,'duplicate',v_duplicate,'scan_status',v_status,'status',sub.status,'server_time',v_now);
end $$;

revoke all on function public.admin_record_paper_scan(text,text,text,text,bigint,text,boolean,jsonb) from public,anon;
grant execute on function public.admin_record_paper_scan(text,text,text,text,bigint,text,boolean,jsonb) to authenticated;

drop policy if exists paper_tokens_insert on public.paper_tokens;
drop policy if exists paper_tokens_update on public.paper_tokens;
drop policy if exists paper_tokens_insert_admin_only on public.paper_tokens;
drop policy if exists paper_tokens_update_admin_only on public.paper_tokens;
create policy paper_tokens_insert_admin_only on public.paper_tokens for insert to authenticated with check(private.is_admin());
create policy paper_tokens_update_admin_only on public.paper_tokens for update to authenticated using(private.is_admin()) with check(private.is_admin());

drop policy if exists attendance_qr_tokens_rpc_only on public.attendance_qr_tokens;
create policy attendance_qr_tokens_rpc_only on public.attendance_qr_tokens for all to authenticated using(false) with check(false);

create index if not exists paper_scans_token_idx on public.paper_scans(paper_token_id);
create index if not exists paper_scans_submission_idx on public.paper_scans(submission_id);
create index if not exists paper_scans_user_idx on public.paper_scans(user_id);
create index if not exists paper_scans_scanned_by_idx on public.paper_scans(scanned_by);
create index if not exists attendance_sessions_subject_idx on public.attendance_sessions(subject_id);
create index if not exists attendance_records_scanned_by_idx on public.attendance_records(scanned_by);
create index if not exists exam_attempt_events_user_idx on public.exam_attempt_events(user_id);
create index if not exists exam_assignments_subject_enrollment_idx on public.exam_assignments(subject_enrollment_id);
create index if not exists subject_behavior_scores_user_idx on public.subject_behavior_scores(user_id);
drop index if exists public.worksheets_reference_code_unique;

create or replace function public.admin_runtime_health_v167()
returns jsonb language plpgsql security definer
set search_path=public,private,storage,pg_temp as $$
declare
  v_uid uuid:=auth.uid();v_standard integer;v_paper integer;v_digital integer;v_subjects integer;
  v_join_codes integer;v_tokens integer;v_scans integer;v_functions_ok boolean;v_profiles_locked boolean;v_storage_private boolean;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  select count(*) filter(where reference_code is not null),
         count(*) filter(where reference_code is not null and mode='paper'),
         count(*) filter(where reference_code is not null and mode='digital')
  into v_standard,v_paper,v_digital from public.worksheets;
  select count(*) into v_subjects from public.subjects where active=true and subject_type='subject';
  select count(*) into v_join_codes from public.subject_join_codes where active=true;
  select count(*) into v_tokens from public.paper_tokens;
  select count(*) into v_scans from public.paper_scans;
  select count(*)=8 into v_functions_ok from (
    select distinct p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array[
      'admin_prepare_paper_print_pack','admin_record_paper_scan','admin_subject_paper_scans',
      'admin_subject_gradebook','publish_subject_worksheets','join_subject_with_code',
      'attendance_session_snapshot','my_exam_attempt_status'
    ])
  ) x;
  select exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_admin_only') into v_profiles_locked;
  select bool_and(not public) into v_storage_private from storage.buckets where id=any(array['avatars','worksheet-files','subject-files','submissions','paper-pdfs']);
  return jsonb_build_object(
    'version','V16.7-RUNTIME-HARDENED','server_time',clock_timestamp(),
    'standard_templates',v_standard,'paper_templates',v_paper,'digital_templates',v_digital,
    'active_subjects',v_subjects,'active_join_codes',v_join_codes,'paper_tokens',v_tokens,'paper_scans',v_scans,
    'required_functions_ok',v_functions_ok,'student_profile_update_locked',v_profiles_locked,
    'private_storage_ok',coalesce(v_storage_private,false),
    'backend_ok',(v_standard=198 and v_paper=55 and v_digital=143 and v_functions_ok and v_profiles_locked and coalesce(v_storage_private,false))
  );
end $$;
revoke all on function public.admin_runtime_health_v167() from public,anon;
grant execute on function public.admin_runtime_health_v167() to authenticated;

notify pgrst,'reload schema';

-- Production follow-up applied: v16_7_barcode_payload_linebreak_fix
-- Base64 line wrapping is removed so long Thai worksheet titles remain scanner-safe.