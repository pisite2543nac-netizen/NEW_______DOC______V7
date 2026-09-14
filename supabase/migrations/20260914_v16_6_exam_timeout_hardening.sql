-- DOC-FULL-NR V16.6 — harden exam expiry.
-- After expires_at the server ignores new client answers and grades only the autosaved answers already stored.

create or replace function public.submit_exam_attempt(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_exp timestamptz;
  v_status text;
  v_grade_status text;
  v_now timestamptz:=clock_timestamp();
begin
  if v_uid is null or not private.is_active_user(v_uid) then raise exception 'AUTH_REQUIRED'; end if;
  select expires_at,status into v_exp,v_status
  from public.exam_attempts
  where id=p_attempt_id and user_id=v_uid
  for update;
  if v_exp is null then raise exception 'NOT_FOUND'; end if;
  if v_status<>'draft' then raise exception 'ATTEMPT_FINALIZED'; end if;

  if v_now>v_exp then
    update public.exam_attempts
    set submitted_at=coalesce(submitted_at,v_exp),status='submitted',updated_at=v_now
    where id=p_attempt_id;
    perform private.grade_exam_attempt(p_attempt_id);
    select grading_status into v_grade_status from public.exam_attempts where id=p_attempt_id;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_uid,'AUTO_SUBMIT_EXPIRED_EXAM','exam_attempt',p_attempt_id::text,
      jsonb_build_object('expired_at',v_exp,'grading_status',v_grade_status,'source','submit_exam_attempt'));
    return jsonb_build_object('ok',true,'status','submitted','grading_status',v_grade_status,'submitted_at',v_exp,'expired',true);
  end if;

  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' then raise exception 'ANSWERS_MUST_BE_OBJECT'; end if;
  update public.exam_attempts
  set answers=coalesce(p_answers,'{}'::jsonb),submitted_at=v_now,status='submitted',updated_at=v_now
  where id=p_attempt_id;
  perform private.grade_exam_attempt(p_attempt_id);
  select grading_status into v_grade_status from public.exam_attempts where id=p_attempt_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'SUBMIT_EXAM','exam_attempt',p_attempt_id::text,
    jsonb_build_object('expired',false,'grading_status',v_grade_status));
  return jsonb_build_object('ok',true,'status','submitted','grading_status',v_grade_status,'submitted_at',v_now,'expired',false);
end;
$function$;
