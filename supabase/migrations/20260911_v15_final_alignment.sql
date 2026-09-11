-- DOC-FULL-NR V15 FINAL
-- Production-safe alignment with Nangrong Smart Worksheet System requirements.
-- Additive migration: preserves all existing production rows.


-- ---------------------------------------------------------------------------
-- 1) Account approval + academic state (existing accounts remain approved)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejection_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists academic_status text not null default 'studying';

-- Existing users were already in production before the approval feature.
update public.profiles
set approval_status='approved',
    approved_at=coalesce(approved_at,created_at,clock_timestamp()),
    approval_requested_at=coalesce(approval_requested_at,created_at)
where approval_status is null or approval_status='approved';

alter table public.profiles alter column approval_status set default 'pending';

-- Named checks via idempotent DO blocks.
do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_approval_status_check') then
    alter table public.profiles add constraint profiles_approval_status_check
      check (approval_status in ('pending','approved','rejected','suspended'));
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_academic_status_check') then
    alter table public.profiles add constraint profiles_academic_status_check
      check (academic_status in ('studying','graduated','transferred','suspended'));
  end if;
end $$;

create index if not exists idx_profiles_approval_status on public.profiles(approval_status);
create index if not exists idx_profiles_academic_status on public.profiles(academic_status);

-- Approval is now part of "active user". Graduated/transferred/suspended users can
-- still sign in to see permitted historical/profile data, but cannot request new learning.
create or replace function private.is_active_user(p_user uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=p_user and p.active=true and p.approval_status='approved'
  );
$$;

create or replace function private.can_learn(p_user uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path=public,private,pg_temp
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=p_user
      and p.active=true
      and p.approval_status='approved'
      and p.academic_status='studying'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  insert into public.profiles(
    id,username,full_name,role,active,approval_status,approval_requested_at,academic_status
  ) values(
    new.id,
    coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'full_name',''),
    'user',false,'pending',clock_timestamp(),'studying'
  ) on conflict(id) do nothing;
  return new;
end;
$$;

create or replace function private.protect_profile_privileges()
returns trigger
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
begin
  if auth.uid() is not null then
    if new.username is distinct from old.username then
      raise exception 'USERNAME_CHANGE_REQUIRES_ADMIN_OPERATION';
    end if;
    if not private.is_admin() then
      if new.role is distinct from old.role then raise exception 'ROLE_CHANGE_NOT_ALLOWED'; end if;
      if new.active is distinct from old.active then raise exception 'ACTIVE_CHANGE_NOT_ALLOWED'; end if;
      if new.approval_status is distinct from old.approval_status
         or new.approved_at is distinct from old.approved_at
         or new.approved_by is distinct from old.approved_by
         or new.rejected_at is distinct from old.rejected_at
         or new.rejected_by is distinct from old.rejected_by
         or new.rejection_reason is distinct from old.rejection_reason
         or new.suspended_at is distinct from old.suspended_at
         or new.suspended_by is distinct from old.suspended_by
         or new.academic_status is distinct from old.academic_status then
        raise exception 'ACCOUNT_STATE_ADMIN_ONLY';
      end if;
      if new.student_code is distinct from old.student_code
         or new.class_name is distinct from old.class_name
         or new.grade_level is distinct from old.grade_level
         or new.room_label is distinct from old.room_label
         or new.seat_number is distinct from old.seat_number then
        raise exception 'ACADEMIC_FIELDS_ADMIN_ONLY';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Pending/rejected users may read only their own profile to display the account state.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (
  private.is_admin()
  or (auth.uid()=id and private.is_active_user(auth.uid()))
)
with check (
  private.is_admin()
  or (auth.uid()=id and private.is_active_user(auth.uid()))
);

create or replace function public.decide_account_approval(
  p_user_id uuid,
  p_status text,
  p_reason text default null
) returns jsonb
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_target public.profiles%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_action text;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status not in ('pending','approved','rejected','suspended') then raise exception 'INVALID_APPROVAL_STATUS'; end if;
  if p_user_id=v_uid and p_status<>'approved' then raise exception 'CANNOT_DISABLE_SELF_ADMIN'; end if;

  select * into v_target from public.profiles where id=p_user_id for update;
  if not found then raise exception 'USER_NOT_FOUND'; end if;

  update public.profiles set
    approval_status=p_status,
    active=case when p_status='approved' then true else false end,
    approval_requested_at=coalesce(approval_requested_at,created_at,v_now),
    approved_at=case when p_status='approved' then v_now else approved_at end,
    approved_by=case when p_status='approved' then v_uid else approved_by end,
    rejected_at=case when p_status='rejected' then v_now else null end,
    rejected_by=case when p_status='rejected' then v_uid else null end,
    rejection_reason=case when p_status in ('rejected','suspended') then nullif(trim(coalesce(p_reason,'')),'') else null end,
    suspended_at=case when p_status='suspended' then v_now else null end,
    suspended_by=case when p_status='suspended' then v_uid else null end,
    updated_at=v_now
  where id=p_user_id
  returning * into v_target;

  v_action:=case p_status
    when 'approved' then 'APPROVE_USER'
    when 'rejected' then 'REJECT_USER'
    when 'suspended' then 'SUSPEND_USER'
    else 'RESET_USER_APPROVAL'
  end;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,v_action,'profile',p_user_id::text,
    jsonb_build_object('approval_status',p_status,'reason',nullif(trim(coalesce(p_reason,'')),'')));

  return jsonb_build_object(
    'ok',true,'user_id',p_user_id,'approval_status',v_target.approval_status,
    'active',v_target.active,'academic_status',v_target.academic_status
  );
end;
$$;

create or replace function public.my_account_state()
returns table(
  user_id uuid,
  full_name text,
  student_code text,
  contact_email text,
  approval_status text,
  rejection_reason text,
  active boolean,
  academic_status text
)
language sql stable security definer
set search_path=public,pg_temp
as $$
  select p.id,p.full_name,p.student_code,p.contact_email,p.approval_status,p.rejection_reason,p.active,p.academic_status
  from public.profiles p where p.id=auth.uid();
$$;

revoke all on function public.decide_account_approval(uuid,text,text) from public,anon;
grant execute on function public.decide_account_approval(uuid,text,text) to authenticated;
revoke all on function public.my_account_state() from public,anon;
grant execute on function public.my_account_state() to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Subject enrollment must require an approved studying user
-- ---------------------------------------------------------------------------
create or replace function public.request_subject_enrollment(p_subject_id uuid)
returns public.subject_enrollments
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_row public.subject_enrollments%rowtype;
  v_ok boolean;
begin
  if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED'; end if;
  select exists(select 1 from public.subjects s where s.id=p_subject_id and s.active=true and s.subject_type='subject') into v_ok;
  if not v_ok then raise exception 'SUBJECT_NOT_AVAILABLE'; end if;

  insert into public.subject_enrollments(subject_id,user_id,status,requested_at,decided_at,decided_by,note)
  values(p_subject_id,v_uid,'pending',clock_timestamp(),null,null,null)
  on conflict(subject_id,user_id) do update
    set status=case when public.subject_enrollments.status='approved' then 'approved' else 'pending' end,
        requested_at=case when public.subject_enrollments.status='approved' then public.subject_enrollments.requested_at else clock_timestamp() end,
        decided_at=case when public.subject_enrollments.status='approved' then public.subject_enrollments.decided_at else null end,
        decided_by=case when public.subject_enrollments.status='approved' then public.subject_enrollments.decided_by else null end,
        note=case when public.subject_enrollments.status='approved' then public.subject_enrollments.note else null end,
        updated_at=clock_timestamp()
  returning * into v_row;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'REQUEST_SUBJECT_ENROLLMENT','subject_enrollment',v_row.id::text,jsonb_build_object('subject_id',p_subject_id,'status',v_row.status));
  return v_row;
end;
$$;

-- Prevent approval of learning enrollment for a non-studying account.
create or replace function public.decide_subject_enrollment(p_enrollment_id uuid,p_status text,p_note text default null)
returns public.subject_enrollments
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_row public.subject_enrollments%rowtype;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status not in ('approved','rejected','withdrawn') then raise exception 'INVALID_STATUS'; end if;
  select * into v_row from public.subject_enrollments where id=p_enrollment_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_status='approved' and not private.can_learn(v_row.user_id) then raise exception 'STUDENT_ACCOUNT_NOT_READY'; end if;

  update public.subject_enrollments
  set status=p_status,decided_at=clock_timestamp(),decided_by=v_uid,
      note=nullif(trim(coalesce(p_note,'')),''),updated_at=clock_timestamp()
  where id=p_enrollment_id returning * into v_row;

  if p_status='approved' then
    insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assignment_source,subject_enrollment_id)
    select w.id,v_row.user_id,v_uid,'subject_enrollment',v_row.id
    from public.worksheets w where w.subject_id=v_row.subject_id and w.status='published'
    on conflict(worksheet_id,user_id) do update set assignment_source='subject_enrollment',subject_enrollment_id=excluded.subject_enrollment_id;

    insert into public.exam_assignments(exam_id,user_id,assigned_by,assignment_source,subject_enrollment_id)
    select e.id,v_row.user_id,v_uid,'subject_enrollment',v_row.id
    from public.exams e where e.subject_id=v_row.subject_id and e.status='published'
    on conflict(exam_id,user_id) do update set assignment_source='subject_enrollment',subject_enrollment_id=excluded.subject_enrollment_id;
  else
    delete from public.worksheet_assignments a using public.worksheets w
    where a.worksheet_id=w.id and w.subject_id=v_row.subject_id and a.user_id=v_row.user_id and a.subject_enrollment_id=v_row.id
      and not exists(select 1 from public.submissions s where s.worksheet_id=a.worksheet_id and s.user_id=v_row.user_id);
    update public.worksheet_assignments a set assignment_source='subject_history',subject_enrollment_id=null
    from public.worksheets w
    where a.worksheet_id=w.id and w.subject_id=v_row.subject_id and a.user_id=v_row.user_id and a.subject_enrollment_id=v_row.id;

    delete from public.exam_assignments a using public.exams e
    where a.exam_id=e.id and e.subject_id=v_row.subject_id and a.user_id=v_row.user_id and a.subject_enrollment_id=v_row.id
      and not exists(select 1 from public.exam_attempts t where t.exam_id=a.exam_id and t.user_id=v_row.user_id);
    update public.exam_assignments a set assignment_source='subject_history',subject_enrollment_id=null
    from public.exams e
    where a.exam_id=e.id and e.subject_id=v_row.subject_id and a.user_id=v_row.user_id and a.subject_enrollment_id=v_row.id;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'DECIDE_SUBJECT_ENROLLMENT','subject_enrollment',v_row.id::text,
    jsonb_build_object('subject_id',v_row.subject_id,'user_id',v_row.user_id,'status',p_status,'note',p_note));
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Submission overrides are enforced by Server (late + attempts + resubmit)
-- ---------------------------------------------------------------------------
alter table public.submission_overrides
  add column if not exists allow_late boolean not null default true,
  add column if not exists allow_resubmit boolean not null default true,
  add column if not exists extra_attempts integer not null default 1;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='submission_overrides_extra_attempts_check') then
    alter table public.submission_overrides add constraint submission_overrides_extra_attempts_check check(extra_attempts>=0 and extra_attempts<=20);
  end if;
end $$;

create or replace function private.active_override_extra_attempts(p_worksheet uuid,p_user uuid,p_now timestamptz default clock_timestamp())
returns integer
language sql stable security definer
set search_path=public,pg_temp
as $$
  select coalesce(max(o.extra_attempts),0)::integer
  from public.submission_overrides o
  where o.worksheet_id=p_worksheet and o.user_id=p_user and o.active=true
    and (o.expires_at is null or o.expires_at>=p_now);
$$;

create or replace function private.active_override_allows_late(p_worksheet uuid,p_user uuid,p_now timestamptz default clock_timestamp())
returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.submission_overrides o
    where o.worksheet_id=p_worksheet and o.user_id=p_user and o.active=true and o.allow_late=true
      and (o.expires_at is null or o.expires_at>=p_now)
  );
$$;

create or replace function private.active_override_allows_resubmit(p_worksheet uuid,p_user uuid,p_now timestamptz default clock_timestamp())
returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.submission_overrides o
    where o.worksheet_id=p_worksheet and o.user_id=p_user and o.active=true and o.allow_resubmit=true
      and (o.expires_at is null or o.expires_at>=p_now)
  );
$$;

create or replace function public.save_worksheet_draft(p_worksheet_id uuid,p_answers jsonb,p_attachment_paths text[] default '{}'::text[])
returns public.submissions
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid(); v_w public.worksheets%rowtype; v_existing public.submissions%rowtype;
  v_result public.submissions%rowtype; v_now timestamptz:=clock_timestamp(); v_override_late boolean:=false;
begin
  if v_uid is null or not private.is_active_user(v_uid) then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' then raise exception 'ANSWERS_MUST_BE_OBJECT'; end if;
  select w.* into v_w from public.worksheets w
  where w.id=p_worksheet_id and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid);
  if not found then raise exception 'NOT_ASSIGNED'; end if;
  if v_w.mode<>'digital' then raise exception 'DIGITAL_WORKSHEET_REQUIRED'; end if;
  if v_w.status<>'published' then raise exception 'WORKSHEET_NOT_AVAILABLE'; end if;
  if v_w.open_at is not null and v_now<v_w.open_at then raise exception 'WORKSHEET_NOT_OPEN'; end if;
  if v_w.closed_at is not null and v_now>=v_w.closed_at then raise exception 'WORKSHEET_CLOSED'; end if;
  v_override_late:=private.active_override_allows_late(p_worksheet_id,v_uid,v_now);
  if v_w.due_at is not null and v_now>v_w.due_at and not (v_w.allow_late or v_override_late) then raise exception 'WORKSHEET_DUE_PASSED'; end if;
  if not v_w.allow_draft then raise exception 'DRAFT_DISABLED'; end if;

  select * into v_existing from public.submissions where worksheet_id=p_worksheet_id and user_id=v_uid for update;
  if found and v_existing.status<>'draft' then raise exception 'ALREADY_SUBMITTED'; end if;

  insert into public.submissions(worksheet_id,user_id,answers,attachment_paths,status,last_saved_at,updated_at)
  values(p_worksheet_id,v_uid,coalesce(p_answers,'{}'::jsonb),coalesce(p_attachment_paths,'{}'::text[]),'draft',v_now,v_now)
  on conflict(worksheet_id,user_id) do update
    set answers=excluded.answers,attachment_paths=excluded.attachment_paths,last_saved_at=v_now,updated_at=v_now
    where public.submissions.user_id=v_uid and public.submissions.status='draft'
  returning * into v_result;
  if v_result.id is null then raise exception 'ALREADY_SUBMITTED'; end if;
  return v_result;
end;
$$;

create or replace function public.finalize_digital_submission(p_worksheet_id uuid,p_answers jsonb,p_attachment_paths text[] default '{}'::text[])
returns public.submissions
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid(); v_w public.worksheets%rowtype; v_existing public.submissions%rowtype;
  v_result public.submissions%rowtype; v_now timestamptz:=clock_timestamp(); v_used integer:=0;
  v_late boolean:=false; v_extra integer:=0; v_override_late boolean:=false; v_override_resubmit boolean:=false; v_limit integer:=1;
begin
  if v_uid is null or not private.is_active_user(v_uid) then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' then raise exception 'ANSWERS_MUST_BE_OBJECT'; end if;
  select w.* into v_w from public.worksheets w
  where w.id=p_worksheet_id and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid);
  if not found then raise exception 'NOT_ASSIGNED'; end if;
  if v_w.mode<>'digital' then raise exception 'DIGITAL_WORKSHEET_REQUIRED'; end if;
  if v_w.status<>'published' then raise exception 'WORKSHEET_NOT_AVAILABLE'; end if;
  if v_w.open_at is not null and v_now<v_w.open_at then raise exception 'WORKSHEET_NOT_OPEN'; end if;
  if v_w.closed_at is not null and v_now>=v_w.closed_at then raise exception 'WORKSHEET_CLOSED'; end if;

  v_override_late:=private.active_override_allows_late(p_worksheet_id,v_uid,v_now);
  v_override_resubmit:=private.active_override_allows_resubmit(p_worksheet_id,v_uid,v_now);
  v_extra:=private.active_override_extra_attempts(p_worksheet_id,v_uid,v_now);
  v_limit:=greatest(coalesce(v_w.max_attempts,1),1)+greatest(v_extra,0);

  if v_w.due_at is not null and v_now>v_w.due_at then
    v_late:=true;
    if not (v_w.allow_late or v_override_late) then raise exception 'WORKSHEET_DUE_PASSED'; end if;
  end if;

  select * into v_existing from public.submissions where worksheet_id=p_worksheet_id and user_id=v_uid for update;
  if found then
    v_used:=greatest(coalesce(v_existing.attempt_count,0),case when v_existing.status in ('submitted','confirmed','graded') then 1 else 0 end);
    if v_existing.status<>'draft' and not (v_w.allow_resubmit or v_override_resubmit) then raise exception 'ALREADY_SUBMITTED'; end if;
    if v_used>=v_limit then raise exception 'ATTEMPT_LIMIT_REACHED'; end if;
    update public.submissions set answers=coalesce(p_answers,'{}'::jsonb),attachment_paths=coalesce(p_attachment_paths,'{}'::text[]),
      status='submitted',submitted_at=v_now,confirmed_at=null,attempt_count=v_used+1,is_late=v_late,last_saved_at=coalesce(last_saved_at,v_now),updated_at=v_now
    where id=v_existing.id returning * into v_result;
  else
    insert into public.submissions(worksheet_id,user_id,answers,attachment_paths,status,submitted_at,attempt_count,is_late,last_saved_at,updated_at)
    values(p_worksheet_id,v_uid,coalesce(p_answers,'{}'::jsonb),coalesce(p_attachment_paths,'{}'::text[]),'submitted',v_now,1,v_late,v_now,v_now)
    returning * into v_result;
  end if;

  update public.submission_grades set score=null,grade=null,rubric_result='{}'::jsonb,admin_comment=null,graded_by=null,
    grading_status='draft',finalized_at=null,updated_at=v_now where submission_id=v_result.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'SUBMIT_WORKSHEET','submission',v_result.id::text,
    jsonb_build_object('worksheet_id',p_worksheet_id,'attempt_count',v_result.attempt_count,'attempt_limit',v_limit,'is_late',v_late,'override_extra_attempts',v_extra));
  return v_result;
end;
$$;

create or replace function public.confirm_paper_submission(p_token text)
returns public.submissions
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid(); v_tok public.paper_tokens%rowtype; v_w public.worksheets%rowtype;
  v_existing public.submissions%rowtype; v_result public.submissions%rowtype; v_now timestamptz:=clock_timestamp();
  v_used integer:=0; v_late boolean:=false; v_extra integer:=0; v_override_late boolean:=false; v_override_resubmit boolean:=false; v_limit integer:=1;
begin
  if v_uid is null or not private.is_active_user(v_uid) then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_tok from public.paper_tokens where token=p_token and user_id=v_uid for update;
  if not found then raise exception 'INVALID_CODE'; end if;
  select w.* into v_w from public.worksheets w
  where w.id=v_tok.worksheet_id and exists(select 1 from public.worksheet_assignments a where a.worksheet_id=w.id and a.user_id=v_uid);
  if not found then raise exception 'NOT_ASSIGNED'; end if;
  if v_w.mode<>'paper' then raise exception 'PAPER_WORKSHEET_REQUIRED'; end if;
  if v_w.status<>'published' then raise exception 'WORKSHEET_NOT_AVAILABLE'; end if;
  if v_w.open_at is not null and v_now<v_w.open_at then raise exception 'WORKSHEET_NOT_OPEN'; end if;
  if v_w.closed_at is not null and v_now>=v_w.closed_at then raise exception 'WORKSHEET_CLOSED'; end if;

  v_override_late:=private.active_override_allows_late(v_w.id,v_uid,v_now);
  v_override_resubmit:=private.active_override_allows_resubmit(v_w.id,v_uid,v_now);
  v_extra:=private.active_override_extra_attempts(v_w.id,v_uid,v_now);
  v_limit:=greatest(coalesce(v_w.max_attempts,1),1)+greatest(v_extra,0);
  if v_w.due_at is not null and v_now>v_w.due_at then
    v_late:=true;
    if not (v_w.allow_late or v_override_late) then raise exception 'WORKSHEET_DUE_PASSED'; end if;
  end if;

  select * into v_existing from public.submissions where worksheet_id=v_w.id and user_id=v_uid for update;
  if found then
    v_used:=greatest(coalesce(v_existing.attempt_count,0),case when v_existing.status in ('submitted','confirmed','graded') then 1 else 0 end);
    if v_existing.status<>'draft' and not (v_w.allow_resubmit or v_override_resubmit) then raise exception 'ALREADY_SUBMITTED'; end if;
    if v_used>=v_limit then raise exception 'ATTEMPT_LIMIT_REACHED'; end if;
    update public.submissions set status='confirmed',paper_token_id=v_tok.id,confirmed_at=v_now,submitted_at=null,
      attempt_count=v_used+1,is_late=v_late,updated_at=v_now
    where id=v_existing.id returning * into v_result;
  else
    insert into public.submissions(worksheet_id,user_id,status,paper_token_id,confirmed_at,attempt_count,is_late,updated_at)
    values(v_w.id,v_uid,'confirmed',v_tok.id,v_now,1,v_late,v_now) returning * into v_result;
  end if;
  update public.paper_tokens set used_at=v_now where id=v_tok.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'CONFIRM_PAPER_SUBMISSION','submission',v_result.id::text,
    jsonb_build_object('worksheet_id',v_w.id,'attempt_count',v_result.attempt_count,'attempt_limit',v_limit,'is_late',v_late));
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Exam privacy: students can see status, never score/max_score/comment
-- ---------------------------------------------------------------------------
drop policy if exists exam_attempts_read on public.exam_attempts;
create policy exam_attempts_admin_read on public.exam_attempts
for select to authenticated using (private.is_admin());

create or replace function public.my_exam_attempt_status(p_exam_id uuid default null)
returns table(
  attempt_id uuid,
  exam_id uuid,
  attempt_no integer,
  status text,
  grading_status text,
  started_at timestamptz,
  expires_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer
set search_path=public,private,pg_temp
as $$
  select a.id,a.exam_id,a.attempt_no,a.status,a.grading_status,a.started_at,a.expires_at,a.submitted_at,a.updated_at
  from public.exam_attempts a
  where a.user_id=auth.uid() and (p_exam_id is null or a.exam_id=p_exam_id)
  order by a.exam_id,a.attempt_no desc;
$$;

revoke all on function public.my_exam_attempt_status(uuid) from public,anon;
grant execute on function public.my_exam_attempt_status(uuid) to authenticated;

create or replace function public.start_exam(p_exam_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid(); v_exam public.exams%rowtype; v_attempt public.exam_attempts%rowtype; v_expired public.exam_attempts%rowtype;
  v_next int; v_had_expired boolean:=false; v_now timestamptz:=clock_timestamp(); v_last_status text; v_last_grading text;
begin
  if v_uid is null or not private.can_learn(v_uid) then raise exception 'ACTIVE_STUDENT_REQUIRED'; end if;
  select * into v_exam from public.exams where id=p_exam_id;
  if not found or v_exam.status<>'published' then raise exception 'EXAM_NOT_AVAILABLE'; end if;
  if not exists(select 1 from public.exam_assignments where exam_id=p_exam_id and user_id=v_uid) then raise exception 'NOT_ASSIGNED'; end if;
  if v_exam.open_at is not null and v_now<v_exam.open_at then raise exception 'EXAM_NOT_OPEN'; end if;
  if v_exam.due_at is not null and v_now>v_exam.due_at then raise exception 'EXAM_CLOSED'; end if;

  select * into v_attempt from public.exam_attempts
  where exam_id=p_exam_id and user_id=v_uid and status='draft' and expires_at>v_now
  order by attempt_no desc limit 1;

  if v_attempt.id is null then
    select * into v_expired from public.exam_attempts
    where exam_id=p_exam_id and user_id=v_uid and status='draft' and expires_at<=v_now
    order by attempt_no desc limit 1 for update;
    if v_expired.id is not null then
      update public.exam_attempts set submitted_at=coalesce(submitted_at,expires_at),status='submitted',updated_at=v_now where id=v_expired.id;
      perform private.grade_exam_attempt(v_expired.id);
      select status,grading_status into v_last_status,v_last_grading from public.exam_attempts where id=v_expired.id;
      v_had_expired:=true;
      insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(v_uid,'AUTO_SUBMIT_EXPIRED_EXAM','exam_attempt',v_expired.id::text,jsonb_build_object('exam_id',p_exam_id,'expired_at',v_expired.expires_at,'grading_status',v_last_grading));
    end if;

    select coalesce(max(attempt_no),0)+1 into v_next from public.exam_attempts where exam_id=p_exam_id and user_id=v_uid;
    if v_next>v_exam.max_attempts then
      if v_had_expired then
        return jsonb_build_object('expired_finalized',true,'exhausted',true,'attempt_id',v_expired.id,'attempt_no',v_expired.attempt_no,'status',v_last_status,'grading_status',v_last_grading);
      end if;
      raise exception 'MAX_ATTEMPTS_REACHED';
    end if;

    insert into public.exam_attempts(exam_id,user_id,attempt_no,started_at,expires_at,status,grading_status)
    values(p_exam_id,v_uid,v_next,v_now,least(coalesce(v_exam.due_at,'infinity'::timestamptz),v_now+make_interval(mins=>v_exam.duration_minutes)),'draft','pending')
    returning * into v_attempt;
  end if;

  return jsonb_build_object(
    'attempt_id',v_attempt.id,'attempt_no',v_attempt.attempt_no,'answers',v_attempt.answers,
    'started_at',v_attempt.started_at,'expires_at',v_attempt.expires_at,'previous_expired_finalized',v_had_expired,
    'exam',jsonb_build_object('id',v_exam.id,'subject_id',v_exam.subject_id,'title',v_exam.title,
      'description',v_exam.description,'instructions',v_exam.instructions,'questions',v_exam.questions,
      'shuffle_questions',v_exam.shuffle_questions,'shuffle_options',v_exam.shuffle_options,
      'due_at',v_exam.due_at,'duration_minutes',v_exam.duration_minutes)
  );
end;
$$;

create or replace function public.submit_exam_attempt(p_attempt_id uuid,p_answers jsonb)
returns jsonb
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_exp timestamptz; v_status text; v_grade_status text; v_now timestamptz:=clock_timestamp();
begin
  if v_uid is null or not private.is_active_user(v_uid) then raise exception 'AUTH_REQUIRED'; end if;
  select expires_at,status into v_exp,v_status from public.exam_attempts where id=p_attempt_id and user_id=v_uid for update;
  if v_exp is null then raise exception 'NOT_FOUND'; end if;
  if v_status<>'draft' then raise exception 'ATTEMPT_FINALIZED'; end if;
  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' then raise exception 'ANSWERS_MUST_BE_OBJECT'; end if;
  update public.exam_attempts set answers=coalesce(p_answers,'{}'::jsonb),submitted_at=v_now,status='submitted',updated_at=v_now where id=p_attempt_id;
  perform private.grade_exam_attempt(p_attempt_id);
  select grading_status into v_grade_status from public.exam_attempts where id=p_attempt_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'SUBMIT_EXAM','exam_attempt',p_attempt_id::text,jsonb_build_object('expired',v_now>v_exp,'grading_status',v_grade_status));
  return jsonb_build_object('ok',true,'status','submitted','grading_status',v_grade_status,'submitted_at',v_now);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Academic history + expanded promotion decisions
-- ---------------------------------------------------------------------------
create table if not exists public.academic_history(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  academic_year text,
  semester text,
  grade_level text,
  room_label text,
  class_name text,
  seat_number integer,
  academic_status text not null default 'studying',
  decision text,
  effective_at timestamptz not null default clock_timestamp(),
  source_batch_id uuid references public.promotion_batches(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.academic_history enable row level security;
drop policy if exists academic_history_read on public.academic_history;
create policy academic_history_read on public.academic_history
for select to authenticated
using (private.is_admin() or user_id=auth.uid());
-- Writes only through SECURITY DEFINER promotion functions.
create index if not exists idx_academic_history_user on public.academic_history(user_id,created_at desc);

alter table public.promotion_items
  add column if not exists decision_reason text,
  add column if not exists effective_at timestamptz;

alter table public.promotion_items drop constraint if exists promotion_items_decision_check;
alter table public.promotion_items add constraint promotion_items_decision_check
  check(decision in ('promote','hold','repeat','graduate','transfer','suspend','cancel'));

create or replace function public.set_promotion_item_decision(p_item_id uuid,p_decision text)
returns void
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare v_item public.promotion_items%rowtype; v_status text; v_next text;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('promote','hold','repeat','graduate','transfer','suspend','cancel') then raise exception 'INVALID_DECISION'; end if;
  select * into v_item from public.promotion_items where id=p_item_id;
  if not found then raise exception 'PROMOTION_ITEM_NOT_FOUND'; end if;
  select status into v_status from public.promotion_batches where id=v_item.batch_id;
  if v_status<>'draft' then raise exception 'BATCH_NOT_EDITABLE'; end if;

  if p_decision='promote' then
    v_next:=public.promotion_next_level(v_item.old_grade_level);
    if v_next is null then raise exception 'NO_NEXT_LEVEL_FOR_STUDENT'; end if;
    update public.promotion_items set decision='promote',new_grade_level=v_next,new_room_label=old_room_label,
      new_class_name=v_next||coalesce(old_room_label,''),new_seat_number=old_seat_number where id=p_item_id;
  elsif p_decision in ('hold','repeat') then
    update public.promotion_items set decision=p_decision,new_grade_level=old_grade_level,new_room_label=old_room_label,
      new_class_name=old_class_name,new_seat_number=old_seat_number where id=p_item_id;
  elsif p_decision='graduate' then
    update public.promotion_items set decision='graduate',new_grade_level='จบการศึกษา',new_room_label=null,
      new_class_name='จบการศึกษา',new_seat_number=null where id=p_item_id;
  else
    update public.promotion_items set decision=p_decision,new_grade_level=old_grade_level,new_room_label=null,
      new_class_name=null,new_seat_number=null where id=p_item_id;
  end if;
end;
$$;

create or replace function public.set_promotion_item_decision_v15(
  p_item_id uuid,
  p_decision text,
  p_new_grade_level text default null,
  p_new_room_label text default null,
  p_new_class_name text default null,
  p_new_seat_number integer default null,
  p_reason text default null,
  p_effective_at timestamptz default null
) returns jsonb
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare v_status text; v_item public.promotion_items%rowtype; v_next text;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('promote','hold','repeat','graduate','transfer','suspend','cancel') then raise exception 'INVALID_DECISION'; end if;
  select * into v_item from public.promotion_items where id=p_item_id for update;
  if not found then raise exception 'PROMOTION_ITEM_NOT_FOUND'; end if;
  select status into v_status from public.promotion_batches where id=v_item.batch_id;
  if v_status<>'draft' then raise exception 'BATCH_NOT_EDITABLE'; end if;

  if p_decision='promote' then
    v_next:=coalesce(nullif(trim(coalesce(p_new_grade_level,'')),''),public.promotion_next_level(v_item.old_grade_level));
    if v_next is null then raise exception 'NO_NEXT_LEVEL_FOR_STUDENT'; end if;
    update public.promotion_items set decision='promote',new_grade_level=v_next,
      new_room_label=coalesce(p_new_room_label,old_room_label),
      new_class_name=coalesce(nullif(trim(coalesce(p_new_class_name,'')),''),v_next||coalesce(p_new_room_label,old_room_label,'')),
      new_seat_number=coalesce(p_new_seat_number,old_seat_number),decision_reason=nullif(trim(coalesce(p_reason,'')),''),effective_at=p_effective_at
    where id=p_item_id;
  elsif p_decision in ('hold','repeat') then
    update public.promotion_items set decision=p_decision,new_grade_level=old_grade_level,
      new_room_label=coalesce(p_new_room_label,old_room_label),new_class_name=coalesce(p_new_class_name,old_class_name),
      new_seat_number=coalesce(p_new_seat_number,old_seat_number),decision_reason=nullif(trim(coalesce(p_reason,'')),''),effective_at=p_effective_at
    where id=p_item_id;
  elsif p_decision='graduate' then
    update public.promotion_items set decision='graduate',new_grade_level='จบการศึกษา',new_room_label=null,new_class_name='จบการศึกษา',new_seat_number=null,
      decision_reason=nullif(trim(coalesce(p_reason,'')),''),effective_at=p_effective_at where id=p_item_id;
  else
    if p_decision in ('transfer','suspend') and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'DECISION_REASON_REQUIRED'; end if;
    update public.promotion_items set decision=p_decision,new_grade_level=old_grade_level,new_room_label=null,new_class_name=null,new_seat_number=null,
      decision_reason=nullif(trim(coalesce(p_reason,'')),''),effective_at=coalesce(p_effective_at,clock_timestamp()) where id=p_item_id;
  end if;
  return jsonb_build_object('ok',true,'item_id',p_item_id,'decision',p_decision);
end;
$$;

revoke all on function public.set_promotion_item_decision_v15(uuid,text,text,text,text,integer,text,timestamptz) from public,anon;
grant execute on function public.set_promotion_item_decision_v15(uuid,text,text,text,text,integer,text,timestamptz) to authenticated;

create or replace function public.apply_promotion_batch(p_batch_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare
  v_batch public.promotion_batches%rowtype; v_item public.promotion_items%rowtype; v_classroom_id uuid;
  v_count integer:=0; v_target_year text; v_semester text:='1'; v_now timestamptz:=clock_timestamp();
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_batch from public.promotion_batches where id=p_batch_id for update;
  if not found then raise exception 'PROMOTION_BATCH_NOT_FOUND'; end if;
  if v_batch.status<>'approved' then raise exception 'BATCH_MUST_BE_APPROVED_FIRST'; end if;
  v_target_year:=v_batch.target_academic_year;

  if exists(
    select 1 from public.promotion_items i join public.profiles p on p.id=i.user_id
    where i.batch_id=p_batch_id and (p.grade_level is distinct from i.old_grade_level or p.room_label is distinct from i.old_room_label or p.class_name is distinct from i.old_class_name)
  ) then raise exception 'STUDENT_ACADEMIC_DATA_CHANGED_REVIEW_REQUIRED'; end if;

  for v_item in select * from public.promotion_items where batch_id=p_batch_id order by full_name loop
    if v_item.decision='cancel' then
      update public.promotion_items set applied=true,applied_at=v_now,result_note='cancelled/no change' where id=v_item.id;
      continue;
    end if;

    insert into public.academic_history(user_id,academic_year,semester,grade_level,room_label,class_name,seat_number,academic_status,decision,effective_at,source_batch_id,metadata)
    values(v_item.user_id,v_batch.source_academic_year,v_semester,v_item.old_grade_level,v_item.old_room_label,v_item.old_class_name,v_item.old_seat_number,
      coalesce((select academic_status from public.profiles where id=v_item.user_id),'studying'),v_item.decision,coalesce(v_item.effective_at,v_now),p_batch_id,
      jsonb_build_object('target_academic_year',v_target_year,'reason',v_item.decision_reason));

    update public.classroom_memberships set active=false where user_id=v_item.user_id and active=true;

    if v_item.decision='graduate' then
      update public.profiles set grade_level='จบการศึกษา',room_label=null,class_name='จบการศึกษา',seat_number=null,academic_status='graduated',updated_at=v_now where id=v_item.user_id;
    elsif v_item.decision='transfer' then
      update public.profiles set room_label=null,class_name=null,seat_number=null,academic_status='transferred',updated_at=v_now where id=v_item.user_id;
    elsif v_item.decision='suspend' then
      update public.profiles set room_label=null,class_name=null,seat_number=null,academic_status='suspended',updated_at=v_now where id=v_item.user_id;
    elsif v_item.decision in ('promote','hold','repeat') then
      update public.profiles set grade_level=v_item.new_grade_level,room_label=v_item.new_room_label,class_name=v_item.new_class_name,
        seat_number=v_item.new_seat_number,academic_status='studying',updated_at=v_now where id=v_item.user_id;

      select id into v_classroom_id from public.classrooms
      where name=v_item.new_class_name and academic_year=v_target_year and coalesce(semester,'1')='1'
      order by active desc,created_at limit 1;
      if v_classroom_id is null then
        insert into public.classrooms(name,level,academic_year,semester,active,description)
        values(v_item.new_class_name,v_item.new_grade_level,v_target_year,'1',true,'สร้างอัตโนมัติจากระบบเลื่อนชั้นที่อนุมัติโดย Admin') returning id into v_classroom_id;
      else
        update public.classrooms set active=true where id=v_classroom_id;
      end if;
      insert into public.classroom_memberships(classroom_id,user_id,seat_number,active)
      values(v_classroom_id,v_item.user_id,v_item.new_seat_number,true)
      on conflict(classroom_id,user_id) do update set seat_number=excluded.seat_number,active=true;
    end if;

    update public.promotion_items set applied=true,applied_at=v_now,result_note='applied' where id=v_item.id;
    v_count:=v_count+1;
  end loop;

  update public.promotion_batches set status='applied',applied_by=auth.uid(),applied_at=v_now where id=p_batch_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'APPLY_PROMOTION','promotion_batch',p_batch_id::text,jsonb_build_object('student_count',v_count,'target_academic_year',v_target_year));
  return jsonb_build_object('batch_id',p_batch_id,'applied_count',v_count,'target_academic_year',v_target_year);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Publish only approved studying learners
-- ---------------------------------------------------------------------------
create or replace function public.publish_exam_to_subject(p_exam_id uuid,p_open_at timestamptz,p_due_at timestamptz)
returns jsonb
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_exam public.exams%rowtype; v_count int;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_open_at is null or p_due_at is null or p_due_at<=p_open_at then raise exception 'INVALID_SCHEDULE'; end if;
  select * into v_exam from public.exams where id=p_exam_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if jsonb_array_length(v_exam.questions)=0 then raise exception 'NO_QUESTIONS'; end if;
  update public.exams set status='published',open_at=p_open_at,due_at=p_due_at,published_at=coalesce(published_at,clock_timestamp()),updated_at=clock_timestamp() where id=p_exam_id;
  insert into public.exam_assignments(exam_id,user_id,assigned_by,assignment_source,subject_enrollment_id)
  select p_exam_id,e.user_id,v_uid,'subject_enrollment',e.id
  from public.subject_enrollments e join public.profiles p on p.id=e.user_id
  where e.subject_id=v_exam.subject_id and e.status='approved' and p.active=true and p.role='user' and p.approval_status='approved' and p.academic_status='studying'
  on conflict(exam_id,user_id) do update set assignment_source='subject_enrollment',subject_enrollment_id=excluded.subject_enrollment_id;
  select count(*) into v_count from public.exam_assignments where exam_id=p_exam_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'PUBLISH_EXAM','exam',p_exam_id::text,jsonb_build_object('assigned_count',v_count,'open_at',p_open_at,'due_at',p_due_at));
  return jsonb_build_object('ok',true,'exam_id',p_exam_id,'assigned_count',v_count);
end;
$$;

-- Keep grants explicit for student-facing RPCs.
grant execute on function public.request_subject_enrollment(uuid) to authenticated;
grant execute on function public.save_worksheet_draft(uuid,jsonb,text[]) to authenticated;
grant execute on function public.finalize_digital_submission(uuid,jsonb,text[]) to authenticated;
grant execute on function public.confirm_paper_submission(text) to authenticated;
grant execute on function public.start_exam(uuid) to authenticated;
grant execute on function public.submit_exam_attempt(uuid,jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- V15 target safety: only approved, active, currently studying users receive
-- new worksheet assignments, regardless of subject/classroom/manual target.
-- ---------------------------------------------------------------------------
create or replace function public.publish_subject_worksheets(
  p_subject_id uuid,
  p_worksheet_ids uuid[],
  p_open_at timestamptz,
  p_due_at timestamptz,
  p_allow_late boolean default false,
  p_allow_resubmit boolean default false,
  p_max_attempts integer default 1
) returns jsonb
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_requested integer; v_valid integer; v_learners integer; v_assignments integer;
begin
  if v_uid is null or not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_open_at is null or p_due_at is null or p_due_at<=p_open_at then raise exception 'INVALID_SCHEDULE'; end if;
  if coalesce(p_max_attempts,0)<1 then raise exception 'INVALID_MAX_ATTEMPTS'; end if;
  if coalesce(array_length(p_worksheet_ids,1),0)=0 then raise exception 'NO_WORKSHEETS_SELECTED'; end if;

  select count(distinct x) into v_requested from unnest(p_worksheet_ids) x;
  select count(*) into v_valid from public.worksheets w where w.id=any(p_worksheet_ids) and w.subject_id=p_subject_id;
  if v_valid<>v_requested then raise exception 'WORKSHEET_SUBJECT_MISMATCH'; end if;

  update public.worksheets set open_at=p_open_at,due_at=p_due_at,
    allow_late=coalesce(p_allow_late,false),allow_resubmit=coalesce(p_allow_resubmit,false),
    max_attempts=p_max_attempts,status='published',published_at=coalesce(published_at,clock_timestamp()),
    reference_code=coalesce(reference_code,upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)))
  where id=any(p_worksheet_ids) and subject_id=p_subject_id;

  select count(*) into v_learners
  from public.subject_enrollments e
  join public.profiles p on p.id=e.user_id
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

  select count(*) into v_assignments from public.worksheet_assignments a
  where a.worksheet_id=any(p_worksheet_ids)
    and exists(
      select 1 from public.subject_enrollments e join public.profiles p on p.id=e.user_id
      where e.id=a.subject_enrollment_id and e.subject_id=p_subject_id and e.status='approved'
        and p.active=true and p.approval_status='approved' and p.academic_status='studying'
    );

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'PUBLISH_SUBJECT_WORKSHEETS','subject',p_subject_id::text,
    jsonb_build_object('worksheet_count',v_valid,'approved_learners',v_learners,'assignment_count',v_assignments,'open_at',p_open_at,'due_at',p_due_at));

  return jsonb_build_object('subject_id',p_subject_id,'worksheet_count',v_valid,'approved_learners',v_learners,
    'assignment_count',v_assignments,'open_at',p_open_at,'due_at',p_due_at);
end;
$$;

create or replace function public.publish_worksheet(
  p_worksheet_id uuid,
  p_classroom_ids uuid[] default '{}'::uuid[],
  p_user_ids uuid[] default '{}'::uuid[]
) returns public.worksheets
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_ws public.worksheets%rowtype; v_count integer;
begin
  if v_uid is null or not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_ws from public.worksheets where id=p_worksheet_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_ws.open_at is null or v_ws.due_at is null or v_ws.due_at<=v_ws.open_at then raise exception 'INVALID_SCHEDULE'; end if;

  insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assignment_source)
  select p_worksheet_id,m.user_id,v_uid,'classroom'
  from public.classroom_memberships m join public.profiles p on p.id=m.user_id
  where m.active and m.classroom_id=any(coalesce(p_classroom_ids,'{}'::uuid[]))
    and p.role='user' and p.active and p.approval_status='approved' and p.academic_status='studying'
  on conflict(worksheet_id,user_id) do nothing;

  insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assignment_source)
  select p_worksheet_id,u,v_uid,'manual'
  from unnest(coalesce(p_user_ids,'{}'::uuid[])) u
  join public.profiles p on p.id=u
  where p.role='user' and p.active and p.approval_status='approved' and p.academic_status='studying'
  on conflict(worksheet_id,user_id) do nothing;

  if v_ws.classroom_id is not null then
    insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assignment_source)
    select p_worksheet_id,m.user_id,v_uid,'classroom'
    from public.classroom_memberships m join public.profiles p on p.id=m.user_id
    where m.active and m.classroom_id=v_ws.classroom_id
      and p.role='user' and p.active and p.approval_status='approved' and p.academic_status='studying'
    on conflict(worksheet_id,user_id) do nothing;
  end if;

  if coalesce(array_length(p_classroom_ids,1),0)=0 and coalesce(array_length(p_user_ids,1),0)=0
     and v_ws.classroom_id is null and v_ws.subject_id is not null then
    insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assignment_source,subject_enrollment_id)
    select p_worksheet_id,e.user_id,v_uid,'subject_enrollment',e.id
    from public.subject_enrollments e join public.profiles p on p.id=e.user_id
    where e.subject_id=v_ws.subject_id and e.status='approved'
      and p.role='user' and p.active and p.approval_status='approved' and p.academic_status='studying'
    on conflict(worksheet_id,user_id) do update set assignment_source='subject_enrollment',subject_enrollment_id=excluded.subject_enrollment_id;
  end if;

  select count(*) into v_count from public.worksheet_assignments where worksheet_id=p_worksheet_id;
  if v_count=0 then raise exception 'NO_TARGETS'; end if;
  update public.worksheets set status='published',published_at=clock_timestamp(),
    reference_code=coalesce(reference_code,upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)))
  where id=p_worksheet_id returning * into v_ws;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'PUBLISH_WORKSHEET','worksheet',p_worksheet_id::text,jsonb_build_object('assigned_count',v_count));
  return v_ws;
end;
$$;

create or replace function public.my_submission_override_v15(p_worksheet_id uuid)
returns table(
  has_override boolean,
  expires_at timestamptz,
  allow_late boolean,
  allow_resubmit boolean,
  extra_attempts integer
)
language sql stable security definer
set search_path=public,private,pg_temp
as $$
  select
    private.has_active_override(p_worksheet_id,auth.uid(),clock_timestamp()),
    private.override_expiry(p_worksheet_id,auth.uid()),
    private.active_override_allows_late(p_worksheet_id,auth.uid(),clock_timestamp()),
    private.active_override_allows_resubmit(p_worksheet_id,auth.uid(),clock_timestamp()),
    private.active_override_extra_attempts(p_worksheet_id,auth.uid(),clock_timestamp())
  where private.is_active_user(auth.uid());
$$;
revoke all on function public.my_submission_override_v15(uuid) from public,anon;
grant execute on function public.my_submission_override_v15(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- V15 account-state RLS hardening: pending/rejected/suspended accounts cannot
-- read learning/attendance/exam enrollment data through direct REST queries.
-- ---------------------------------------------------------------------------
drop policy if exists exam_assignments_read on public.exam_assignments;
create policy exam_assignments_read on public.exam_assignments
for select to authenticated
using (private.is_admin() or (private.is_active_user(auth.uid()) and user_id=auth.uid()));

drop policy if exists exams_read on public.exams;
create policy exams_read on public.exams
for select to authenticated
using (
  private.is_admin()
  or (
    private.is_active_user(auth.uid())
    and status in ('published','closed')
    and exists(select 1 from public.exam_assignments a where a.exam_id=exams.id and a.user_id=auth.uid())
  )
);

drop policy if exists subject_enrollments_read on public.subject_enrollments;
create policy subject_enrollments_read on public.subject_enrollments
for select to authenticated
using (private.is_admin() or (private.is_active_user(auth.uid()) and user_id=auth.uid()));

drop policy if exists attendance_records_read on public.attendance_records;
create policy attendance_records_read on public.attendance_records
for select to authenticated
using (
  private.is_admin()
  or (private.is_active_user(auth.uid()) and user_id=auth.uid())
  or exists(
    select 1 from public.attendance_sessions s
    where s.id=attendance_records.session_id
      and private.is_classroom_leader(s.classroom_id,auth.uid())
  )
);

drop policy if exists classroom_leaders_read on public.classroom_leaders;
create policy classroom_leaders_read on public.classroom_leaders
for select to authenticated
using (private.is_admin() or (private.is_active_user(auth.uid()) and user_id=auth.uid()));

drop policy if exists academic_history_read on public.academic_history;
create policy academic_history_read on public.academic_history
for select to authenticated
using (private.is_admin() or (private.is_active_user(auth.uid()) and user_id=auth.uid()));

-- ---------------------------------------------------------------------------
-- Privileged helper hardening: approval state is part of every active/admin or
-- classroom-leader capability check.
-- ---------------------------------------------------------------------------
create or replace function private.is_admin(uid uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path=public,private,pg_temp
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=uid and p.role='admin' and p.active=true and p.approval_status='approved'
  );
$$;

create or replace function private.is_classroom_leader(p_classroom_id uuid,p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path=public,private,pg_temp
as $$
  select private.is_active_user(p_user_id) and exists(
    select 1 from public.classroom_leaders l
    join public.classroom_memberships m on m.classroom_id=l.classroom_id and m.user_id=l.user_id and m.active
    where l.classroom_id=p_classroom_id and l.user_id=p_user_id and l.active
  );
$$;

create or replace function private.can_view_user_presence(p_target uuid,p_viewer uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path=public,private,pg_temp
as $$
  select p_viewer is not null and private.is_active_user(p_viewer) and (
    p_target=p_viewer or private.is_admin(p_viewer) or exists(
      select 1 from public.classroom_leaders l
      join public.classroom_memberships lm on lm.classroom_id=l.classroom_id and lm.user_id=l.user_id and lm.active
      join public.classroom_memberships tm on tm.classroom_id=l.classroom_id and tm.user_id=p_target and tm.active
      where l.user_id=p_viewer and l.active
    )
  );
$$;
