-- DOC-FULL-NR V19.0
-- Admin editable digital worksheet schedule + classroom-leader attendance gate.

create or replace function private.digital_attendance_gate_passed(
  p_user uuid,
  p_subject uuid,
  p_now timestamptz default clock_timestamp()
) returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.classroom_memberships m
    join public.attendance_sessions s
      on s.classroom_id = m.classroom_id
     and s.subject_id = p_subject
     and s.session_date = (timezone('Asia/Bangkok', p_now))::date
    join public.attendance_records r
      on r.session_id = s.id
     and r.user_id = p_user
     and r.status in ('present','late')
     and r.scanned_at is not null
    join public.profiles scanner
      on scanner.id = r.scanned_by
     and scanner.role = 'user'
     and scanner.active = true
     and scanner.approval_status = 'approved'
    where m.user_id = p_user
      and m.active = true
  );
$$;

create or replace function public.my_digital_worksheet_access_v19(p_worksheet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_w public.worksheets%rowtype;
  v_now timestamptz := clock_timestamp();
  v_required boolean := false;
  v_passed boolean := true;
  v_reason text := 'ok';
begin
  if v_uid is null or not private.can_learn(v_uid) then
    raise exception 'ACTIVE_STUDENT_REQUIRED';
  end if;

  select w.* into v_w
  from public.worksheets w
  where w.id = p_worksheet_id
    and exists (
      select 1 from public.worksheet_assignments a
      where a.worksheet_id = w.id and a.user_id = v_uid
    )
    and exists (
      select 1 from public.subject_enrollments e
      where e.subject_id = w.subject_id and e.user_id = v_uid and e.status = 'approved'
    );

  if v_w.id is null then raise exception 'NOT_ASSIGNED_OR_NOT_ENROLLED'; end if;
  if v_w.mode <> 'digital' then
    return jsonb_build_object('ok',true,'allowed',true,'reason','not_digital','server_time',v_now);
  end if;

  v_required := coalesce((v_w.settings->>'attendance_gate_required')::boolean,false);
  if v_required then
    v_passed := private.digital_attendance_gate_passed(v_uid, v_w.subject_id, v_now);
  end if;

  if v_w.status <> 'published' then v_reason := 'not_published';
  elsif v_w.open_at is not null and v_now < v_w.open_at then v_reason := 'not_open';
  elsif v_w.closed_at is not null and v_now >= v_w.closed_at then v_reason := 'closed';
  elsif v_w.due_at is not null and v_now > v_w.due_at then v_reason := 'deadline_passed';
  elsif v_required and not v_passed then v_reason := 'attendance_required';
  else v_reason := 'ok'; end if;

  return jsonb_build_object(
    'ok',true,
    'allowed',v_reason='ok',
    'reason',v_reason,
    'attendance_required',v_required,
    'attendance_passed',v_passed,
    'open_at',v_w.open_at,
    'due_at',v_w.due_at,
    'server_time',v_now,
    'subject_id',v_w.subject_id,
    'worksheet_id',v_w.id
  );
end;
$$;

grant execute on function public.my_digital_worksheet_access_v19(uuid) to authenticated;

create or replace function private.enforce_submission_attendance_gate_v19()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_w public.worksheets%rowtype;
  v_actor uuid := auth.uid();
  v_required boolean := false;
begin
  -- Only gate changes made by the learner to their own digital submission.
  if v_actor is null or v_actor <> new.user_id then return new; end if;
  if new.status::text not in ('draft','submitted') then return new; end if;

  select * into v_w from public.worksheets where id = new.worksheet_id;
  if v_w.id is null or v_w.mode <> 'digital' then return new; end if;

  v_required := coalesce((v_w.settings->>'attendance_gate_required')::boolean,false);
  if v_required and not private.digital_attendance_gate_passed(new.user_id, v_w.subject_id, clock_timestamp()) then
    raise exception 'ATTENDANCE_CHECKIN_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_attendance_gate_v19 on public.submissions;
create trigger submissions_attendance_gate_v19
before insert or update on public.submissions
for each row execute function private.enforce_submission_attendance_gate_v19();

create or replace function public.admin_update_unit_schedule_v19(
  p_subject_id uuid,
  p_unit_no integer,
  p_open_at timestamptz,
  p_due_at timestamptz,
  p_allow_resubmit boolean default false,
  p_max_attempts integer default 1,
  p_attendance_gate_required boolean default true,
  p_request_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_count integer := 0;
  v_old jsonb;
  v_key text := p_subject_id::text||':'||p_unit_no::text;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_unit_no is null or p_unit_no < 1 or p_unit_no > 17 then raise exception 'INVALID_UNIT'; end if;
  if p_open_at is null or p_due_at is null or p_due_at <= p_open_at then raise exception 'INVALID_SCHEDULE'; end if;
  if coalesce(p_max_attempts,0) < 1 or p_max_attempts > 20 then raise exception 'INVALID_MAX_ATTEMPTS'; end if;

  perform pg_advisory_xact_lock(hashtextextended('v19-unit-schedule:'||v_key,0));

  select response into v_old
  from private.action_idempotency
  where actor_id=v_uid and action_kind='update_unit_schedule_v19' and entity_key=v_key and request_key=p_request_key;
  if v_old is not null then return v_old || jsonb_build_object('idempotent_replay',true); end if;

  update public.worksheets
  set open_at = p_open_at,
      due_at = p_due_at,
      allow_late = false,
      allow_resubmit = coalesce(p_allow_resubmit,false),
      max_attempts = p_max_attempts,
      settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{attendance_gate_required}', to_jsonb(coalesce(p_attendance_gate_required,true)), true),
      updated_at = v_now
  where subject_id = p_subject_id
    and mode = 'digital'
    and coalesce((settings->>'template_ready')::boolean,false)=true
    and private.docnr_unit_no(settings)=p_unit_no;

  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'UNIT_DIGITAL_WORKSHEET_NOT_FOUND'; end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'UPDATE_UNIT_DIGITAL_SCHEDULE','subject',p_subject_id::text,
    jsonb_build_object('unit_no',p_unit_no,'open_at',p_open_at,'due_at',p_due_at,
      'allow_resubmit',p_allow_resubmit,'max_attempts',p_max_attempts,
      'attendance_gate_required',p_attendance_gate_required,'request_key',p_request_key));

  v_old := jsonb_build_object(
    'ok',true,'subject_id',p_subject_id,'unit_no',p_unit_no,'open_at',p_open_at,'due_at',p_due_at,
    'allow_resubmit',coalesce(p_allow_resubmit,false),'max_attempts',p_max_attempts,
    'attendance_gate_required',coalesce(p_attendance_gate_required,true),'updated_count',v_count,
    'server_time',v_now,'request_key',p_request_key
  );

  insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response)
  values(v_uid,'update_unit_schedule_v19',v_key,p_request_key,v_old)
  on conflict do nothing;

  return v_old || jsonb_build_object('idempotent_replay',false);
end;
$$;

grant execute on function public.admin_update_unit_schedule_v19(uuid,integer,timestamptz,timestamptz,boolean,integer,boolean,uuid) to authenticated;

create or replace function public.admin_unlock_subject_unit_v19(
  p_subject_id uuid,
  p_unit_no integer,
  p_due_at timestamptz,
  p_open_at timestamptz default null,
  p_allow_resubmit boolean default false,
  p_max_attempts integer default 1,
  p_attendance_gate_required boolean default true,
  p_request_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;

  v_result := public.admin_unlock_subject_unit_v179(
    p_subject_id,
    p_unit_no,
    p_due_at,
    p_open_at,
    false,
    p_allow_resubmit,
    p_max_attempts,
    p_request_key
  );

  update public.worksheets
  set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{attendance_gate_required}', to_jsonb(coalesce(p_attendance_gate_required,true)), true),
      updated_at = v_now
  where subject_id = p_subject_id
    and mode = 'digital'
    and coalesce((settings->>'template_ready')::boolean,false)=true
    and private.docnr_unit_no(settings)=p_unit_no;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'SET_UNIT_ATTENDANCE_GATE','subject',p_subject_id::text,
    jsonb_build_object('unit_no',p_unit_no,'attendance_gate_required',p_attendance_gate_required,'request_key',p_request_key));

  return v_result || jsonb_build_object(
    'attendance_gate_required',coalesce(p_attendance_gate_required,true),
    'v19',true
  );
end;
$$;

grant execute on function public.admin_unlock_subject_unit_v19(uuid,integer,timestamptz,timestamptz,boolean,integer,boolean,uuid) to authenticated;


-- Existing published digital units are protected immediately after V19 deploy.
update public.worksheets
set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{attendance_gate_required}', 'true'::jsonb, true),
    updated_at = clock_timestamp()
where mode='digital'
  and status='published'
  and coalesce((settings->>'template_ready')::boolean,false)=true;
