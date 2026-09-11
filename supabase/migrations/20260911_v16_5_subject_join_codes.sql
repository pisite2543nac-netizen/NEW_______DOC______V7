-- DOC-FULL-NR V16.5 — subject join codes
create table if not exists public.subject_join_codes (
  subject_id uuid primary key references public.subjects(id) on delete cascade,
  join_code text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default clock_timestamp(),
  constraint subject_join_codes_format check (join_code ~ '^[A-Z0-9]{4,12}$')
);
create unique index if not exists subject_join_codes_code_uq on public.subject_join_codes(join_code) where active=true;
alter table public.subject_join_codes enable row level security;
drop policy if exists subject_join_codes_admin_select on public.subject_join_codes;
create policy subject_join_codes_admin_select on public.subject_join_codes for select to authenticated using (private.is_admin(auth.uid()));
drop policy if exists subject_join_codes_admin_insert on public.subject_join_codes;
create policy subject_join_codes_admin_insert on public.subject_join_codes for insert to authenticated with check (private.is_admin(auth.uid()));
drop policy if exists subject_join_codes_admin_update on public.subject_join_codes;
create policy subject_join_codes_admin_update on public.subject_join_codes for update to authenticated using (private.is_admin(auth.uid())) with check (private.is_admin(auth.uid()));

create or replace function public.admin_subject_join_code(p_subject_id uuid, p_new_code text default null)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid(); v_code text;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.subjects where id=p_subject_id and subject_type='subject') then raise exception 'SUBJECT_NOT_FOUND'; end if;
  if p_new_code is not null then
    v_code:=upper(regexp_replace(trim(p_new_code),'[^A-Za-z0-9]','','g'));
    if length(v_code)<4 or length(v_code)>12 then raise exception 'JOIN_CODE_INVALID'; end if;
    insert into public.subject_join_codes(subject_id,join_code,active,created_by,updated_by,updated_at)
    values(p_subject_id,v_code,true,v_uid,v_uid,clock_timestamp())
    on conflict(subject_id) do update set join_code=excluded.join_code,active=true,updated_by=v_uid,updated_at=clock_timestamp();
  else
    select join_code into v_code from public.subject_join_codes where subject_id=p_subject_id and active=true;
    if v_code is null then
      loop
        v_code:=upper(substr(md5(gen_random_uuid()::text),1,6));
        exit when not exists(select 1 from public.subject_join_codes where join_code=v_code and active=true);
      end loop;
      insert into public.subject_join_codes(subject_id,join_code,active,created_by,updated_by)
      values(p_subject_id,v_code,true,v_uid,v_uid)
      on conflict(subject_id) do update set join_code=excluded.join_code,active=true,updated_by=v_uid,updated_at=clock_timestamp();
    end if;
  end if;
  return jsonb_build_object('subject_id',p_subject_id,'join_code',v_code,'active',true);
end $$;

create or replace function public.admin_regenerate_subject_join_code(p_subject_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_uid uuid:=auth.uid(); v_code text;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  loop
    v_code:=upper(substr(md5(gen_random_uuid()::text),1,6));
    exit when not exists(select 1 from public.subject_join_codes where join_code=v_code and active=true);
  end loop;
  insert into public.subject_join_codes(subject_id,join_code,active,created_by,updated_by,updated_at)
  values(p_subject_id,v_code,true,v_uid,v_uid,clock_timestamp())
  on conflict(subject_id) do update set join_code=excluded.join_code,active=true,updated_by=v_uid,updated_at=clock_timestamp();
  return jsonb_build_object('subject_id',p_subject_id,'join_code',v_code,'active',true);
end $$;

create or replace function public.join_subject_with_code(p_subject_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare
  v_uid uuid:=auth.uid(); v_code text:=upper(regexp_replace(trim(coalesce(p_code,'')),'[^A-Za-z0-9]','','g'));
  v_row public.subject_enrollments%rowtype; v_subject public.subjects%rowtype;
begin
  if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED'; end if;
  select * into v_subject from public.subjects where id=p_subject_id and active=true and subject_type='subject';
  if v_subject.id is null then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;
  if not exists(select 1 from public.subject_join_codes where subject_id=p_subject_id and active=true and join_code=v_code) then raise exception 'JOIN_CODE_INVALID'; end if;
  insert into public.subject_enrollments(subject_id,user_id,status,requested_at,decided_at,decided_by,note,created_at,updated_at)
  values(p_subject_id,v_uid,'approved',clock_timestamp(),clock_timestamp(),null,'เข้าร่วมด้วยรหัสรายวิชา',clock_timestamp(),clock_timestamp())
  on conflict(subject_id,user_id) do update set status='approved',requested_at=clock_timestamp(),decided_at=clock_timestamp(),decided_by=null,note='เข้าร่วมด้วยรหัสรายวิชา',updated_at=clock_timestamp()
  returning * into v_row;
  insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assigned_at,assignment_source,subject_enrollment_id)
  select w.id,v_uid,null,clock_timestamp(),'subject_enrollment',v_row.id from public.worksheets w
  where w.subject_id=p_subject_id and w.status='published'
  on conflict(worksheet_id,user_id) do nothing;
  return jsonb_build_object('ok',true,'status','approved','subject_id',p_subject_id,'subject_code',v_subject.code,'subject_name',v_subject.name);
end $$;

grant execute on function public.admin_subject_join_code(uuid,text) to authenticated;
grant execute on function public.admin_regenerate_subject_join_code(uuid) to authenticated;
grant execute on function public.join_subject_with_code(uuid,text) to authenticated;
