-- DOC-FULL-NR V21.0 MAJOR STABILITY / PRODUCTION ALIGNMENT
-- Safe additive alignment from a V20.5 package to the V20.6+ production contract
-- used by the V21 frontend. Existing academic history is preserved.

-- ---------------------------------------------------------------------------
-- 1) Teacher role and scoped teaching model
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='app_role' and e.enumlabel='teacher'
  ) then
    alter type public.app_role add value 'teacher';
  end if;
end $$;

create table if not exists public.teacher_teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  active boolean not null default true,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(teacher_id,subject_id,classroom_id)
);
create index if not exists teacher_teaching_assignments_teacher_idx on public.teacher_teaching_assignments(teacher_id,active);
create index if not exists teacher_teaching_assignments_scope_idx on public.teacher_teaching_assignments(subject_id,classroom_id,active);
alter table public.teacher_teaching_assignments enable row level security;
revoke all on public.teacher_teaching_assignments from anon,authenticated;

drop policy if exists teacher_teaching_assignments_rpc_only_deny on public.teacher_teaching_assignments;
create policy teacher_teaching_assignments_rpc_only_deny on public.teacher_teaching_assignments for all to authenticated using(false) with check(false);

alter table public.admin_room_groups add column if not exists classroom_id uuid references public.classrooms(id) on delete set null;
create unique index if not exists admin_room_groups_classroom_unique_idx on public.admin_room_groups(classroom_id) where classroom_id is not null;

create table if not exists public.admin_room_group_subjects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.admin_room_groups(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  active boolean not null default true,
  bound_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(group_id,subject_id)
);
create index if not exists admin_room_group_subjects_group_idx on public.admin_room_group_subjects(group_id,active);
create index if not exists admin_room_group_subjects_subject_idx on public.admin_room_group_subjects(subject_id,active);
alter table public.admin_room_group_subjects enable row level security;
revoke all on public.admin_room_group_subjects from anon,authenticated;
drop policy if exists admin_room_group_subjects_rpc_only_deny on public.admin_room_group_subjects;
create policy admin_room_group_subjects_rpc_only_deny on public.admin_room_group_subjects for all to authenticated using(false) with check(false);

create table if not exists public.admin_room_group_subject_members (
  id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references public.admin_room_group_subjects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  enrollment_id uuid references public.subject_enrollments(id) on delete set null,
  managed_enrollment boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(binding_id,user_id)
);
create index if not exists admin_room_group_subject_members_user_idx on public.admin_room_group_subject_members(user_id,active);
create index if not exists admin_room_group_subject_members_enrollment_idx on public.admin_room_group_subject_members(enrollment_id) where enrollment_id is not null;
alter table public.admin_room_group_subject_members enable row level security;
revoke all on public.admin_room_group_subject_members from anon,authenticated;
drop policy if exists admin_room_group_subject_members_rpc_only_deny on public.admin_room_group_subject_members;
create policy admin_room_group_subject_members_rpc_only_deny on public.admin_room_group_subject_members for all to authenticated using(false) with check(false);

create or replace function private.is_teacher(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path='public','private','pg_temp' as $$
  select exists(select 1 from public.profiles p where p.id=p_user and p.role::text='teacher' and p.active=true and p.approval_status='approved');
$$;

create or replace function private.can_teach_subject(p_subject_id uuid,p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path='public','private','pg_temp' as $$
  select private.is_admin(p_user) or exists(
    select 1 from public.teacher_teaching_assignments t
    where t.teacher_id=p_user and t.subject_id=p_subject_id and t.active
  );
$$;

create or replace function private.can_teach_attendance(p_classroom_id uuid,p_subject_id uuid,p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path='public','private','pg_temp' as $$
  select private.is_admin(p_user) or exists(
    select 1 from public.teacher_teaching_assignments t
    where t.teacher_id=p_user and t.classroom_id=p_classroom_id and t.subject_id=p_subject_id and t.active
  );
$$;

create or replace function private.can_teach_student_subject(p_subject_id uuid,p_student_id uuid,p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path='public','private','pg_temp' as $$
  select private.is_admin(p_user) or exists(
    select 1 from public.teacher_teaching_assignments t
    join public.classroom_memberships cm on cm.classroom_id=t.classroom_id and cm.user_id=p_student_id and cm.active
    where t.teacher_id=p_user and t.subject_id=p_subject_id and t.active
  );
$$;

revoke all on function private.is_teacher(uuid) from public,anon,authenticated;
revoke all on function private.can_teach_subject(uuid,uuid) from public,anon,authenticated;
revoke all on function private.can_teach_attendance(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.can_teach_student_subject(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.is_teacher(uuid) to service_role;
grant execute on function private.can_teach_subject(uuid,uuid) to service_role;
grant execute on function private.can_teach_attendance(uuid,uuid,uuid) to service_role;
grant execute on function private.can_teach_student_subject(uuid,uuid,uuid) to service_role;


-- Teacher-aware read policies used by the existing feature renderer.
-- Helpers remain callable by authenticated because RLS evaluates them in the
-- caller context. They live in the non-exposed private schema and validate auth.uid().
grant execute on function private.is_teacher(uuid) to authenticated;
grant execute on function private.can_teach_subject(uuid,uuid) to authenticated;
grant execute on function private.can_teach_attendance(uuid,uuid,uuid) to authenticated;
grant execute on function private.can_teach_student_subject(uuid,uuid,uuid) to authenticated;

drop policy if exists subjects_read on public.subjects;
create policy subjects_read on public.subjects for select to authenticated using (
  private.is_admin()
  or private.can_teach_subject(id,auth.uid())
  or (private.is_active_user(auth.uid()) and active=true and subject_type='subject')
  or (private.is_active_user(auth.uid()) and exists(
    select 1 from public.worksheets w join public.worksheet_assignments a on a.worksheet_id=w.id
    where w.subject_id=subjects.id and a.user_id=auth.uid() and w.status='published'
  ))
);

drop policy if exists classrooms_read on public.classrooms;
create policy classrooms_read on public.classrooms for select to authenticated using (
  private.is_admin()
  or exists(select 1 from public.teacher_teaching_assignments t where t.teacher_id=auth.uid() and t.classroom_id=classrooms.id and t.active)
  or (private.is_active_user(auth.uid()) and exists(select 1 from public.classroom_memberships m where m.classroom_id=classrooms.id and m.user_id=auth.uid() and m.active))
);

drop policy if exists attendance_sessions_read on public.attendance_sessions;
create policy attendance_sessions_read on public.attendance_sessions for select to authenticated using (
  private.is_admin()
  or private.is_classroom_leader(classroom_id,auth.uid())
  or private.can_teach_attendance(classroom_id,subject_id,auth.uid())
);

drop policy if exists attendance_records_read on public.attendance_records;
create policy attendance_records_read on public.attendance_records for select to authenticated using (
  private.is_admin()
  or (private.is_active_user(auth.uid()) and user_id=auth.uid())
  or exists(
    select 1 from public.attendance_sessions s
    where s.id=attendance_records.session_id
      and (private.is_classroom_leader(s.classroom_id,auth.uid()) or private.can_teach_attendance(s.classroom_id,s.subject_id,auth.uid()))
  )
);

create or replace function public.my_teacher_assignments_v206()
returns table(assignment_id uuid,subject_id uuid,subject_code text,subject_name text,classroom_id uuid,classroom_name text,active boolean)
language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
  if auth.uid() is null or not private.is_teacher(auth.uid()) then raise exception 'TEACHER_REQUIRED'; end if;
  return query select t.id,s.id,s.code,s.name,c.id,c.name,t.active
  from public.teacher_teaching_assignments t join public.subjects s on s.id=t.subject_id join public.classrooms c on c.id=t.classroom_id
  where t.teacher_id=auth.uid() and t.active order by s.code,c.name;
end $$;

create or replace function public.admin_teacher_assignments_v206()
returns table(assignment_id uuid,teacher_id uuid,teacher_name text,subject_id uuid,subject_code text,subject_name text,classroom_id uuid,classroom_name text,active boolean)
language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
  if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED'; end if;
  return query select t.id,t.teacher_id,p.full_name,t.subject_id,s.code,s.name,t.classroom_id,c.name,t.active
  from public.teacher_teaching_assignments t join public.profiles p on p.id=t.teacher_id join public.subjects s on s.id=t.subject_id join public.classrooms c on c.id=t.classroom_id
  order by p.full_name,s.code,c.name;
end $$;

create or replace function public.admin_set_teacher_assignment_v206(p_teacher_id uuid,p_subject_id uuid,p_classroom_id uuid,p_active boolean default true)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();v_id uuid;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=p_teacher_id and role::text='teacher' and active and approval_status='approved') then raise exception 'TEACHER_ACCOUNT_REQUIRED'; end if;
  if not exists(select 1 from public.subjects where id=p_subject_id and active and subject_type='subject') then raise exception 'SUBJECT_NOT_FOUND'; end if;
  if not exists(select 1 from public.classrooms where id=p_classroom_id and active) then raise exception 'CLASSROOM_NOT_FOUND'; end if;
  insert into public.teacher_teaching_assignments(teacher_id,subject_id,classroom_id,active,assigned_by)
  values(p_teacher_id,p_subject_id,p_classroom_id,coalesce(p_active,true),v_uid)
  on conflict(teacher_id,subject_id,classroom_id) do update set active=excluded.active,assigned_by=v_uid,updated_at=clock_timestamp()
  returning id into v_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'SET_TEACHER_ASSIGNMENT','teacher_teaching_assignment',v_id::text,jsonb_build_object('teacher_id',p_teacher_id,'subject_id',p_subject_id,'classroom_id',p_classroom_id,'active',p_active));
  return jsonb_build_object('ok',true,'assignment_id',v_id);
end $$;

-- ---------------------------------------------------------------------------
-- 2) Room-group persistent sync
-- ---------------------------------------------------------------------------
create or replace function private.sync_admin_room_group_v206(p_group_id uuid,p_actor uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare
  g public.admin_room_groups%rowtype;
  v_class uuid;
  v_binding record;
  v_user record;
  v_track record;
  v_se public.subject_enrollments%rowtype;
  v_count int:=0;
  v_withdrawn int:=0;
begin
  select * into g from public.admin_room_groups where id=p_group_id for update;
  if not found then raise exception 'ROOM_GROUP_NOT_FOUND'; end if;

  if g.classroom_id is null then
    select c.id into v_class from public.classrooms c
    where c.name=g.name and coalesce(c.academic_year,'')=coalesce(g.academic_year,'') and coalesce(c.semester,'')=coalesce(g.semester,'') limit 1;
    if v_class is null then
      insert into public.classrooms(name,level,academic_year,semester,active,description)
      values(g.name,g.level,g.academic_year,g.semester,g.active,'สร้างและ Sync จาก Admin Room Group '||g.code||' • V21.0') returning id into v_class;
    end if;
    update public.admin_room_groups set classroom_id=v_class,updated_at=clock_timestamp() where id=g.id;
    g.classroom_id:=v_class;
  else
    update public.classrooms set name=g.name,level=g.level,academic_year=g.academic_year,semester=g.semester,active=g.active,updated_at=clock_timestamp() where id=g.classroom_id;
  end if;

  insert into public.classroom_memberships(classroom_id,user_id,seat_number,active)
  select g.classroom_id,m.user_id,m.seat_number,true from public.admin_room_group_members m where m.group_id=g.id and m.active
  on conflict(classroom_id,user_id) do update set active=true,seat_number=excluded.seat_number;

  update public.classroom_memberships cm set active=false
  where cm.classroom_id=g.classroom_id and cm.active
    and not exists(select 1 from public.admin_room_group_members m where m.group_id=g.id and m.user_id=cm.user_id and m.active);

  for v_binding in select b.* from public.admin_room_group_subjects b where b.group_id=g.id loop
    if v_binding.active then
      for v_user in
        select m.user_id from public.admin_room_group_members m
        join public.profiles p on p.id=m.user_id
        where m.group_id=g.id and m.active and p.role::text='user' and p.active and p.approval_status='approved'
      loop
        select * into v_se from public.subject_enrollments where subject_id=v_binding.subject_id and user_id=v_user.user_id for update;
        if v_se.id is null then
          insert into public.subject_enrollments(subject_id,user_id,status,requested_at,decided_at,decided_by,note,updated_at)
          values(v_binding.subject_id,v_user.user_id,'approved',clock_timestamp(),clock_timestamp(),p_actor,'V21.0 room-group managed enrollment',clock_timestamp()) returning * into v_se;
          insert into public.admin_room_group_subject_members(binding_id,user_id,enrollment_id,managed_enrollment,active)
          values(v_binding.id,v_user.user_id,v_se.id,true,true)
          on conflict(binding_id,user_id) do update set enrollment_id=excluded.enrollment_id,managed_enrollment=true,active=true,updated_at=clock_timestamp();
        else
          if v_se.status<>'approved' then
            update public.subject_enrollments set status='approved',decided_at=clock_timestamp(),decided_by=p_actor,
              note=case when coalesce(note,'') like 'V20.6 room-group managed enrollment%' or coalesce(note,'') like 'V21.0 room-group managed enrollment%' then note else coalesce(note,'') end,
              updated_at=clock_timestamp() where id=v_se.id returning * into v_se;
          end if;
          insert into public.admin_room_group_subject_members(binding_id,user_id,enrollment_id,managed_enrollment,active)
          values(v_binding.id,v_user.user_id,v_se.id,false,true)
          on conflict(binding_id,user_id) do update set enrollment_id=excluded.enrollment_id,active=true,updated_at=clock_timestamp();
        end if;
        insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assignment_source,subject_enrollment_id)
        select w.id,v_user.user_id,p_actor,'subject_enrollment',v_se.id from public.worksheets w where w.subject_id=v_binding.subject_id and w.status='published'
        on conflict(worksheet_id,user_id) do update set assignment_source='subject_enrollment',subject_enrollment_id=excluded.subject_enrollment_id;
        insert into public.exam_assignments(exam_id,user_id,assigned_by,assignment_source,subject_enrollment_id)
        select e.id,v_user.user_id,p_actor,'subject_enrollment',v_se.id from public.exams e where e.subject_id=v_binding.subject_id and e.status='published'
        on conflict(exam_id,user_id) do update set assignment_source='subject_enrollment',subject_enrollment_id=excluded.subject_enrollment_id;
        v_count:=v_count+1;
      end loop;
    end if;

    for v_track in
      select sm.* from public.admin_room_group_subject_members sm
      where sm.binding_id=v_binding.id and sm.active
        and (not v_binding.active or not exists(
          select 1 from public.admin_room_group_members m where m.group_id=g.id and m.user_id=sm.user_id and m.active
        ))
      for update
    loop
      update public.admin_room_group_subject_members set active=false,updated_at=clock_timestamp() where id=v_track.id;
      if v_track.managed_enrollment and v_track.enrollment_id is not null
         and not exists(
           select 1 from public.admin_room_group_subject_members other_sm
           join public.admin_room_group_subjects other_b on other_b.id=other_sm.binding_id
           where other_sm.enrollment_id=v_track.enrollment_id and other_sm.user_id=v_track.user_id
             and other_sm.active and other_b.active and other_sm.id<>v_track.id
         )
         and exists(
           select 1 from public.subject_enrollments se where se.id=v_track.enrollment_id and se.status='approved'
             and (coalesce(se.note,'') like 'V20.6 room-group managed enrollment%' or coalesce(se.note,'') like 'V21.0 room-group managed enrollment%')
         )
      then
        update public.subject_enrollments set status='withdrawn',decided_at=clock_timestamp(),decided_by=p_actor,
          note='V21.0 room-group auto-withdrawn (membership/binding removed)',updated_at=clock_timestamp()
        where id=v_track.enrollment_id;
        delete from public.worksheet_assignments a using public.worksheets w
        where a.worksheet_id=w.id and w.subject_id=v_binding.subject_id and a.user_id=v_track.user_id
          and a.subject_enrollment_id=v_track.enrollment_id
          and not exists(select 1 from public.submissions s where s.worksheet_id=a.worksheet_id and s.user_id=v_track.user_id);
        update public.worksheet_assignments a set assignment_source='subject_history',subject_enrollment_id=null
        from public.worksheets w where a.worksheet_id=w.id and w.subject_id=v_binding.subject_id
          and a.user_id=v_track.user_id and a.subject_enrollment_id=v_track.enrollment_id;
        delete from public.exam_assignments a using public.exams e
        where a.exam_id=e.id and e.subject_id=v_binding.subject_id and a.user_id=v_track.user_id
          and a.subject_enrollment_id=v_track.enrollment_id
          and not exists(select 1 from public.exam_attempts t where t.exam_id=a.exam_id and t.user_id=v_track.user_id);
        update public.exam_assignments a set assignment_source='subject_history',subject_enrollment_id=null
        from public.exams e where a.exam_id=e.id and e.subject_id=v_binding.subject_id
          and a.user_id=v_track.user_id and a.subject_enrollment_id=v_track.enrollment_id;
        v_withdrawn:=v_withdrawn+1;
      end if;
    end loop;
  end loop;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_actor,'SYNC_ADMIN_ROOM_GROUP_V21','admin_room_group',g.id::text,
    jsonb_build_object('classroom_id',g.classroom_id,'synced_members',v_count,'auto_withdrawn',v_withdrawn));
  return jsonb_build_object('ok',true,'group_id',g.id,'classroom_id',g.classroom_id,'synced_members',v_count,'auto_withdrawn',v_withdrawn);
end $$;

create or replace function public.admin_room_groups_v206()
returns table(id uuid,code text,name text,academic_year text,semester text,level text,department text,major text,description text,active boolean,classroom_id uuid,classroom_name text,member_count bigint,bound_subject_count bigint,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
 if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED';end if;
 return query select g.id,g.code,g.name,g.academic_year,g.semester,g.level,g.department,g.major,g.description,g.active,g.classroom_id,c.name,
 count(distinct m.id) filter(where m.active),count(distinct b.id) filter(where b.active),g.created_at,g.updated_at
 from public.admin_room_groups g left join public.classrooms c on c.id=g.classroom_id left join public.admin_room_group_members m on m.group_id=g.id left join public.admin_room_group_subjects b on b.group_id=g.id
 group by g.id,c.name order by g.active desc,g.academic_year desc nulls last,g.semester desc nulls last,g.name;
end $$;

create or replace function public.admin_room_group_user_ids_v206(p_group_id uuid)
returns table(user_id uuid,seat_number integer) language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
 if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED';end if;
 return query select m.user_id,m.seat_number from public.admin_room_group_members m where m.group_id=p_group_id and m.active order by m.seat_number nulls last,m.created_at;
end $$;

create or replace function public.admin_replace_room_group_members_v206(p_group_id uuid,p_members jsonb)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();v_item jsonb;v_user uuid;v_seat int;v_ids uuid[]:='{}'::uuid[];v_count int;v_sync jsonb;
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED';end if;
 if jsonb_typeof(coalesce(p_members,'[]'::jsonb))<>'array' then raise exception 'MEMBERS_MUST_BE_ARRAY';end if;
 if not exists(select 1 from public.admin_room_groups where id=p_group_id) then raise exception 'ROOM_GROUP_NOT_FOUND';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_members,'[]'::jsonb)) j where nullif(j->>'seat_number','') is not null group by (j->>'seat_number')::int having count(*)>1) then raise exception 'DUPLICATE_SEAT_NUMBER';end if;
 for v_item in select value from jsonb_array_elements(coalesce(p_members,'[]'::jsonb)) loop
   v_user:=(v_item->>'user_id')::uuid;v_seat:=nullif(v_item->>'seat_number','')::int;
   if v_seat is not null and (v_seat<1 or v_seat>999) then raise exception 'INVALID_SEAT_NUMBER';end if;
   if not exists(select 1 from public.profiles where id=v_user and role::text='user' and active and approval_status='approved') then raise exception 'ROOM_GROUP_MEMBER_INVALID';end if;
   if v_user=any(v_ids) then raise exception 'DUPLICATE_ROOM_GROUP_MEMBER';end if;
   v_ids:=array_append(v_ids,v_user);
   insert into public.admin_room_group_members(group_id,user_id,seat_number,active,added_by) values(p_group_id,v_user,v_seat,true,v_uid)
   on conflict(group_id,user_id) do update set seat_number=excluded.seat_number,active=true,added_by=v_uid,updated_at=clock_timestamp();
 end loop;
 update public.admin_room_group_members set active=false,updated_at=clock_timestamp() where group_id=p_group_id and active and not(user_id=any(v_ids));
 select count(*) into v_count from public.admin_room_group_members where group_id=p_group_id and active;
 v_sync:=private.sync_admin_room_group_v206(p_group_id,v_uid);
 return jsonb_build_object('ok',true,'group_id',p_group_id,'member_count',v_count,'sync',v_sync);
end $$;

create or replace function public.admin_auto_number_room_group_v206(p_group_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();n int;
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED';end if;
 with x as(select id,row_number() over(order by created_at,user_id)::int rn from public.admin_room_group_members where group_id=p_group_id and active)
 update public.admin_room_group_members m set seat_number=x.rn,updated_at=clock_timestamp() from x where m.id=x.id;
 get diagnostics n=row_count;perform private.sync_admin_room_group_v206(p_group_id,v_uid);
 return jsonb_build_object('ok',true,'numbered',n);
end $$;

create or replace function public.admin_bind_room_group_subject_v206(p_group_id uuid,p_subject_id uuid,p_active boolean default true)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();v_id uuid;
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED';end if;
 if not exists(select 1 from public.admin_room_groups where id=p_group_id) then raise exception 'ROOM_GROUP_NOT_FOUND';end if;
 if not exists(select 1 from public.subjects where id=p_subject_id and active and subject_type='subject') then raise exception 'SUBJECT_NOT_FOUND';end if;
 insert into public.admin_room_group_subjects(group_id,subject_id,active,bound_by) values(p_group_id,p_subject_id,coalesce(p_active,true),v_uid)
 on conflict(group_id,subject_id) do update set active=excluded.active,bound_by=v_uid,updated_at=clock_timestamp() returning id into v_id;
 perform private.sync_admin_room_group_v206(p_group_id,v_uid);
 return jsonb_build_object('ok',true,'binding_id',v_id,'active',coalesce(p_active,true));
end $$;

create or replace function public.admin_room_group_bindings_v206(p_group_id uuid)
returns table(binding_id uuid,subject_id uuid,subject_code text,subject_name text,active boolean)
language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
 if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED';end if;
 return query select b.id,s.id,s.code,s.name,b.active from public.admin_room_group_subjects b join public.subjects s on s.id=b.subject_id where b.group_id=p_group_id order by s.code;
end $$;

create or replace function public.admin_sync_room_group_v206(p_group_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
 if auth.uid() is null or not private.is_admin(auth.uid()) then raise exception 'ADMIN_REQUIRED';end if;
 return private.sync_admin_room_group_v206(p_group_id,auth.uid());
end $$;

create or replace function public.admin_link_room_group_classroom_v206(p_group_id uuid,p_classroom_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();v_sync jsonb;
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED';end if;
 if not exists(select 1 from public.classrooms where id=p_classroom_id and active) then raise exception 'CLASSROOM_NOT_FOUND';end if;
 update public.admin_room_groups set classroom_id=p_classroom_id,updated_at=clock_timestamp() where id=p_group_id;if not found then raise exception 'ROOM_GROUP_NOT_FOUND';end if;
 v_sync:=private.sync_admin_room_group_v206(p_group_id,v_uid);return jsonb_build_object('ok',true,'group_id',p_group_id,'classroom_id',p_classroom_id,'sync',v_sync);
end $$;

create or replace function public.staff_room_groups_v206()
returns table(id uuid,code text,name text,academic_year text,semester text,level text,department text,major text,classroom_id uuid,classroom_name text,member_count bigint)
language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
 if auth.uid() is null or not(private.is_admin(auth.uid()) or private.is_teacher(auth.uid())) then raise exception 'STAFF_REQUIRED';end if;
 return query select g.id,g.code,g.name,g.academic_year,g.semester,g.level,g.department,g.major,g.classroom_id,c.name,count(m.id) filter(where m.active)
 from public.admin_room_groups g left join public.classrooms c on c.id=g.classroom_id left join public.admin_room_group_members m on m.group_id=g.id
 where g.active and (private.is_admin(auth.uid()) or exists(select 1 from public.teacher_teaching_assignments t where t.teacher_id=auth.uid() and t.classroom_id=g.classroom_id and t.active))
 group by g.id,c.name order by g.academic_year desc nulls last,g.semester desc nulls last,g.name;
end $$;

create or replace function public.staff_room_group_user_ids_v206(p_group_id uuid,p_subject_id uuid default null)
returns table(user_id uuid,seat_number integer) language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare g public.admin_room_groups%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;select * into g from public.admin_room_groups where id=p_group_id and active;if not found then raise exception 'ROOM_GROUP_NOT_FOUND';end if;
 if not private.is_admin(auth.uid()) then
   if not private.is_teacher(auth.uid()) then raise exception 'STAFF_REQUIRED';end if;
   if p_subject_id is not null and not private.can_teach_attendance(g.classroom_id,p_subject_id,auth.uid()) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;
   if p_subject_id is null and not exists(select 1 from public.teacher_teaching_assignments t where t.teacher_id=auth.uid() and t.classroom_id=g.classroom_id and t.active) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;
 end if;
 return query select m.user_id,m.seat_number from public.admin_room_group_members m where m.group_id=p_group_id and m.active
 and (private.is_admin(auth.uid()) or p_subject_id is null or exists(select 1 from public.subject_enrollments se where se.user_id=m.user_id and se.subject_id=p_subject_id and se.status='approved'))
 order by m.seat_number nulls last,m.created_at;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Teacher submission / gradebook APIs
-- ---------------------------------------------------------------------------
create or replace function public.staff_submission_queue_v206()
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not(private.is_admin(auth.uid()) or private.is_teacher(auth.uid())) then raise exception 'STAFF_REQUIRED';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb) into v_result from (
   select sub.id,sub.worksheet_id,sub.user_id,sub.status,sub.submitted_at,sub.confirmed_at,sub.updated_at,sub.is_late,p.full_name,p.student_code,p.class_name,p.grade_level,p.room_label,
   w.title worksheet_title,w.subject_id,s.code subject_code,s.name subject_name,g.score,g.max_score,g.grade,g.grading_status
   from public.submissions sub join public.profiles p on p.id=sub.user_id join public.worksheets w on w.id=sub.worksheet_id join public.subjects s on s.id=w.subject_id left join public.submission_grades g on g.submission_id=sub.id
   where sub.status in ('submitted','confirmed','graded') and private.can_teach_student_subject(w.subject_id,sub.user_id,auth.uid())
 ) x;return v_result;
end $$;

create or replace function public.staff_submission_detail_v206(p_submission_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare sub public.submissions%rowtype;w public.worksheets%rowtype;p public.profiles%rowtype;k jsonb;g jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select * into sub from public.submissions where id=p_submission_id;if not found then raise exception 'SUBMISSION_NOT_FOUND';end if;
 select * into w from public.worksheets where id=sub.worksheet_id;if not private.can_teach_student_subject(w.subject_id,sub.user_id,auth.uid()) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;
 select * into p from public.profiles where id=sub.user_id;select to_jsonb(x) into k from public.worksheet_answer_keys x where x.worksheet_id=w.id;select to_jsonb(x) into g from public.submission_grades x where x.submission_id=sub.id;
 return jsonb_build_object('submission',to_jsonb(sub),'student',jsonb_build_object('id',p.id,'full_name',p.full_name,'student_code',p.student_code,'class_name',p.class_name,'grade_level',p.grade_level,'room_label',p.room_label),'worksheet',to_jsonb(w),'answer_key',coalesce(k,'{}'::jsonb),'grade',coalesce(g,'{}'::jsonb));
end $$;

create or replace function public.staff_grade_submission_v206(p_submission_id uuid,p_score numeric,p_max_score numeric default null,p_grade text default null,p_admin_comment text default null,p_rubric_result jsonb default '{}'::jsonb,p_reason text default null,p_request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();sub public.submissions%rowtype;w public.worksheets%rowtype;v_max numeric;v_now timestamptz:=clock_timestamp();v_factor numeric:=1;v_old jsonb;v_result jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'GRADE_REASON_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('staff-grade-v206:'||p_submission_id::text,0));
 select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='staff_grade_submission_v206' and entity_key=p_submission_id::text and request_key=p_request_key;if v_old is not null then return v_old||jsonb_build_object('idempotent_replay',true);end if;
 select * into sub from public.submissions where id=p_submission_id for update;if not found then raise exception 'SUBMISSION_NOT_FOUND';end if;select * into w from public.worksheets where id=sub.worksheet_id;
 if not private.can_teach_student_subject(w.subject_id,sub.user_id,v_uid) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;if sub.status not in ('submitted','confirmed','graded') then raise exception 'SUBMISSION_NOT_READY_FOR_GRADING';end if;
 v_max:=coalesce(p_max_score,(select sum(coalesce((q->>'points')::numeric,0)) from jsonb_array_elements(coalesce(w.questions,'[]'::jsonb)) q));if v_max is null or v_max<=0 then raise exception 'INVALID_MAX_SCORE';end if;if p_score is null or p_score<0 or p_score>v_max then raise exception 'INVALID_SCORE';end if;
 v_factor:=case when w.mode='paper' or coalesce(sub.is_late,false) then 0.50::numeric else 1.00::numeric end;
 insert into public.submission_grades(submission_id,score,max_score,grade,rubric_result,admin_comment,graded_by,graded_at,grading_status,finalized_at,updated_at)
 values(sub.id,p_score,v_max,nullif(trim(coalesce(p_grade,'')),''),coalesce(p_rubric_result,'{}'::jsonb),nullif(trim(coalesce(p_admin_comment,'')),''),v_uid,v_now,'final',v_now,v_now)
 on conflict(submission_id) do update set score=excluded.score,max_score=excluded.max_score,grade=excluded.grade,rubric_result=excluded.rubric_result,admin_comment=excluded.admin_comment,graded_by=v_uid,graded_at=v_now,grading_status='final',finalized_at=v_now,updated_at=v_now;
 update public.submissions set status='graded',updated_at=v_now where id=sub.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'STAFF_GRADE_SUBMISSION_V21','submission',sub.id::text,jsonb_build_object('worksheet_id',w.id,'user_id',sub.user_id,'score',p_score,'max_score',v_max,'credit_factor',v_factor,'reason',trim(p_reason)));
 v_result:=jsonb_build_object('ok',true,'submission_id',sub.id,'worksheet_id',w.id,'score',p_score,'max_score',v_max,'credit_factor',v_factor,'effective_ratio',round((p_score/v_max)*v_factor,6),'status','graded','server_time',v_now);
 insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'staff_grade_submission_v206',p_submission_id::text,p_request_key,v_result) on conflict do nothing;return v_result||jsonb_build_object('idempotent_replay',false);
end $$;

create or replace function public.staff_subject_gradebook_v206(p_subject_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_rows jsonb;v_settings jsonb;v_exams jsonb;
begin
 if auth.uid() is null or not private.can_teach_subject(p_subject_id,auth.uid()) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;
 with enrolled as (
  select p.id,p.student_code,p.full_name,p.grade_level,p.room_label,p.class_name from public.subject_enrollments se join public.profiles p on p.id=se.user_id
  where se.subject_id=p_subject_id and se.status='approved' and private.can_teach_student_subject(p_subject_id,p.id,auth.uid())
 ), units as (
  select distinct (w.settings->>'sequence_no')::int unit_no,coalesce(nullif(w.settings->>'work_pair_key',''),nullif(w.settings->>'worksheet_pair_key',''),w.id::text) logical_key
  from public.worksheets w where w.subject_id=p_subject_id and (w.settings->>'sequence_no')~'^[0-9]+$' and (w.settings->>'sequence_no')::int between 1 and 17 and not coalesce((w.settings->>'legacy_seed_archived')::boolean,false)
 ), workcalc as (
  select e.id user_id,count(distinct case when sub.status in ('submitted','confirmed','graded') then u.unit_no end)::int completed,
    coalesce(sum(distinct case when sg.grading_status='final' and coalesce(sg.max_score,0)>0 then least(1::numeric,greatest(0::numeric,sg.score/sg.max_score))*case when w.mode='paper' or coalesce(sub.is_late,false) then .5 else 1 end else 0 end),0) earned
  from enrolled e cross join units u left join public.worksheets w on w.subject_id=p_subject_id and coalesce(nullif(w.settings->>'work_pair_key',''),nullif(w.settings->>'worksheet_pair_key',''),w.id::text)=u.logical_key
  left join public.submissions sub on sub.worksheet_id=w.id and sub.user_id=e.id left join public.submission_grades sg on sg.submission_id=sub.id group by e.id
 ), cfg as (select coalesce((select work_points from public.subject_grade_settings where subject_id=p_subject_id),40)::numeric wp,coalesce((select behavior_points from public.subject_grade_settings where subject_id=p_subject_id),20)::numeric bp,coalesce((select midterm_points from public.subject_grade_settings where subject_id=p_subject_id),20)::numeric mp,coalesce((select final_points from public.subject_grade_settings where subject_id=p_subject_id),20)::numeric fp,coalesce((select default_behavior_score from public.subject_grade_settings where subject_id=p_subject_id),20)::numeric db),
 scores as (
  select e.*,coalesce(w.completed,0) completed_work_count,round(least(c.wp,coalesce(w.earned,0)*c.wp/17),2) work_score,round(coalesce(bs.score,c.db),2) behavior_score,
   coalesce((select max(a.score) from public.exam_attempts a join public.exams ex on ex.id=a.exam_id where a.user_id=e.id and ex.subject_id=p_subject_id and ex.exam_kind='midterm' and a.grading_status='final'),0)::numeric midraw,
   coalesce((select max(a.max_score) from public.exam_attempts a join public.exams ex on ex.id=a.exam_id where a.user_id=e.id and ex.subject_id=p_subject_id and ex.exam_kind='midterm' and a.grading_status='final'),20)::numeric midmax,
   coalesce((select max(a.score) from public.exam_attempts a join public.exams ex on ex.id=a.exam_id where a.user_id=e.id and ex.subject_id=p_subject_id and ex.exam_kind='final' and a.grading_status='final'),0)::numeric finraw,
   coalesce((select max(a.max_score) from public.exam_attempts a join public.exams ex on ex.id=a.exam_id where a.user_id=e.id and ex.subject_id=p_subject_id and ex.exam_kind='final' and a.grading_status='final'),20)::numeric finmax,c.*
  from enrolled e left join workcalc w on w.user_id=e.id cross join cfg c left join public.subject_behavior_scores bs on bs.subject_id=p_subject_id and bs.user_id=e.id
 ), final as (
  select s.*,round(case when s.midmax>0 then least(s.mp,s.midraw*s.mp/s.midmax) else 0 end,2) midterm_score,round(case when s.finmax>0 then least(s.fp,s.finraw*s.fp/s.finmax) else 0 end,2) final_score from scores s
 ), result as (
  select f.id user_id,f.student_code,f.full_name,f.grade_level,f.room_label,f.class_name,17::int assigned_work_count,f.completed_work_count,f.work_score,f.behavior_score,f.midterm_score,f.final_score,
   round(f.work_score+f.behavior_score+f.midterm_score+f.final_score,2) total_score,
   case when f.work_score+f.behavior_score+f.midterm_score+f.final_score>=80 then 4.0 when f.work_score+f.behavior_score+f.midterm_score+f.final_score>=75 then 3.5 when f.work_score+f.behavior_score+f.midterm_score+f.final_score>=70 then 3.0 when f.work_score+f.behavior_score+f.midterm_score+f.final_score>=65 then 2.5 when f.work_score+f.behavior_score+f.midterm_score+f.final_score>=60 then 2.0 when f.work_score+f.behavior_score+f.midterm_score+f.final_score>=55 then 1.5 when f.work_score+f.behavior_score+f.midterm_score+f.final_score>=50 then 1.0 else 0.0 end::numeric grade_value,
   case when f.work_score+f.behavior_score+f.midterm_score+f.final_score>=50 then 'ผ่าน' else 'ไม่ผ่าน' end pass_status from final f order by f.student_code nulls last,f.full_name
 ) select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into v_rows from result r;
 select coalesce(to_jsonb(s),'{}'::jsonb) into v_settings from public.subject_grade_settings s where s.subject_id=p_subject_id;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb) into v_exams from (select id,title,exam_kind,status,full_score,created_at,open_at,due_at from public.exams where subject_id=p_subject_id) e;
 return jsonb_build_object('rows',v_rows,'settings',v_settings,'exams',v_exams);
end $$;

create or replace function public.staff_adjust_subject_scores_v206(p_subject_id uuid,p_user_id uuid,p_behavior_score numeric,p_midterm_delta numeric default 0,p_final_delta numeric default 0,p_note text default null)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or not private.can_teach_student_subject(p_subject_id,p_user_id,v_uid) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;
 if p_behavior_score is null or p_behavior_score<0 or p_behavior_score>20 then raise exception 'BEHAVIOR_SCORE_OUT_OF_RANGE';end if;
 insert into public.subject_behavior_scores(subject_id,user_id,score,note,updated_by,updated_at) values(p_subject_id,p_user_id,p_behavior_score,p_note,v_uid,clock_timestamp()) on conflict(subject_id,user_id) do update set score=excluded.score,note=excluded.note,updated_by=v_uid,updated_at=clock_timestamp();
 insert into public.subject_score_adjustments_v193(subject_id,user_id,midterm_delta,final_delta,note,updated_by,updated_at) values(p_subject_id,p_user_id,coalesce(p_midterm_delta,0),coalesce(p_final_delta,0),p_note,v_uid,clock_timestamp()) on conflict(subject_id,user_id) do update set midterm_delta=excluded.midterm_delta,final_delta=excluded.final_delta,note=excluded.note,updated_by=v_uid,updated_at=clock_timestamp();
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.staff_set_subject_grade_settings_v206(p_subject_id uuid,p_midterm_exam_id uuid default null,p_final_exam_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or not private.can_teach_subject(p_subject_id,v_uid) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;
 insert into public.subject_grade_settings(subject_id,work_points,behavior_points,midterm_points,final_points,default_behavior_score,midterm_exam_id,final_exam_id,updated_by,updated_at)
 values(p_subject_id,40,20,20,20,20,p_midterm_exam_id,p_final_exam_id,v_uid,clock_timestamp())
 on conflict(subject_id) do update set work_points=40,behavior_points=20,midterm_points=20,final_points=20,default_behavior_score=20,midterm_exam_id=excluded.midterm_exam_id,final_exam_id=excluded.final_exam_id,updated_by=v_uid,updated_at=clock_timestamp();return jsonb_build_object('ok',true);
end $$;

-- ---------------------------------------------------------------------------
-- 4) Teacher attendance APIs
-- ---------------------------------------------------------------------------
create or replace function public.staff_attendance_sessions_v206()
returns table(id uuid,session_date date,started_at timestamptz,auto_close_at timestamptz,closed_at timestamptz,status text,late_after_minutes integer,close_reason text,summary jsonb,classroom_id uuid,classroom_name text,subject_id uuid,subject_code text,subject_name text)
language plpgsql security definer set search_path='public','private','pg_temp' as $$
begin
 if auth.uid() is null or not(private.is_admin(auth.uid()) or private.is_teacher(auth.uid())) then raise exception 'STAFF_REQUIRED';end if;
 return query select a.id,a.session_date,a.started_at,a.auto_close_at,a.closed_at,a.status,a.late_after_minutes,a.close_reason,a.summary,a.classroom_id,c.name,a.subject_id,s.code,s.name
 from public.attendance_sessions a join public.classrooms c on c.id=a.classroom_id join public.subjects s on s.id=a.subject_id
 where private.is_admin(auth.uid()) or private.can_teach_attendance(a.classroom_id,a.subject_id,auth.uid()) order by a.started_at desc limit 100;
end $$;

create or replace function public.staff_attendance_session_meta_v206(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();s public.attendance_sessions%rowtype;v_subject record;v_classroom text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;select * into s from public.attendance_sessions where id=p_session_id;if not found then raise exception 'ATTENDANCE_SESSION_NOT_FOUND';end if;
 if not(private.is_admin(v_uid) or private.can_teach_attendance(s.classroom_id,s.subject_id,v_uid)) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;
 select code,name into v_subject from public.subjects where id=s.subject_id;select name into v_classroom from public.classrooms where id=s.classroom_id;
 return jsonb_build_object('session_id',s.id,'session_date',s.session_date,'started_at',s.started_at,'closed_at',s.closed_at,'status',s.status,'subject_id',s.subject_id,'subject_code',v_subject.code,'subject_name',v_subject.name,'classroom_id',s.classroom_id,'classroom_name',v_classroom);
end $$;

create or replace function public.staff_issue_late_attendance_barcode_v206(p_session_id uuid,p_rotate boolean default false)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();s public.attendance_sessions%rowtype;t public.late_attendance_tokens%rowtype;v_exp timestamptz;v_teacher text;v_now timestamptz:=clock_timestamp();
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;select * into s from public.attendance_sessions where id=p_session_id for update;if not found then raise exception 'ATTENDANCE_SESSION_NOT_FOUND';end if;
 if not(private.is_admin(v_uid) or private.can_teach_attendance(s.classroom_id,s.subject_id,v_uid)) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;
 if not coalesce(p_rotate,false) then select * into t from public.late_attendance_tokens where session_id=s.id and active and expires_at>v_now order by created_at desc limit 1;if t.id is not null then select coalesce(full_name,username,'ครู') into v_teacher from public.profiles where id=t.issued_by;return jsonb_build_object('ok',true,'session_id',s.id,'token',t.token,'payload','DOCNR-LATE:'||t.token::text,'expires_at',t.expires_at,'issued_by',t.issued_by,'teacher_name',v_teacher,'reused',true);end if;end if;
 update public.late_attendance_tokens set active=false,revoked_at=v_now where session_id=s.id and active;v_exp:=greatest(coalesce(s.auto_close_at,s.started_at+make_interval(mins=>s.late_after_minutes)),v_now)+interval '4 hours';
 insert into public.late_attendance_tokens(session_id,issued_by,expires_at,metadata) values(s.id,v_uid,v_exp,jsonb_build_object('release','V21.0','purpose','student_scans_teacher_late_barcode')) returning * into t;select coalesce(full_name,username,'ครู') into v_teacher from public.profiles where id=v_uid;
 return jsonb_build_object('ok',true,'session_id',s.id,'token',t.token,'payload','DOCNR-LATE:'||t.token::text,'expires_at',t.expires_at,'issued_by',v_uid,'teacher_name',v_teacher,'reused',false);
end $$;

create or replace function public.staff_revoke_late_attendance_barcode_v206(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();s public.attendance_sessions%rowtype;n int;v_now timestamptz:=clock_timestamp();
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;select * into s from public.attendance_sessions where id=p_session_id;if not found then raise exception 'ATTENDANCE_SESSION_NOT_FOUND';end if;if not(private.is_admin(v_uid) or private.can_teach_attendance(s.classroom_id,s.subject_id,v_uid)) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;
 update public.late_attendance_tokens set active=false,revoked_at=v_now where session_id=p_session_id and active;get diagnostics n=row_count;return jsonb_build_object('ok',true,'revoked_count',n,'server_time',v_now);
end $$;

create or replace function public.staff_set_attendance_status_v206(p_session_id uuid,p_user_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();s public.attendance_sessions%rowtype;v_record uuid;v_now timestamptz:=clock_timestamp();
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;if p_status not in ('present','late','absent','excused') then raise exception 'INVALID_STATUS';end if;select * into s from public.attendance_sessions where id=p_session_id;if not found then raise exception 'NOT_FOUND';end if;
 if not(private.is_admin(v_uid) or private.can_teach_attendance(s.classroom_id,s.subject_id,v_uid)) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;if not exists(select 1 from public.classroom_memberships m where m.classroom_id=s.classroom_id and m.user_id=p_user_id and m.active) then raise exception 'STUDENT_NOT_IN_CLASSROOM';end if;
 insert into public.attendance_records(session_id,user_id,status,scanned_at,scanned_by,note,updated_at) values(s.id,p_user_id,p_status,case when p_status in('present','late') then v_now else null end,v_uid,nullif(trim(coalesce(p_note,'')),''),v_now)
 on conflict(session_id,user_id) do update set status=excluded.status,scanned_at=case when excluded.status in('present','late') then coalesce(public.attendance_records.scanned_at,v_now) else public.attendance_records.scanned_at end,scanned_by=v_uid,note=excluded.note,updated_at=v_now returning id into v_record;
 return jsonb_build_object('ok',true,'record_id',v_record,'status',p_status,'server_time',v_now);
end $$;

-- Allow scoped teachers through the legacy attendance RPCs still used by the stable feature renderer.
do $$
declare d text;
begin
  if to_regprocedure('public.scan_attendance_qr(uuid,uuid,uuid,integer)') is not null then
    select pg_get_functiondef('public.scan_attendance_qr(uuid,uuid,uuid,integer)'::regprocedure) into d;
    if position('private.can_teach_attendance(p_classroom_id,p_subject_id,v_actor)' in d)=0 then
      d:=replace(d,
        'if not (v_is_admin or private.is_classroom_leader(p_classroom_id,v_actor)) then raise exception ''ATTENDANCE_SCAN_NOT_ALLOWED''; end if;',
        'if not (v_is_admin or private.is_classroom_leader(p_classroom_id,v_actor) or private.can_teach_attendance(p_classroom_id,p_subject_id,v_actor)) then raise exception ''ATTENDANCE_SCAN_NOT_ALLOWED''; end if;');
      execute d;
    end if;
  end if;
  if to_regprocedure('public.close_attendance_session(uuid)') is not null then
    select pg_get_functiondef('public.close_attendance_session(uuid)'::regprocedure) into d;
    if position('private.can_teach_attendance(s.classroom_id,s.subject_id,v_actor)' in d)=0 then
      d:=replace(d,
        'if not(private.is_admin(v_actor) or private.is_classroom_leader(s.classroom_id,v_actor)) then raise exception ''NOT_ALLOWED''; end if;',
        'if not(private.is_admin(v_actor) or private.is_classroom_leader(s.classroom_id,v_actor) or private.can_teach_attendance(s.classroom_id,s.subject_id,v_actor)) then raise exception ''NOT_ALLOWED''; end if;');
      execute d;
    end if;
  end if;
  if to_regprocedure('public.attendance_session_snapshot(uuid)') is not null then
    select pg_get_functiondef('public.attendance_session_snapshot(uuid)'::regprocedure) into d;
    if position('private.can_teach_attendance(s.classroom_id,s.subject_id,auth.uid())' in d)=0 then
      d:=replace(d,
        'if auth.uid() is null or not(private.is_admin() or private.is_classroom_leader(s.classroom_id,auth.uid())) then raise exception ''NOT_ALLOWED''; end if;',
        'if auth.uid() is null or not(private.is_admin() or private.is_classroom_leader(s.classroom_id,auth.uid()) or private.can_teach_attendance(s.classroom_id,s.subject_id,auth.uid())) then raise exception ''NOT_ALLOWED''; end if;');
      execute d;
    end if;
  end if;
  if to_regprocedure('public.attendance_session_roster_v161(uuid)') is not null then
    select pg_get_functiondef('public.attendance_session_roster_v161(uuid)'::regprocedure) into d;
    if position('private.can_teach_attendance(s.classroom_id,s.subject_id,auth.uid())' in d)=0 then
      d:=replace(d,
        'if auth.uid() is null or not(private.is_admin() or private.is_classroom_leader(s.classroom_id,auth.uid())) then raise exception ''NOT_ALLOWED''; end if;',
        'if auth.uid() is null or not(private.is_admin() or private.is_classroom_leader(s.classroom_id,auth.uid()) or private.can_teach_attendance(s.classroom_id,s.subject_id,auth.uid())) then raise exception ''NOT_ALLOWED''; end if;');
      execute d;
    end if;
  end if;
  if to_regprocedure('public.attendance_subject_summary(uuid,uuid)') is not null then
    select pg_get_functiondef('public.attendance_subject_summary(uuid,uuid)'::regprocedure) into d;
    if position('private.can_teach_attendance(p_classroom_id,p_subject_id,auth.uid())' in d)=0 then
      d:=replace(d,
        'if auth.uid() is null or not(private.is_admin() or private.is_classroom_leader(p_classroom_id,auth.uid())) then raise exception ''NOT_ALLOWED''; end if;',
        'if auth.uid() is null or not(private.is_admin() or private.is_classroom_leader(p_classroom_id,auth.uid()) or private.can_teach_attendance(p_classroom_id,p_subject_id,auth.uid())) then raise exception ''NOT_ALLOWED''; end if;');
      execute d;
    end if;
  end if;
  if to_regprocedure('public.finalize_due_attendance_session_v161(uuid)') is not null then
    select pg_get_functiondef('public.finalize_due_attendance_session_v161(uuid)'::regprocedure) into d;
    if position('private.can_teach_attendance(s.classroom_id,s.subject_id,v_uid)' in d)=0 then
      d:=replace(d,
        'if not(private.is_admin(v_uid) or private.is_classroom_leader(s.classroom_id,v_uid)) then raise exception ''NOT_ALLOWED'';end if;',
        'if not(private.is_admin(v_uid) or private.is_classroom_leader(s.classroom_id,v_uid) or private.can_teach_attendance(s.classroom_id,s.subject_id,v_uid)) then raise exception ''NOT_ALLOWED'';end if;');
      execute d;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Teacher exam APIs
-- ---------------------------------------------------------------------------
create or replace function public.staff_exam_dashboard_v206()
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_subjects jsonb;v_exams jsonb;
begin
 if auth.uid() is null or not(private.is_admin(auth.uid()) or private.is_teacher(auth.uid())) then raise exception 'STAFF_REQUIRED';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.code),'[]'::jsonb) into v_subjects from (
  select s.id,s.code,s.name,s.academic_year,s.semester,s.color_hex,
   (select count(*) from public.exam_question_bank q where q.subject_id=s.id and q.active)::int bank_count,
   (select count(*) from public.subject_enrollments se where se.subject_id=s.id and se.status='approved' and private.can_teach_student_subject(s.id,se.user_id,auth.uid()))::int member_count,
   (select count(*) from public.exams e where e.subject_id=s.id)::int exam_count
  from public.subjects s where s.active and s.subject_type='subject' and private.can_teach_subject(s.id,auth.uid())
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_exams from (
  select e.id,e.subject_id,e.title,e.description,e.status,e.open_at,e.due_at,e.duration_minutes,e.max_attempts,e.created_by,e.created_at,e.published_at,e.exam_kind,e.full_score,e.question_count_target,e.anti_cheat_enabled,e.require_fullscreen,s.code subject_code,s.name subject_name,s.color_hex,s.academic_year,s.semester,
   (select count(*) from public.exam_attempts a where a.exam_id=e.id and private.can_teach_student_subject(e.subject_id,a.user_id,auth.uid()))::int attempt_count
  from public.exams e join public.subjects s on s.id=e.subject_id where private.can_teach_subject(e.subject_id,auth.uid())
 ) x;return jsonb_build_object('subjects',v_subjects,'exams',v_exams);
end $$;

create or replace function public.staff_create_exam_preset_v206(p_subject_id uuid,p_exam_kind text,p_title text,p_open_at timestamptz,p_due_at timestamptz)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();v_exam uuid;v_questions jsonb:='[]'::jsonb;v_key jsonb:='{}'::jsonb;v_count int;v_subject public.subjects%rowtype;
begin
 if v_uid is null or not private.can_teach_subject(p_subject_id,v_uid) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;if p_exam_kind not in('midterm','final','practice') then raise exception 'INVALID_EXAM_KIND';end if;if p_open_at is null or p_due_at is null or p_due_at<=p_open_at then raise exception 'INVALID_EXAM_WINDOW';end if;
 select * into v_subject from public.subjects where id=p_subject_id and active and subject_type='subject';if v_subject.id is null then raise exception 'SUBJECT_NOT_FOUND';end if;
 with basic_pick as(select * from public.exam_question_bank where subject_id=p_subject_id and active and lower(coalesce(difficulty,''))='basic' order by random() limit 10),easy_pick as(select * from public.exam_question_bank where subject_id=p_subject_id and active and lower(coalesce(difficulty,''))='easy' order by random() limit 15),core as(select * from basic_pick union all select * from easy_pick),hard_pick as(select * from public.exam_question_bank where subject_id=p_subject_id and active and lower(coalesce(difficulty,''))='hard' order by random() limit 25),allq as(select *,row_number() over() n from(select * from core union all select * from hard_pick) z)
 select count(*),coalesce(jsonb_agg(jsonb_build_object('id',source_key,'type','mcq','prompt',prompt,'text',prompt,'options',options,'order',n,'difficulty',difficulty) order by n),'[]'::jsonb),coalesce(jsonb_object_agg(source_key,correct_answer),'{}'::jsonb) into v_count,v_questions,v_key from allq;
 if v_count<>50 then raise exception 'QUESTION_BANK_PRESET_50_NOT_READY';end if;perform private.assert_exam_questions_safe_v18(v_questions);
 insert into public.exams(subject_id,title,description,instructions,status,open_at,due_at,duration_minutes,max_attempts,shuffle_questions,shuffle_options,questions,created_by,settings,exam_kind,full_score,question_count_target,anti_cheat_enabled,require_fullscreen,violation_limit)
 values(p_subject_id,coalesce(nullif(trim(p_title),''),case p_exam_kind when 'midterm' then 'สอบกลางภาค' when 'final' then 'สอบปลายภาค' else 'แบบทดสอบ' end)||' • '||v_subject.code,'ชุดสอบ V21.0','50 ข้อ • 75 นาที • 20 คะแนน','draft',p_open_at,p_due_at,75,2,false,true,v_questions,v_uid,jsonb_build_object('source','DOC-FULL-NR V21.0 STAFF PRESET','student_score_visible',false,'answer_review_enabled',false),p_exam_kind,20,50,true,true,0) returning id into v_exam;
 insert into public.exam_answer_keys(exam_id,answer_key,rubric,updated_by,updated_at) values(v_exam,v_key,jsonb_build_object('formula','correct_count*20/50','full_score',20,'question_count',50),v_uid,clock_timestamp());return jsonb_build_object('ok',true,'exam_id',v_exam,'questions',50,'duration_minutes',75,'full_score',20,'status','draft');
end $$;

create or replace function public.staff_publish_exam_v206(p_exam_id uuid,p_open_at timestamptz,p_due_at timestamptz)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();e public.exams%rowtype;v_count int;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;select * into e from public.exams where id=p_exam_id for update;if not found then raise exception 'NOT_FOUND';end if;if not private.can_teach_subject(e.subject_id,v_uid) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;if p_due_at<=p_open_at then raise exception 'INVALID_SCHEDULE';end if;
 update public.exams set status='published',open_at=p_open_at,due_at=p_due_at,published_at=coalesce(published_at,clock_timestamp()),updated_at=clock_timestamp() where id=p_exam_id;
 insert into public.exam_assignments(exam_id,user_id,assigned_by,assignment_source,subject_enrollment_id)
 select p_exam_id,se.user_id,v_uid,'subject_enrollment',se.id from public.subject_enrollments se where se.subject_id=e.subject_id and se.status='approved' and private.can_teach_student_subject(e.subject_id,se.user_id,v_uid)
 on conflict(exam_id,user_id) do update set assignment_source='subject_enrollment',subject_enrollment_id=excluded.subject_enrollment_id;
 select count(*) into v_count from public.exam_assignments a where a.exam_id=p_exam_id and private.can_teach_student_subject(e.subject_id,a.user_id,v_uid);return jsonb_build_object('ok',true,'exam_id',p_exam_id,'assigned_count',v_count);
end $$;

create or replace function public.staff_delete_exam_v206(p_exam_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();e public.exams%rowtype;
begin
 select * into e from public.exams where id=p_exam_id for update;if not found then raise exception 'NOT_FOUND';end if;if v_uid is null or not private.can_teach_subject(e.subject_id,v_uid) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;if not private.is_admin(v_uid) and e.created_by<>v_uid then raise exception 'ONLY_CREATOR_OR_ADMIN_CAN_DELETE_EXAM';end if;if exists(select 1 from public.exam_attempts where exam_id=p_exam_id) then raise exception 'EXAM_HAS_ATTEMPTS_ARCHIVE_INSTEAD';end if;delete from public.exams where id=p_exam_id;return jsonb_build_object('ok',true);
end $$;

create or replace function public.staff_exam_attempts_v206(p_exam_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare e public.exams%rowtype;v_result jsonb;
begin
 select * into e from public.exams where id=p_exam_id;if not found then raise exception 'NOT_FOUND';end if;if auth.uid() is null or not private.can_teach_subject(e.subject_id,auth.uid()) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc),'[]'::jsonb) into v_result from (select a.id,a.exam_id,a.user_id,a.attempt_no,a.status,a.started_at,a.expires_at,a.submitted_at,a.score,a.max_score,a.grading_status,a.correct_count,a.violation_count,a.tab_switch_count,a.fullscreen_exit_count,a.copy_paste_count,a.context_menu_count,a.print_attempt_count,p.full_name,p.student_code,p.class_name,p.grade_level,p.room_label,p.department,p.major from public.exam_attempts a join public.profiles p on p.id=a.user_id where a.exam_id=p_exam_id and private.can_teach_student_subject(e.subject_id,a.user_id,auth.uid())) x;return v_result;
end $$;

create or replace function public.staff_grade_exam_attempt_v206(p_attempt_id uuid,p_score numeric,p_comment text default null,p_reason text default null,p_request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();a public.exam_attempts%rowtype;e public.exams%rowtype;v_old jsonb;v_result jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'GRADE_REASON_REQUIRED';end if;perform pg_advisory_xact_lock(hashtextextended('staff-exam-grade-v206:'||p_attempt_id::text,0));select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='staff_grade_exam_v206' and entity_key=p_attempt_id::text and request_key=p_request_key;if v_old is not null then return v_old||jsonb_build_object('idempotent_replay',true);end if;
 select * into a from public.exam_attempts where id=p_attempt_id for update;if not found then raise exception 'NOT_FOUND';end if;select * into e from public.exams where id=a.exam_id;if not private.can_teach_student_subject(e.subject_id,a.user_id,v_uid) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;if p_score<0 or p_score>coalesce(a.max_score,e.full_score,20) then raise exception 'INVALID_SCORE';end if;
 update public.exam_attempts set score=p_score,admin_comment=nullif(trim(coalesce(p_comment,'')),''),grading_status='final',status='graded',graded_by=v_uid,graded_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_attempt_id;v_result:=jsonb_build_object('ok',true,'score',p_score,'max_score',coalesce(a.max_score,e.full_score,20));insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'staff_grade_exam_v206',p_attempt_id::text,p_request_key,v_result) on conflict do nothing;return v_result||jsonb_build_object('idempotent_replay',false);
end $$;

create or replace function public.staff_reset_exam_user_v206(p_exam_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid();e public.exams%rowtype;n int;
begin select * into e from public.exams where id=p_exam_id;if not found then raise exception 'NOT_FOUND';end if;if v_uid is null or not private.can_teach_student_subject(e.subject_id,p_user_id,v_uid) then raise exception 'TEACHER_SCOPE_REQUIRED';end if;delete from public.exam_attempts where exam_id=p_exam_id and user_id=p_user_id;get diagnostics n=row_count;return jsonb_build_object('ok',true,'deleted_attempts',n);end $$;

-- ---------------------------------------------------------------------------
-- 6) Submission lifecycle: preserve student rules while allowing scoped teacher grading
-- ---------------------------------------------------------------------------
create or replace function private.enforce_submission_lifecycle()
returns trigger
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_uid uuid:=auth.uid();
  v_ws public.worksheets%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_override boolean:=false;
  v_token_ok boolean:=false;
  v_teacher_grade_sync boolean:=false;
begin
  new.updated_at:=v_now;
  if v_uid is null or private.is_admin(v_uid) then return new; end if;
  if tg_op='UPDATE' and new.id=old.id and new.user_id=old.user_id and new.worksheet_id=old.worksheet_id
     and new.status='graded' and old.status in ('submitted','confirmed','graded') then
    select exists(
      select 1 from public.submission_grades g join public.worksheets w on w.id=new.worksheet_id
      where g.submission_id=new.id and g.grading_status='final' and g.graded_by=v_uid
        and private.can_teach_student_subject(w.subject_id,new.user_id,v_uid)
    ) into v_teacher_grade_sync;
    if v_teacher_grade_sync then return new; end if;
  end if;
  if new.user_id<>v_uid or not private.is_active_user(v_uid) then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_ws from public.worksheets where id=new.worksheet_id;
  if not found or v_ws.status<>'published' or v_ws.closed_at is not null then raise exception 'WORKSHEET_UNAVAILABLE'; end if;
  if not exists(select 1 from public.worksheet_assignments a where a.worksheet_id=new.worksheet_id and a.user_id=v_uid) then raise exception 'NOT_ASSIGNED'; end if;
  if v_ws.open_at is not null and v_now<v_ws.open_at then raise exception 'NOT_OPEN'; end if;
  v_override:=private.has_active_override(new.worksheet_id,v_uid,v_now);
  if v_ws.due_at is not null and v_now>v_ws.due_at and not v_ws.allow_late and not v_override then
    if tg_op='INSERT' or (tg_op='UPDATE' and new.status='draft') then raise exception 'DEADLINE_PASSED'; end if;
  end if;
  if tg_op='INSERT' then
    if new.status<>'draft' then raise exception 'INSERT_DRAFT_ONLY'; end if;
    new.submitted_at:=null;new.confirmed_at:=null;new.is_late:=false;new.attempt_count:=0;new.paper_token_id:=null;new.last_saved_at:=coalesce(new.last_saved_at,v_now);return new;
  end if;
  if old.status='draft' and new.status='draft' then
    new.submitted_at:=null;new.confirmed_at:=null;new.is_late:=false;new.attempt_count:=old.attempt_count;new.paper_token_id:=null;new.last_saved_at:=v_now;return new;
  end if;
  if new.status='submitted' then
    if v_ws.mode<>'digital' then raise exception 'WRONG_MODE'; end if;
    if old.status<>'draft' and not v_ws.allow_resubmit and not v_override then raise exception 'ALREADY_SUBMITTED'; end if;
    if old.attempt_count>=v_ws.max_attempts and not v_override then raise exception 'ATTEMPT_LIMIT'; end if;
    if v_ws.due_at is not null and v_now>v_ws.due_at and not v_ws.allow_late and not v_override then raise exception 'DEADLINE_PASSED'; end if;
    new.submitted_at:=v_now;new.confirmed_at:=null;new.is_late:=(v_ws.due_at is not null and v_now>v_ws.due_at);new.attempt_count:=old.attempt_count+1;new.paper_token_id:=null;new.last_saved_at:=v_now;return new;
  end if;
  if new.status='confirmed' then
    if v_ws.mode<>'paper' then raise exception 'WRONG_MODE'; end if;
    select exists(select 1 from public.paper_tokens t where t.id=new.paper_token_id and t.worksheet_id=new.worksheet_id and t.user_id=v_uid) into v_token_ok;
    if not v_token_ok then raise exception 'INVALID_CODE'; end if;
    if old.status in ('confirmed','graded') and not v_ws.allow_resubmit and not v_override then raise exception 'ALREADY_CONFIRMED'; end if;
    if old.attempt_count>=v_ws.max_attempts and not v_override then raise exception 'ATTEMPT_LIMIT'; end if;
    if v_ws.due_at is not null and v_now>v_ws.due_at and not v_ws.allow_late and not v_override then raise exception 'DEADLINE_PASSED'; end if;
    new.submitted_at:=coalesce(old.submitted_at,v_now);new.confirmed_at:=v_now;new.is_late:=(v_ws.due_at is not null and v_now>v_ws.due_at);new.attempt_count:=old.attempt_count+1;new.last_saved_at:=v_now;return new;
  end if;
  raise exception 'INVALID_STATUS_TRANSITION';
end $$;
revoke all on function private.enforce_submission_lifecycle() from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 7) Explicit API grants for all privileged V21/V20.6 compatibility RPCs
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in(
 'my_teacher_assignments_v206','admin_teacher_assignments_v206','admin_set_teacher_assignment_v206',
 'admin_room_groups_v206','admin_room_group_user_ids_v206','admin_replace_room_group_members_v206','admin_auto_number_room_group_v206','admin_bind_room_group_subject_v206','admin_room_group_bindings_v206','admin_sync_room_group_v206','admin_link_room_group_classroom_v206',
 'staff_room_groups_v206','staff_room_group_user_ids_v206','staff_submission_queue_v206','staff_submission_detail_v206','staff_grade_submission_v206','staff_subject_gradebook_v206','staff_adjust_subject_scores_v206','staff_set_subject_grade_settings_v206',
 'staff_attendance_sessions_v206','staff_attendance_session_meta_v206','staff_issue_late_attendance_barcode_v206','staff_revoke_late_attendance_barcode_v206','staff_set_attendance_status_v206',
 'staff_exam_dashboard_v206','staff_create_exam_preset_v206','staff_publish_exam_v206','staff_delete_exam_v206','staff_exam_attempts_v206','staff_grade_exam_attempt_v206','staff_reset_exam_user_v206'
 ) loop
   execute format('revoke all on function %s from public, anon',r.sig);
   execute format('grant execute on function %s to authenticated',r.sig);
 end loop;
end $$;

-- Fail closed if the V21 frontend backend contract is incomplete.
do $$
declare n text;
begin
 foreach n in array array[
  'my_teacher_assignments_v206','admin_teacher_assignments_v206','admin_set_teacher_assignment_v206',
  'admin_room_groups_v206','admin_replace_room_group_members_v206','admin_sync_room_group_v206',
  'staff_submission_queue_v206','staff_submission_detail_v206','staff_grade_submission_v206','staff_subject_gradebook_v206',
  'staff_attendance_sessions_v206','staff_set_attendance_status_v206','staff_issue_late_attendance_barcode_v206',
  'staff_exam_dashboard_v206','staff_create_exam_preset_v206','staff_publish_exam_v206','staff_exam_attempts_v206','staff_grade_exam_attempt_v206'
 ] loop
   if not exists(select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname=n) then raise exception 'V21_BACKEND_CONTRACT_MISSING:%',n;end if;
 end loop;
end $$;
