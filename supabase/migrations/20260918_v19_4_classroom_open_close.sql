-- DOC-FULL-NR V19.4
-- Subject classroom open/close state for Admin/User UX.
begin;

create table if not exists public.subject_classroom_state_v194 (
  subject_id uuid primary key references public.subjects(id) on delete cascade,
  is_open boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.subject_classroom_state_v194 enable row level security;
revoke all on table public.subject_classroom_state_v194 from public,anon,authenticated;
grant all on table public.subject_classroom_state_v194 to service_role;

insert into public.subject_classroom_state_v194(subject_id,is_open)
select id,true from public.subjects
where active=true and subject_type='subject'
on conflict(subject_id) do nothing;

create or replace function private.subject_classroom_is_open_v194(p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,private,pg_temp
as $$
  select coalesce((select s.is_open from public.subject_classroom_state_v194 s where s.subject_id=p_subject_id),true)
$$;

revoke all on function private.subject_classroom_is_open_v194(uuid) from public,anon,authenticated;
grant execute on function private.subject_classroom_is_open_v194(uuid) to service_role,postgres;

create or replace function public.subject_classroom_states_v194()
returns table(subject_id uuid,is_open boolean,updated_at timestamptz)
language sql
stable
security definer
set search_path=public,private,pg_temp
as $$
  select s.id,
         private.subject_classroom_is_open_v194(s.id),
         coalesce(cs.updated_at,s.updated_at)
  from public.subjects s
  left join public.subject_classroom_state_v194 cs on cs.subject_id=s.id
  where s.active=true and s.subject_type='subject'
    and auth.uid() is not null
    and private.is_active_user(auth.uid())
  order by s.code
$$;

revoke all on function public.subject_classroom_states_v194() from public,anon;
grant execute on function public.subject_classroom_states_v194() to authenticated,service_role;

create or replace function public.admin_set_subject_classroom_open_v194(
  p_subject_id uuid,
  p_is_open boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_subject public.subjects%rowtype;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_subject from public.subjects where id=p_subject_id and active=true and subject_type='subject';
  if v_subject.id is null then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;

  insert into public.subject_classroom_state_v194(subject_id,is_open,updated_by,updated_at)
  values(p_subject_id,coalesce(p_is_open,false),v_uid,clock_timestamp())
  on conflict(subject_id) do update
    set is_open=excluded.is_open,updated_by=v_uid,updated_at=clock_timestamp();

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,
         case when coalesce(p_is_open,false) then 'OPEN_SUBJECT_CLASSROOM_V194' else 'CLOSE_SUBJECT_CLASSROOM_V194' end,
         'subject',p_subject_id::text,
         jsonb_build_object('subject_code',v_subject.code,'is_open',coalesce(p_is_open,false)));

  return jsonb_build_object(
    'ok',true,'subject_id',p_subject_id,'subject_code',v_subject.code,
    'subject_name',v_subject.name,'is_open',coalesce(p_is_open,false),
    'updated_at',clock_timestamp()
  );
end;
$$;

revoke all on function public.admin_set_subject_classroom_open_v194(uuid,boolean) from public,anon;
grant execute on function public.admin_set_subject_classroom_open_v194(uuid,boolean) to authenticated,service_role;

create or replace function public.request_subject_enrollment(p_subject_id uuid)
returns public.subject_enrollments
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_row public.subject_enrollments%rowtype; v_ok boolean;
begin
  if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED'; end if;
  select exists(select 1 from public.subjects s where s.id=p_subject_id and s.active=true and s.subject_type='subject') into v_ok;
  if not v_ok then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;
  if not private.subject_classroom_is_open_v194(p_subject_id) then raise exception 'CLASSROOM_CLOSED'; end if;

  insert into public.subject_enrollments(subject_id,user_id,status,requested_at,decided_at,decided_by,note)
  values(p_subject_id,v_uid,'pending',clock_timestamp(),null,null,null)
  on conflict(subject_id,user_id) do update set
    status=case when public.subject_enrollments.status='approved' then 'approved' else 'pending' end,
    requested_at=case when public.subject_enrollments.status='approved' then public.subject_enrollments.requested_at else clock_timestamp() end,
    decided_at=case when public.subject_enrollments.status='approved' then public.subject_enrollments.decided_at else null end,
    decided_by=case when public.subject_enrollments.status='approved' then public.subject_enrollments.decided_by else null end,
    note=case when public.subject_enrollments.status='approved' then public.subject_enrollments.note else null end,
    updated_at=clock_timestamp()
  returning * into v_row;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'REQUEST_SUBJECT_ENROLLMENT','subject_enrollment',v_row.id::text,
    jsonb_build_object('subject_id',p_subject_id,'status',v_row.status));

  return v_row;
end;
$$;

create or replace function public.join_subject_with_code(p_subject_id uuid,p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_code text:=upper(regexp_replace(trim(coalesce(p_code,'')),'[^A-Za-z0-9]','','g'));
  v_row public.subject_enrollments%rowtype;
  v_subject public.subjects%rowtype;
  v_existing text;
  v_assigned int:=0;
  v_new boolean:=false;
begin
  if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtext(v_uid::text||':'||p_subject_id::text));
  select * into v_subject from public.subjects where id=p_subject_id and active=true and subject_type='subject';
  if v_subject.id is null then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;
  if not private.subject_classroom_is_open_v194(p_subject_id) then raise exception 'CLASSROOM_CLOSED'; end if;
  if not exists(select 1 from public.subject_join_codes where subject_id=p_subject_id and active=true and join_code=v_code) then raise exception 'JOIN_CODE_INVALID'; end if;

  select status into v_existing from public.subject_enrollments where subject_id=p_subject_id and user_id=v_uid;
  v_new:=coalesce(v_existing,'')<>'approved';

  insert into public.subject_enrollments(subject_id,user_id,status,requested_at,decided_at,decided_by,note,created_at,updated_at)
  values(p_subject_id,v_uid,'approved',clock_timestamp(),clock_timestamp(),null,'เข้าร่วมด้วยรหัสรายวิชา',clock_timestamp(),clock_timestamp())
  on conflict(subject_id,user_id) do update set
    status='approved',decided_at=clock_timestamp(),decided_by=null,note='เข้าร่วมด้วยรหัสรายวิชา',updated_at=clock_timestamp()
  returning * into v_row;

  insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assigned_at,assignment_source,subject_enrollment_id)
  select w.id,v_uid,null,clock_timestamp(),'subject_enrollment',v_row.id
  from public.worksheets w
  where w.subject_id=p_subject_id and w.status='published'
    and coalesce((w.settings->>'template_ready')::boolean,false)=true
  on conflict(worksheet_id,user_id) do update
    set subject_enrollment_id=excluded.subject_enrollment_id,assignment_source='subject_enrollment';
  get diagnostics v_assigned=row_count;

  if v_new then
    insert into public.app_notifications(user_id,type,title,message,metadata)
    values(v_uid,'subject_joined','เข้าเรียนสำเร็จ',
      format('%s %s พร้อมใช้งานแล้ว',v_subject.code,v_subject.name),
      jsonb_build_object('subject_id',p_subject_id));
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'JOIN_SUBJECT_WITH_CODE_HARDENED','subject_enrollment',v_row.id::text,
    jsonb_build_object('subject_id',p_subject_id,'subject_code',v_subject.code,
      'already_member',not v_new,'assignments_touched',v_assigned));

  return jsonb_build_object('ok',true,'status','approved','subject_id',p_subject_id,
    'subject_code',v_subject.code,'subject_name',v_subject.name,
    'already_member',not v_new,'assignments_touched',v_assigned,'server_time',clock_timestamp());
end;
$$;

commit;
