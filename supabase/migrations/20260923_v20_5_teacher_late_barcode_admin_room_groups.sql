-- DOC-FULL-NR V20.5
-- Teacher late-attendance barcode + Admin-defined room groups.
-- Production-aligned reference migration. Existing subject-room/work/grade history is preserved.

create table if not exists public.late_attendance_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  active boolean not null default true,
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists late_attendance_tokens_one_active_per_session_idx on public.late_attendance_tokens(session_id) where active;
create index if not exists late_attendance_tokens_session_idx on public.late_attendance_tokens(session_id,created_at desc);
create index if not exists late_attendance_tokens_expiry_idx on public.late_attendance_tokens(expires_at) where active;
alter table public.late_attendance_tokens enable row level security;

create table if not exists public.admin_room_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null check(code ~ '^[A-Z0-9_-]{2,24}$'),
  name text not null,
  academic_year text,
  semester text,
  level text,
  department text,
  major text,
  description text,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index if not exists admin_room_groups_code_ci_idx on public.admin_room_groups(lower(code));
create index if not exists admin_room_groups_active_idx on public.admin_room_groups(active,academic_year,semester);
alter table public.admin_room_groups enable row level security;

create table if not exists public.admin_room_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.admin_room_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seat_number integer check(seat_number is null or seat_number between 1 and 999),
  active boolean not null default true,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(group_id,user_id)
);
create index if not exists admin_room_group_members_group_idx on public.admin_room_group_members(group_id,active);
create index if not exists admin_room_group_members_user_idx on public.admin_room_group_members(user_id,active);
alter table public.admin_room_group_members enable row level security;

create or replace function private.refresh_attendance_summary_v205(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $function$
declare s public.attendance_sessions%rowtype;v_expected int:=0;v_present int:=0;v_late int:=0;v_absent int:=0;v_excused int:=0;v_checked int:=0;v_summary jsonb;
begin
 select * into s from public.attendance_sessions where id=p_session_id for update;
 if not found then raise exception 'ATTENDANCE_SESSION_NOT_FOUND';end if;
 select count(*) into v_expected from public.classroom_memberships m join public.profiles p on p.id=m.user_id and p.active and p.role='user' and p.approval_status='approved' join public.subject_enrollments e on e.user_id=m.user_id and e.subject_id=s.subject_id and e.status='approved' where m.classroom_id=s.classroom_id and m.active;
 select count(*) filter(where status='present'),count(*) filter(where status='late'),count(*) filter(where status='absent'),count(*) filter(where status='excused') into v_present,v_late,v_absent,v_excused from public.attendance_records where session_id=s.id;
 v_checked:=v_present+v_late+v_excused;
 v_summary:=coalesce(s.summary,'{}'::jsonb)||jsonb_build_object('expected',v_expected,'present',v_present,'late',v_late,'absent',v_absent,'excused',v_excused,'checked',v_checked,'late_barcode_updated_at',clock_timestamp());
 update public.attendance_sessions set summary=v_summary where id=s.id;return v_summary;
end;$function$;

create or replace function public.admin_issue_late_attendance_barcode_v205(p_session_id uuid,p_rotate boolean default false)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $function$
declare v_uid uuid:=auth.uid();s public.attendance_sessions%rowtype;t public.late_attendance_tokens%rowtype;v_exp timestamptz;v_teacher text;v_now timestamptz:=clock_timestamp();
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED';end if;
 select * into s from public.attendance_sessions where id=p_session_id for update;if not found then raise exception 'ATTENDANCE_SESSION_NOT_FOUND';end if;
 if not coalesce(p_rotate,false) then select * into t from public.late_attendance_tokens where session_id=s.id and active and expires_at>v_now order by created_at desc limit 1;if t.id is not null then select coalesce(full_name,username,'Admin') into v_teacher from public.profiles where id=t.issued_by;return jsonb_build_object('ok',true,'session_id',s.id,'token',t.token,'payload','DOCNR-LATE:'||t.token::text,'expires_at',t.expires_at,'issued_by',t.issued_by,'teacher_name',v_teacher,'reused',true,'late_available_at',coalesce(s.auto_close_at,s.started_at+make_interval(mins=>s.late_after_minutes)));end if;end if;
 update public.late_attendance_tokens set active=false,revoked_at=v_now where session_id=s.id and active;
 v_exp:=greatest(coalesce(s.auto_close_at,s.started_at+make_interval(mins=>s.late_after_minutes)),v_now)+interval '4 hours';
 insert into public.late_attendance_tokens(session_id,issued_by,expires_at,metadata) values(s.id,v_uid,v_exp,jsonb_build_object('release','V20.5','purpose','student_scans_teacher_late_barcode')) returning * into t;
 select coalesce(full_name,username,'Admin') into v_teacher from public.profiles where id=v_uid;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,case when p_rotate then 'ROTATE_LATE_ATTENDANCE_BARCODE' else 'ISSUE_LATE_ATTENDANCE_BARCODE' end,'attendance_session',s.id::text,jsonb_build_object('late_token_id',t.id,'expires_at',t.expires_at));
 return jsonb_build_object('ok',true,'session_id',s.id,'token',t.token,'payload','DOCNR-LATE:'||t.token::text,'expires_at',t.expires_at,'issued_by',v_uid,'teacher_name',v_teacher,'reused',false,'late_available_at',coalesce(s.auto_close_at,s.started_at+make_interval(mins=>s.late_after_minutes)));
end;$function$;

create or replace function public.my_scan_teacher_late_barcode_v205(p_token uuid,p_request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $function$
declare v_uid uuid:=auth.uid();t public.late_attendance_tokens%rowtype;s public.attendance_sessions%rowtype;r public.attendance_records%rowtype;v_now timestamptz:=clock_timestamp();v_deadline timestamptz;v_summary jsonb;v_old jsonb;v_key text;v_subject text;v_classroom text;v_teacher text;
begin
 if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED';end if;
 v_key:=v_uid::text||':'||p_token::text;perform pg_advisory_xact_lock(hashtextextended('late-attendance:'||v_key,0));
 select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='late_attendance_scan_v205' and entity_key=v_key and request_key=p_request_key;if v_old is not null then return v_old||jsonb_build_object('idempotent_replay',true);end if;
 select * into t from public.late_attendance_tokens where token=p_token and active for update;if not found then raise exception 'INVALID_LATE_ATTENDANCE_BARCODE';end if;if t.expires_at<=v_now then raise exception 'LATE_ATTENDANCE_BARCODE_EXPIRED';end if;
 select * into s from public.attendance_sessions where id=t.session_id for update;if not found then raise exception 'ATTENDANCE_SESSION_NOT_FOUND';end if;
 v_deadline:=coalesce(s.auto_close_at,s.started_at+make_interval(mins=>s.late_after_minutes));if v_now<v_deadline then raise exception 'LATE_ATTENDANCE_WINDOW_NOT_STARTED';end if;
 if not exists(select 1 from public.classroom_memberships m where m.classroom_id=s.classroom_id and m.user_id=v_uid and m.active) then raise exception 'STUDENT_NOT_IN_CLASSROOM';end if;
 if not exists(select 1 from public.subject_enrollments e where e.subject_id=s.subject_id and e.user_id=v_uid and e.status='approved') then raise exception 'STUDENT_NOT_APPROVED_FOR_SUBJECT';end if;
 if s.status='open' then perform private.finalize_attendance_session_internal(s.id,null,'auto_15_minute');select * into s from public.attendance_sessions where id=t.session_id for update;end if;
 select * into r from public.attendance_records where session_id=s.id and user_id=v_uid for update;
 if r.id is not null and r.status in ('present','late','excused') then
  select coalesce(sub.code||' '||sub.name,sub.name),coalesce(c.name,'ห้องเรียน'),coalesce(p.full_name,p.username,'Admin') into v_subject,v_classroom,v_teacher from public.subjects sub,public.classrooms c,public.profiles p where sub.id=s.subject_id and c.id=s.classroom_id and p.id=t.issued_by;
  v_old:=jsonb_build_object('ok',true,'already_checked',true,'session_id',s.id,'record_id',r.id,'status',r.status,'scanned_at',r.scanned_at,'server_time',v_now,'subject',v_subject,'classroom',v_classroom,'teacher_name',v_teacher);
  insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'late_attendance_scan_v205',v_key,p_request_key,v_old) on conflict do nothing;return v_old||jsonb_build_object('idempotent_replay',false);
 end if;
 insert into public.attendance_records(session_id,user_id,scanned_at,status,scanned_by,note,updated_at) values(s.id,v_uid,v_now,'late',v_uid,'นักศึกษาสแกนบาร์โค้ดเข้าสายของครู',v_now) on conflict(session_id,user_id) do update set status=case when public.attendance_records.status='excused' then 'excused' else 'late' end,scanned_at=case when public.attendance_records.status='excused' then public.attendance_records.scanned_at else v_now end,scanned_by=case when public.attendance_records.status='excused' then public.attendance_records.scanned_by else v_uid end,note=case when public.attendance_records.status='excused' then public.attendance_records.note else 'นักศึกษาสแกนบาร์โค้ดเข้าสายของครู' end,updated_at=v_now returning * into r;
 v_summary:=private.refresh_attendance_summary_v205(s.id);
 select coalesce(sub.code||' '||sub.name,sub.name),coalesce(c.name,'ห้องเรียน'),coalesce(p.full_name,p.username,'Admin') into v_subject,v_classroom,v_teacher from public.subjects sub,public.classrooms c,public.profiles p where sub.id=s.subject_id and c.id=s.classroom_id and p.id=t.issued_by;
 perform private.push_app_notification(v_uid,'late_attendance_checked','เช็คชื่อเข้าสายสำเร็จ',format('%s • %s • มาสาย • %s',v_subject,v_classroom,to_char(v_now at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI:SS')),jsonb_build_object('session_id',s.id,'record_id',r.id,'status','late','scanned_at',v_now,'teacher_id',t.issued_by));
 perform private.push_app_notification(t.issued_by,'late_attendance_student_scan','นักศึกษาเช็คชื่อเข้าสาย',format('%s • %s • %s',coalesce((select student_code from public.profiles where id=v_uid),'-'),coalesce((select full_name from public.profiles where id=v_uid),'-'),v_subject),jsonb_build_object('session_id',s.id,'student_id',v_uid,'record_id',r.id,'status','late','scanned_at',v_now));
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'STUDENT_SCAN_TEACHER_LATE_BARCODE','attendance_record',r.id::text,jsonb_build_object('session_id',s.id,'teacher_id',t.issued_by,'late_token_id',t.id,'status','late','server_time',v_now));
 v_old:=jsonb_build_object('ok',true,'already_checked',false,'session_id',s.id,'record_id',r.id,'status',r.status,'scanned_at',r.scanned_at,'server_time',v_now,'subject',v_subject,'classroom',v_classroom,'teacher_name',v_teacher,'summary',v_summary);
 insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'late_attendance_scan_v205',v_key,p_request_key,v_old) on conflict do nothing;return v_old||jsonb_build_object('idempotent_replay',false);
end;$function$;

-- V20.5 hard gate: normal QR flow is no longer allowed after the 15-minute deadline.
create or replace function public.scan_attendance_qr_v179(p_classroom_id uuid,p_subject_id uuid,p_token uuid,p_late_after_minutes integer default 15,p_request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $function$
declare v_uid uuid:=auth.uid();v_key text:=p_classroom_id::text||':'||p_subject_id::text||':'||p_token::text;v_old jsonb;v_result jsonb;s public.attendance_sessions%rowtype;v_now timestamptz:=clock_timestamp();v_deadline timestamptz;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;perform pg_advisory_xact_lock(hashtextextended('attendance:'||v_key,0));
 select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='attendance_scan' and entity_key=v_key and request_key=p_request_key;if v_old is not null then return v_old||jsonb_build_object('idempotent_replay',true);end if;
 select * into s from public.attendance_sessions where classroom_id=p_classroom_id and subject_id=p_subject_id and session_date=(timezone('Asia/Bangkok',v_now))::date order by started_at desc limit 1 for update;
 if s.id is not null then v_deadline:=coalesce(s.auto_close_at,s.started_at+make_interval(mins=>s.late_after_minutes));if v_now>=v_deadline then if s.status='open' then perform private.finalize_attendance_session_internal(s.id,null,'auto_15_minute');end if;raise exception 'ATTENDANCE_WINDOW_CLOSED_SCAN_TEACHER_BARCODE';end if;if s.status='closed' then raise exception 'ATTENDANCE_SESSION_ALREADY_CLOSED';end if;end if;
 v_result:=public.scan_attendance_qr(p_classroom_id,p_subject_id,p_token,p_late_after_minutes);insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'attendance_scan',v_key,p_request_key,v_result);return v_result||jsonb_build_object('request_key',p_request_key,'idempotent_replay',false);
end;$function$;

create or replace function public.admin_upsert_room_group_v205(p_group_id uuid default null,p_code text default null,p_name text default null,p_academic_year text default null,p_semester text default null,p_level text default null,p_department text default null,p_major text default null,p_description text default null,p_active boolean default true)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $function$
declare v_uid uuid:=auth.uid();g public.admin_room_groups%rowtype;v_code text;v_name text;
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED';end if;v_name:=nullif(trim(coalesce(p_name,'')),'');if v_name is null then raise exception 'ROOM_GROUP_NAME_REQUIRED';end if;
 v_code:=upper(regexp_replace(coalesce(nullif(trim(p_code),''),'RG-'||substr(replace(gen_random_uuid()::text,'-',''),1,8)),'[^A-Z0-9_-]','','g'));if length(v_code)<2 or length(v_code)>24 then raise exception 'ROOM_GROUP_CODE_INVALID';end if;
 if p_group_id is null then insert into public.admin_room_groups(code,name,academic_year,semester,level,department,major,description,active,created_by) values(v_code,v_name,nullif(trim(p_academic_year),''),nullif(trim(p_semester),''),nullif(trim(p_level),''),nullif(trim(p_department),''),nullif(trim(p_major),''),nullif(trim(p_description),''),coalesce(p_active,true),v_uid) returning * into g;else update public.admin_room_groups set code=v_code,name=v_name,academic_year=nullif(trim(p_academic_year),''),semester=nullif(trim(p_semester),''),level=nullif(trim(p_level),''),department=nullif(trim(p_department),''),major=nullif(trim(p_major),''),description=nullif(trim(p_description),''),active=coalesce(p_active,true),updated_at=clock_timestamp() where id=p_group_id returning * into g;if g.id is null then raise exception 'ROOM_GROUP_NOT_FOUND';end if;end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,case when p_group_id is null then 'CREATE_ADMIN_ROOM_GROUP' else 'UPDATE_ADMIN_ROOM_GROUP' end,'admin_room_group',g.id::text,jsonb_build_object('code',g.code,'name',g.name,'active',g.active));return jsonb_build_object('ok',true,'id',g.id,'code',g.code,'name',g.name,'active',g.active);
exception when unique_violation then raise exception 'ROOM_GROUP_CODE_EXISTS';end;$function$;

create or replace function public.admin_room_groups_v205()
returns table(id uuid,code text,name text,academic_year text,semester text,level text,department text,major text,description text,active boolean,member_count bigint,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='public','private','pg_temp' as $function$
begin if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED';end if;return query select g.id,g.code,g.name,g.academic_year,g.semester,g.level,g.department,g.major,g.description,g.active,count(m.id) filter(where m.active),g.created_at,g.updated_at from public.admin_room_groups g left join public.admin_room_group_members m on m.group_id=g.id group by g.id order by g.active desc,g.academic_year desc nulls last,g.semester desc nulls last,g.name;end;$function$;

create or replace function public.admin_room_group_members_v205(p_group_id uuid)
returns table(membership_id uuid,user_id uuid,student_code text,full_name text,display_name text,grade_level text,room_label text,class_name text,department text,major text,seat_number integer,active boolean)
language plpgsql security definer set search_path='public','private','pg_temp' as $function$
begin if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED';end if;if not exists(select 1 from public.admin_room_groups where id=p_group_id) then raise exception 'ROOM_GROUP_NOT_FOUND';end if;return query select m.id,p.id,p.student_code,p.full_name,p.display_name,p.grade_level,p.room_label,p.class_name,p.department,p.major,m.seat_number,m.active from public.admin_room_group_members m join public.profiles p on p.id=m.user_id where m.group_id=p_group_id order by m.active desc,m.seat_number nulls last,p.student_code nulls last,p.full_name;end;$function$;

create or replace function public.admin_replace_room_group_members_v205(p_group_id uuid,p_user_ids uuid[])
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $function$
declare v_uid uuid:=auth.uid();v_id uuid;v_count int:=0;v_users uuid[]:=coalesce(p_user_ids,'{}'::uuid[]);
begin if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED';end if;if not exists(select 1 from public.admin_room_groups where id=p_group_id) then raise exception 'ROOM_GROUP_NOT_FOUND';end if;if exists(select 1 from unnest(v_users) x(id) left join public.profiles p on p.id=x.id where p.id is null or p.role<>'user' or not p.active or p.approval_status<>'approved' or not private.can_learn(p.id)) then raise exception 'ROOM_GROUP_MEMBER_INVALID';end if;update public.admin_room_group_members set active=false,updated_at=clock_timestamp() where group_id=p_group_id and active and not(user_id=any(v_users));foreach v_id in array v_users loop insert into public.admin_room_group_members(group_id,user_id,active,added_by) values(p_group_id,v_id,true,v_uid) on conflict(group_id,user_id) do update set active=true,added_by=v_uid,updated_at=clock_timestamp();end loop;select count(*) into v_count from public.admin_room_group_members where group_id=p_group_id and active;insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'REPLACE_ADMIN_ROOM_GROUP_MEMBERS','admin_room_group',p_group_id::text,jsonb_build_object('member_count',v_count));return jsonb_build_object('ok',true,'group_id',p_group_id,'member_count',v_count);end;$function$;

create or replace function public.admin_enroll_room_group_subject_v205(p_group_id uuid,p_subject_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $function$
declare v_uid uuid:=auth.uid();v_count int:=0;
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED';end if;if not exists(select 1 from public.admin_room_groups where id=p_group_id and active) then raise exception 'ROOM_GROUP_NOT_FOUND_OR_INACTIVE';end if;if not exists(select 1 from public.subjects where id=p_subject_id and active and subject_type='subject') then raise exception 'SUBJECT_NOT_FOUND';end if;
 insert into public.subject_enrollments(subject_id,user_id,status,requested_at,decided_at,decided_by,note,updated_at) select p_subject_id,m.user_id,'approved',clock_timestamp(),clock_timestamp(),v_uid,'เพิ่มจากกลุ่มห้อง Admin V20.5',clock_timestamp() from public.admin_room_group_members m join public.profiles p on p.id=m.user_id and p.active and p.approval_status='approved' and p.role='user' where m.group_id=p_group_id and m.active on conflict(subject_id,user_id) do update set status='approved',decided_at=clock_timestamp(),decided_by=v_uid,note='อนุมัติจากกลุ่มห้อง Admin V20.5',updated_at=clock_timestamp();get diagnostics v_count=row_count;
 insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assignment_source,subject_enrollment_id) select w.id,se.user_id,v_uid,'subject_enrollment',se.id from public.subject_enrollments se join public.admin_room_group_members gm on gm.user_id=se.user_id and gm.group_id=p_group_id and gm.active join public.worksheets w on w.subject_id=se.subject_id and w.status='published' where se.subject_id=p_subject_id and se.status='approved' and private.can_learn(se.user_id) on conflict(worksheet_id,user_id) do update set assignment_source='subject_enrollment',subject_enrollment_id=excluded.subject_enrollment_id;
 insert into public.exam_assignments(exam_id,user_id,assigned_by,assignment_source,subject_enrollment_id) select e.id,se.user_id,v_uid,'subject_enrollment',se.id from public.subject_enrollments se join public.admin_room_group_members gm on gm.user_id=se.user_id and gm.group_id=p_group_id and gm.active join public.exams e on e.subject_id=se.subject_id and e.status='published' where se.subject_id=p_subject_id and se.status='approved' and private.can_learn(se.user_id) on conflict(exam_id,user_id) do update set assignment_source='subject_enrollment',subject_enrollment_id=excluded.subject_enrollment_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'ENROLL_ADMIN_ROOM_GROUP_SUBJECT','admin_room_group',p_group_id::text,jsonb_build_object('subject_id',p_subject_id,'affected',v_count));return jsonb_build_object('ok',true,'group_id',p_group_id,'subject_id',p_subject_id,'affected',v_count);
end;$function$;

revoke all on public.late_attendance_tokens,public.admin_room_groups,public.admin_room_group_members from anon;
revoke all on function public.admin_issue_late_attendance_barcode_v205(uuid,boolean) from public,anon;
revoke all on function public.my_scan_teacher_late_barcode_v205(uuid,uuid) from public,anon;
revoke all on function public.admin_upsert_room_group_v205(uuid,text,text,text,text,text,text,text,text,boolean) from public,anon;
revoke all on function public.admin_room_groups_v205() from public,anon;
revoke all on function public.admin_room_group_members_v205(uuid) from public,anon;
revoke all on function public.admin_replace_room_group_members_v205(uuid,uuid[]) from public,anon;
revoke all on function public.admin_enroll_room_group_subject_v205(uuid,uuid) from public,anon;
grant execute on function public.admin_issue_late_attendance_barcode_v205(uuid,boolean) to authenticated;
grant execute on function public.my_scan_teacher_late_barcode_v205(uuid,uuid) to authenticated;
grant execute on function public.admin_upsert_room_group_v205(uuid,text,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.admin_room_groups_v205() to authenticated;
grant execute on function public.admin_room_group_members_v205(uuid) to authenticated;
grant execute on function public.admin_replace_room_group_members_v205(uuid,uuid[]) to authenticated;
grant execute on function public.admin_enroll_room_group_subject_v205(uuid,uuid) to authenticated;
