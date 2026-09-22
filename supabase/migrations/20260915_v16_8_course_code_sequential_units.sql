-- DOC-FULL-NR V16.8 Course Code + Sequential Unit Unlock
-- Applied to Production on 2026-09-15.
-- Purpose:
-- 1) all subjects remain visible in the course catalog;
-- 2) CODE joins the subject immediately;
-- 3) all standard templates are shown as a safe learning roadmap;
-- 4) future units remain server-locked;
-- 5) Admin unlocks one lesson_sequence at a time;
-- 6) slides/resources are unreadable before their unit is unlocked.

create or replace function private.docnr_unit_no(p_settings jsonb)
returns integer language sql immutable strict set search_path=pg_catalog as $$
  select case when coalesce(p_settings->>'lesson_sequence','') ~ '^[0-9]+$'
    then (p_settings->>'lesson_sequence')::integer else null end
$$;

create or replace function private.assert_sequential_template_release(p_subject_id uuid,p_worksheet_ids uuid[])
returns void language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v_std_count integer;v_total_count integer;v_min_unit integer;v_max_unit integer;
begin
  select count(*),
         count(*) filter(where w.reference_code is not null and coalesce((w.settings->>'template_ready')::boolean,false)=true and private.docnr_unit_no(w.settings) is not null),
         min(private.docnr_unit_no(w.settings)) filter(where w.reference_code is not null and coalesce((w.settings->>'template_ready')::boolean,false)=true),
         max(private.docnr_unit_no(w.settings)) filter(where w.reference_code is not null and coalesce((w.settings->>'template_ready')::boolean,false)=true)
    into v_total_count,v_std_count,v_min_unit,v_max_unit
  from public.worksheets w where w.id=any(p_worksheet_ids) and w.subject_id=p_subject_id;
  if coalesce(v_std_count,0)=0 then return; end if;
  if v_std_count<>v_total_count then raise exception 'STANDARD_TEMPLATE_MIX_NOT_ALLOWED'; end if;
  if v_min_unit is null or v_min_unit<>v_max_unit then raise exception 'ONE_UNIT_AT_A_TIME_REQUIRED'; end if;
  if exists(select 1 from public.worksheets w where w.subject_id=p_subject_id and w.reference_code is not null
      and coalesce((w.settings->>'template_ready')::boolean,false)=true
      and private.docnr_unit_no(w.settings)<v_min_unit and w.status<>'published')
  then raise exception 'PREVIOUS_UNIT_LOCKED'; end if;
end $$;

create or replace function public.admin_unlock_subject_unit(
  p_subject_id uuid,p_unit_no integer,p_due_at timestamptz,p_open_at timestamptz default null,
  p_allow_late boolean default false,p_allow_resubmit boolean default false,p_max_attempts integer default 1
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_now timestamptz:=clock_timestamp();v_open timestamptz:=coalesce(p_open_at,v_now);
  v_subject public.subjects%rowtype;v_ids uuid[];v_count integer:=0;v_learners integer:=0;v_assignments integer:=0;v_already integer:=0;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_unit_no is null or p_unit_no<1 then raise exception 'INVALID_UNIT'; end if;
  if p_due_at is null or p_due_at<=v_open then raise exception 'INVALID_SCHEDULE'; end if;
  if coalesce(p_max_attempts,0)<1 then raise exception 'INVALID_MAX_ATTEMPTS'; end if;
  select * into v_subject from public.subjects where id=p_subject_id and active=true and subject_type='subject';
  if v_subject.id is null then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;

  select array_agg(w.id order by w.mode,w.reference_code),count(*),count(*) filter(where w.status='published')
    into v_ids,v_count,v_already from public.worksheets w
  where w.subject_id=p_subject_id and w.reference_code is not null
    and coalesce((w.settings->>'template_ready')::boolean,false)=true
    and private.docnr_unit_no(w.settings)=p_unit_no;
  if coalesce(v_count,0)=0 then raise exception 'UNIT_NOT_FOUND'; end if;
  perform private.assert_sequential_template_release(p_subject_id,v_ids);

  update public.worksheets set open_at=v_open,due_at=p_due_at,allow_late=coalesce(p_allow_late,false),
    allow_resubmit=coalesce(p_allow_resubmit,false),max_attempts=p_max_attempts,status='published',
    published_at=coalesce(published_at,v_now),updated_at=v_now where id=any(v_ids);

  select count(*) into v_learners from public.subject_enrollments e join public.profiles p on p.id=e.user_id
  where e.subject_id=p_subject_id and e.status='approved' and p.role='user' and p.active=true
    and p.approval_status='approved' and p.academic_status='studying';

  insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assigned_at,assignment_source,subject_enrollment_id)
  select w.id,e.user_id,v_uid,v_now,'subject_enrollment',e.id
  from public.worksheets w join public.subject_enrollments e on e.subject_id=w.subject_id and e.status='approved'
  join public.profiles p on p.id=e.user_id
  where w.id=any(v_ids) and p.role='user' and p.active=true and p.approval_status='approved' and p.academic_status='studying'
  on conflict(worksheet_id,user_id) do update set assignment_source='subject_enrollment',
    subject_enrollment_id=excluded.subject_enrollment_id,assigned_by=excluded.assigned_by,assigned_at=excluded.assigned_at;

  select count(*) into v_assignments from public.worksheet_assignments a where a.worksheet_id=any(v_ids);

  insert into public.app_notifications(user_id,type,title,message,metadata)
  select e.user_id,'subject_unit_unlocked','เปิดหน่วยเรียนใหม่',
    format('%s %s • หน่วยที่ %s พร้อมเรียนแล้ว',v_subject.code,v_subject.name,p_unit_no),
    jsonb_build_object('subject_id',p_subject_id,'unit_no',p_unit_no,'open_at',v_open,'due_at',p_due_at)
  from public.subject_enrollments e join public.profiles p on p.id=e.user_id
  where e.subject_id=p_subject_id and e.status='approved' and p.role='user' and p.active=true
    and p.approval_status='approved' and p.academic_status='studying';

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'UNLOCK_SUBJECT_UNIT','subject',p_subject_id::text,
    jsonb_build_object('unit_no',p_unit_no,'worksheet_count',v_count,'approved_learners',v_learners,
      'assignment_count',v_assignments,'open_at',v_open,'due_at',p_due_at,'already_published',v_already));

  return jsonb_build_object('ok',true,'subject_id',p_subject_id,'subject_code',v_subject.code,'subject_name',v_subject.name,
    'unit_no',p_unit_no,'worksheet_count',v_count,'approved_learners',v_learners,'assignment_count',v_assignments,
    'open_at',v_open,'due_at',p_due_at,'already_published',v_already=v_count);
end $$;

revoke all on function public.admin_unlock_subject_unit(uuid,integer,timestamptz,timestamptz,boolean,boolean,integer) from public,anon;
grant execute on function public.admin_unlock_subject_unit(uuid,integer,timestamptz,timestamptz,boolean,boolean,integer) to authenticated;

create or replace function public.admin_subject_unit_plan(p_subject_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_subject jsonb;v_units jsonb;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  select jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'color_hex',s.color_hex,'description',s.description)
    into v_subject from public.subjects s where s.id=p_subject_id and s.active=true and s.subject_type='subject';
  if v_subject is null then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;
  with base as (
    select w.id,w.title,w.reference_code,w.mode,w.status,w.open_at,w.due_at,private.docnr_unit_no(w.settings) unit_no,
      coalesce(w.settings->>'learning_goal','') learning_goal
    from public.worksheets w where w.subject_id=p_subject_id and w.reference_code is not null
      and coalesce((w.settings->>'template_ready')::boolean,false)=true and private.docnr_unit_no(w.settings) is not null
  ),units as (
    select b.unit_no,bool_and(b.status='published') unlocked,min(b.open_at) filter(where b.status='published') open_at,
      max(b.due_at) filter(where b.status='published') due_at,
      jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'reference_code',b.reference_code,'mode',b.mode,
        'status',b.status,'learning_goal',b.learning_goal,'open_at',b.open_at,'due_at',b.due_at,
        'resource_count',(select count(*) from public.subject_files sf where sf.subject_id=p_subject_id
          and (sf.worksheet_id=b.id or (sf.worksheet_id is null and sf.sequence_no=b.unit_no))))
        order by b.mode,b.reference_code) worksheets
    from base b group by b.unit_no
  )
  select coalesce(jsonb_agg(jsonb_build_object('unit_no',u.unit_no,'unlocked',u.unlocked,'open_at',u.open_at,
    'due_at',u.due_at,'worksheets',u.worksheets) order by u.unit_no),'[]'::jsonb) into v_units from units u;
  return jsonb_build_object('subject',v_subject,'units',v_units,'server_time',clock_timestamp());
end $$;
revoke all on function public.admin_subject_unit_plan(uuid) from public,anon;
grant execute on function public.admin_subject_unit_plan(uuid) to authenticated;

create or replace function public.my_subject_learning_path(p_subject_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_subject jsonb;v_units jsonb;
begin
  if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED'; end if;
  if not exists(select 1 from public.subject_enrollments e where e.subject_id=p_subject_id and e.user_id=v_uid and e.status='approved')
    then raise exception 'STUDENT_NOT_APPROVED_FOR_SUBJECT'; end if;
  select jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'color_hex',s.color_hex,'description',s.description,
    'semester',s.semester,'academic_year',s.academic_year) into v_subject
  from public.subjects s where s.id=p_subject_id and s.active=true and s.subject_type='subject';
  if v_subject is null then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;

  with base as (
    select w.id,w.title,w.reference_code,w.mode,w.status,w.open_at,w.due_at,private.docnr_unit_no(w.settings) unit_no,
      case when w.status='published' and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid)
        then coalesce(w.settings->>'learning_goal','') else null end learning_goal,
      (w.status='published' and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid)) unlocked
    from public.worksheets w where w.subject_id=p_subject_id and w.reference_code is not null
      and coalesce((w.settings->>'template_ready')::boolean,false)=true and private.docnr_unit_no(w.settings) is not null
  ),units as (
    select b.unit_no,bool_or(b.unlocked) unlocked,min(b.open_at) filter(where b.unlocked) open_at,
      max(b.due_at) filter(where b.unlocked) due_at,
      jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'reference_code',b.reference_code,'mode',b.mode,
        'unlocked',b.unlocked,'open_at',case when b.unlocked then b.open_at else null end,
        'due_at',case when b.unlocked then b.due_at else null end,'learning_goal',b.learning_goal)
        order by b.mode,b.reference_code) worksheets,
      case when bool_or(b.unlocked) then (
        select coalesce(jsonb_agg(jsonb_build_object('id',sf.id,'worksheet_id',sf.worksheet_id,
          'resource_kind',sf.resource_kind,'sequence_no',sf.sequence_no,'original_name',sf.original_name,
          'storage_path',sf.storage_path,'mime_type',sf.mime_type,'size_bytes',sf.size_bytes)
          order by sf.created_at),'[]'::jsonb)
        from public.subject_files sf where sf.subject_id=p_subject_id
          and (sf.sequence_no=b.unit_no or sf.worksheet_id in (select b2.id from base b2 where b2.unit_no=b.unit_no and b2.unlocked))
      ) else '[]'::jsonb end resources
    from base b group by b.unit_no
  )
  select coalesce(jsonb_agg(jsonb_build_object('unit_no',u.unit_no,'unlocked',u.unlocked,'open_at',u.open_at,
    'due_at',u.due_at,'worksheets',u.worksheets,'resources',u.resources) order by u.unit_no),'[]'::jsonb)
  into v_units from units u;
  return jsonb_build_object('subject',v_subject,'units',v_units,'server_time',clock_timestamp());
end $$;
revoke all on function public.my_subject_learning_path(uuid) from public,anon;
grant execute on function public.my_subject_learning_path(uuid) to authenticated;

create or replace function public.publish_subject_worksheets(
  p_subject_id uuid,
  p_worksheet_ids uuid[],
  p_open_at timestamptz,
  p_due_at timestamptz,
  p_allow_late boolean default false,
  p_allow_resubmit boolean default false,
  p_max_attempts integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_requested integer;
  v_valid integer;
  v_learners integer;
  v_assignments integer;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_open_at is null or p_due_at is null or p_due_at<=p_open_at then raise exception 'INVALID_SCHEDULE'; end if;
  if coalesce(p_max_attempts,0)<1 then raise exception 'INVALID_MAX_ATTEMPTS'; end if;
  if coalesce(array_length(p_worksheet_ids,1),0)=0 then raise exception 'NO_WORKSHEETS_SELECTED'; end if;

  select count(distinct x) into v_requested from unnest(p_worksheet_ids) x;
  select count(*) into v_valid from public.worksheets w where w.id=any(p_worksheet_ids) and w.subject_id=p_subject_id;
  if v_valid<>v_requested then raise exception 'WORKSHEET_SUBJECT_MISMATCH'; end if;

  perform private.assert_sequential_template_release(p_subject_id,p_worksheet_ids);

  update public.worksheets
  set open_at=p_open_at,due_at=p_due_at,
      allow_late=coalesce(p_allow_late,false),allow_resubmit=coalesce(p_allow_resubmit,false),
      max_attempts=p_max_attempts,status='published',published_at=coalesce(published_at,clock_timestamp()),
      reference_code=coalesce(reference_code,upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)))
  where id=any(p_worksheet_ids) and subject_id=p_subject_id;

  select count(*) into v_learners
  from public.subject_enrollments e join public.profiles p on p.id=e.user_id
  where e.subject_id=p_subject_id and e.status='approved'
    and p.role='user' and p.active=true and p.approval_status='approved' and p.academic_status='studying';

  insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assignment_source,subject_enrollment_id)
  select w.id,e.user_id,v_uid,'subject_enrollment',e.id
  from public.worksheets w
  join public.subject_enrollments e on e.subject_id=w.subject_id and e.status='approved'
  join public.profiles p on p.id=e.user_id
  where w.id=any(p_worksheet_ids) and w.subject_id=p_subject_id
    and p.role='user' and p.active=true and p.approval_status='approved' and p.academic_status='studying'
  on conflict(worksheet_id,user_id) do update
    set assignment_source='subject_enrollment',subject_enrollment_id=excluded.subject_enrollment_id;

  select count(*) into v_assignments
  from public.worksheet_assignments a
  where a.worksheet_id=any(p_worksheet_ids)
    and exists(select 1 from public.subject_enrollments e join public.profiles p on p.id=e.user_id
      where e.id=a.subject_enrollment_id and e.subject_id=p_subject_id and e.status='approved'
        and p.active=true and p.approval_status='approved' and p.academic_status='studying');

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'PUBLISH_SUBJECT_WORKSHEETS','subject',p_subject_id::text,
    jsonb_build_object('worksheet_count',v_valid,'approved_learners',v_learners,
      'assignment_count',v_assignments,'open_at',p_open_at,'due_at',p_due_at));

  return jsonb_build_object('subject_id',p_subject_id,'worksheet_count',v_valid,
    'approved_learners',v_learners,'assignment_count',v_assignments,'open_at',p_open_at,'due_at',p_due_at);
end
$$;


drop policy if exists subject_files_read on public.subject_files;
create policy subject_files_read on public.subject_files for select to authenticated using(
  private.is_admin()
  or (
    private.is_active_user((select auth.uid()))
    and exists(select 1 from public.subject_enrollments e where e.subject_id=subject_files.subject_id
      and e.user_id=(select auth.uid()) and e.status='approved')
    and (
      (subject_files.worksheet_id is not null and exists(
        select 1 from public.worksheets w join public.worksheet_assignments a on a.worksheet_id=w.id
        where w.id=subject_files.worksheet_id and w.status='published' and a.user_id=(select auth.uid())
      ))
      or
      (subject_files.worksheet_id is null and subject_files.sequence_no is not null and exists(
        select 1 from public.worksheets w join public.worksheet_assignments a on a.worksheet_id=w.id
        where w.subject_id=subject_files.subject_id and w.status='published' and a.user_id=(select auth.uid())
          and private.docnr_unit_no(w.settings)=subject_files.sequence_no
      ))
    )
  )
);

drop policy if exists nangrong_subject_files_assigned_read on storage.objects;
create policy nangrong_subject_files_assigned_read on storage.objects for select to authenticated using(
  bucket_id='subject-files' and (
    private.is_admin()
    or exists(
      select 1 from public.subject_files sf
      join public.subject_enrollments e on e.subject_id=sf.subject_id and e.user_id=(select auth.uid()) and e.status='approved'
      where sf.storage_path=objects.name and (
        (sf.worksheet_id is not null and exists(
          select 1 from public.worksheets w join public.worksheet_assignments a on a.worksheet_id=w.id
          where w.id=sf.worksheet_id and w.status='published' and a.user_id=(select auth.uid())
        ))
        or
        (sf.worksheet_id is null and sf.sequence_no is not null and exists(
          select 1 from public.worksheets w join public.worksheet_assignments a on a.worksheet_id=w.id
          where w.subject_id=sf.subject_id and w.status='published' and a.user_id=(select auth.uid())
            and private.docnr_unit_no(w.settings)=sf.sequence_no
        ))
      )
    )
  )
);
create index if not exists worksheets_subject_unit_status_idx
on public.worksheets(subject_id,((settings->>'lesson_sequence')),status) where reference_code is not null;
notify pgrst,'reload schema';

create or replace function public.admin_course_flow_health_v168()
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_subjects integer;
  v_join_codes integer;
  v_templates integer;
  v_complete_paths integer;
  v_rpc_count integer;
  v_policy_ok boolean;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  select count(*) into v_subjects from public.subjects where active=true and subject_type='subject';
  select count(*) into v_join_codes from public.subject_join_codes where active=true;
  select count(*) into v_templates from public.worksheets
    where reference_code is not null and coalesce((settings->>'template_ready')::boolean,false)=true;
  select count(*) into v_complete_paths from (
    select w.subject_id
    from public.worksheets w join public.subjects s on s.id=w.subject_id
    where s.active=true and s.subject_type='subject' and w.reference_code is not null
      and coalesce((w.settings->>'template_ready')::boolean,false)=true
      and private.docnr_unit_no(w.settings) is not null
    group by w.subject_id
    having count(distinct private.docnr_unit_no(w.settings))=13
  ) q;
  select count(*) into v_rpc_count from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname=any(array['join_subject_with_code','admin_unlock_subject_unit','admin_subject_unit_plan','my_subject_learning_path']);
  select exists(select 1 from pg_policies where schemaname='public' and tablename='subject_files' and policyname='subject_files_read')
    and exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='nangrong_subject_files_assigned_read')
    into v_policy_ok;
  return jsonb_build_object(
    'version','V16.8-COURSE-SEQUENTIAL-UNITS','server_time',clock_timestamp(),
    'active_subjects',v_subjects,'active_join_codes',v_join_codes,'standard_templates',v_templates,
    'subjects_with_13_units',v_complete_paths,'required_rpcs',v_rpc_count,'locked_resource_policy_ok',v_policy_ok,
    'course_flow_ok',(v_subjects=11 and v_join_codes=11 and v_templates=198 and v_complete_paths=11 and v_rpc_count=4 and v_policy_ok)
  );
end
$$;
revoke all on function public.admin_course_flow_health_v168() from public,anon;
grant execute on function public.admin_course_flow_health_v168() to authenticated;