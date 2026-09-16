-- DOC-FULL-NR V17.9 FULL SYSTEM TRANSACTION INTEGRITY
-- Production-safe additive hardening on top of V17.8.

create table if not exists private.action_idempotency (
  actor_id uuid not null references auth.users(id) on delete cascade,
  action_kind text not null,
  entity_key text not null,
  request_key uuid not null,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,action_kind,entity_key,request_key)
);
create index if not exists action_idempotency_created_idx on private.action_idempotency(created_at desc);
revoke all on private.action_idempotency from public,anon,authenticated;

create or replace function public.admin_grade_submission_v179(
  p_submission_id uuid,p_score numeric,p_max_score numeric default null,p_grade text default null,
  p_admin_comment text default null,p_rubric_result jsonb default '{}'::jsonb,p_request_key uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_key text:=p_submission_id::text;v_old jsonb;v_result jsonb;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_request_key is null then raise exception 'REQUEST_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('grade:'||v_key,0));
  select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='grade_submission' and entity_key=v_key and request_key=p_request_key;
  if v_old is not null then return v_old || jsonb_build_object('idempotent_replay',true); end if;
  v_result:=public.admin_grade_submission_v177(p_submission_id,p_score,p_max_score,p_grade,p_admin_comment,coalesce(p_rubric_result,'{}'::jsonb));
  insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'grade_submission',v_key,p_request_key,v_result);
  return v_result || jsonb_build_object('request_key',p_request_key,'idempotent_replay',false);
end $$;
revoke all on function public.admin_grade_submission_v179(uuid,numeric,numeric,text,text,jsonb,uuid) from public,anon;
grant execute on function public.admin_grade_submission_v179(uuid,numeric,numeric,text,text,jsonb,uuid) to authenticated;

create or replace function public.admin_grade_exam_attempt_v179(p_attempt_id uuid,p_score numeric,p_comment text default null,p_request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_key text:=p_attempt_id::text;v_old jsonb;v_result jsonb;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('grade-exam:'||v_key,0));
  select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='grade_exam' and entity_key=v_key and request_key=p_request_key;
  if v_old is not null then return v_old || jsonb_build_object('idempotent_replay',true); end if;
  v_result:=public.admin_grade_exam_attempt(p_attempt_id,p_score,p_comment);
  insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'grade_exam',v_key,p_request_key,v_result);
  return v_result || jsonb_build_object('request_key',p_request_key,'idempotent_replay',false);
end $$;
revoke all on function public.admin_grade_exam_attempt_v179(uuid,numeric,text,uuid) from public,anon;
grant execute on function public.admin_grade_exam_attempt_v179(uuid,numeric,text,uuid) to authenticated;

create or replace function public.start_exam_v179(p_exam_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_result jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('start-exam:'||v_uid::text||':'||p_exam_id::text,0));
  v_result:=public.start_exam(p_exam_id);
  return v_result;
end $$;
revoke all on function public.start_exam_v179(uuid) from public,anon;
grant execute on function public.start_exam_v179(uuid) to authenticated;

create or replace function public.submit_exam_attempt_v179(p_attempt_id uuid,p_answers jsonb,p_request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_key text:=p_attempt_id::text;v_old jsonb;v_result jsonb;v_a public.exam_attempts%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('submit-exam:'||v_key,0));
  select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='submit_exam' and entity_key=v_key and request_key=p_request_key;
  if v_old is not null then return v_old || jsonb_build_object('idempotent_replay',true); end if;
  select * into v_a from public.exam_attempts where id=p_attempt_id and user_id=v_uid for update;
  if v_a.id is null then raise exception 'NOT_FOUND'; end if;
  if v_a.status<>'draft' then
    v_result:=jsonb_build_object('ok',true,'attempt_id',v_a.id,'status',v_a.status,'submitted_at',v_a.submitted_at,'grading_status',v_a.grading_status,'already_finalized',true);
  else
    v_result:=public.submit_exam_attempt(p_attempt_id,coalesce(p_answers,'{}'::jsonb));
  end if;
  insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'submit_exam',v_key,p_request_key,v_result);
  return v_result || jsonb_build_object('request_key',p_request_key,'idempotent_replay',false);
end $$;
revoke all on function public.submit_exam_attempt_v179(uuid,jsonb,uuid) from public,anon;
grant execute on function public.submit_exam_attempt_v179(uuid,jsonb,uuid) to authenticated;

create or replace function public.scan_attendance_qr_v179(p_classroom_id uuid,p_subject_id uuid,p_token uuid,p_late_after_minutes integer default 15,p_request_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_key text:=p_classroom_id::text||':'||p_subject_id::text||':'||p_token::text;v_old jsonb;v_result jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('attendance:'||v_key,0));
 select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='attendance_scan' and entity_key=v_key and request_key=p_request_key;
 if v_old is not null then return v_old || jsonb_build_object('idempotent_replay',true); end if;
 v_result:=public.scan_attendance_qr(p_classroom_id,p_subject_id,p_token,p_late_after_minutes);
 insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'attendance_scan',v_key,p_request_key,v_result);
 return v_result || jsonb_build_object('request_key',p_request_key,'idempotent_replay',false);
end $$;
revoke all on function public.scan_attendance_qr_v179(uuid,uuid,uuid,integer,uuid) from public,anon;
grant execute on function public.scan_attendance_qr_v179(uuid,uuid,uuid,integer,uuid) to authenticated;

create or replace function public.admin_record_paper_scan_v179(
 p_token text,p_storage_path text,p_original_name text,p_mime_type text default 'image/jpeg',p_size_bytes bigint default null,
 p_barcode_format text default null,p_accept_expired boolean default false,p_metadata jsonb default '{}'::jsonb,p_request_key uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_key text:=trim(p_token)||':'||p_storage_path;v_old jsonb;v_result jsonb;
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('paper-scan:'||v_key,0));
 select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='paper_scan' and entity_key=v_key and request_key=p_request_key;
 if v_old is not null then return v_old || jsonb_build_object('idempotent_replay',true); end if;
 v_result:=public.admin_record_paper_scan(p_token,p_storage_path,p_original_name,p_mime_type,p_size_bytes,p_barcode_format,p_accept_expired,coalesce(p_metadata,'{}'::jsonb));
 insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'paper_scan',v_key,p_request_key,v_result);
 return v_result || jsonb_build_object('request_key',p_request_key,'idempotent_replay',false);
end $$;
revoke all on function public.admin_record_paper_scan_v179(text,text,text,text,bigint,text,boolean,jsonb,uuid) from public,anon;
grant execute on function public.admin_record_paper_scan_v179(text,text,text,text,bigint,text,boolean,jsonb,uuid) to authenticated;

create or replace function public.admin_unlock_subject_unit_v179(
 p_subject_id uuid,p_unit_no integer,p_due_at timestamptz,p_open_at timestamptz default null,p_allow_late boolean default false,
 p_allow_resubmit boolean default false,p_max_attempts integer default 1,p_request_key uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_key text:=p_subject_id::text||':'||p_unit_no::text;v_old jsonb;v_result jsonb;
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('unlock-unit:'||v_key,0));
 select response into v_old from private.action_idempotency where actor_id=v_uid and action_kind='unlock_unit' and entity_key=v_key and request_key=p_request_key;
 if v_old is not null then return v_old || jsonb_build_object('idempotent_replay',true); end if;
 v_result:=public.admin_unlock_subject_unit(p_subject_id,p_unit_no,p_due_at,p_open_at,p_allow_late,p_allow_resubmit,p_max_attempts);
 insert into private.action_idempotency(actor_id,action_kind,entity_key,request_key,response) values(v_uid,'unlock_unit',v_key,p_request_key,v_result);
 return v_result || jsonb_build_object('request_key',p_request_key,'idempotent_replay',false);
end $$;
revoke all on function public.admin_unlock_subject_unit_v179(uuid,integer,timestamptz,timestamptz,boolean,boolean,integer,uuid) from public,anon;
grant execute on function public.admin_unlock_subject_unit_v179(uuid,integer,timestamptz,timestamptz,boolean,boolean,integer,uuid) to authenticated;

create table if not exists private.submission_notification_dispatch (
 submission_id uuid not null references public.submissions(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 event_kind text not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(submission_id,recipient_id,event_kind)
);
revoke all on private.submission_notification_dispatch from public,anon,authenticated;

create or replace function private.notify_submission_received_v179() returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_w public.worksheets%rowtype;v_p public.profiles%rowtype;r record;
begin
 if new.status not in ('submitted','confirmed') then return new; end if;
 if tg_op='UPDATE' and old.status=new.status then return new; end if;
 select * into v_w from public.worksheets where id=new.worksheet_id;
 select * into v_p from public.profiles where id=new.user_id;
 for r in select id from public.profiles where role='admin' and active=true loop
   insert into private.submission_notification_dispatch(submission_id,recipient_id,event_kind) values(new.id,r.id,'received') on conflict do nothing;
   if found then
     insert into public.app_notifications(user_id,type,title,message,metadata)
     values(r.id,'submission_received','📥 มีงานส่งใหม่',format('%s • %s',coalesce(v_p.full_name,v_p.student_code,'นักศึกษา'),coalesce(v_w.title,'ใบงาน')),
       jsonb_build_object('submission_id',new.id,'worksheet_id',new.worksheet_id,'subject_id',v_w.subject_id,'route','grading','status',new.status));
   end if;
 end loop;
 return new;
end $$;
drop trigger if exists submissions_notify_received_v179 on public.submissions;
create trigger submissions_notify_received_v179 after insert or update of status on public.submissions for each row execute function private.notify_submission_received_v179();

create or replace function private.reconcile_subject_deliveries_v179() returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_ws integer:=0;v_ex integer:=0;
begin
 with ins as (
  insert into public.worksheet_assignments(worksheet_id,user_id,assigned_by,assigned_at,assignment_source,subject_enrollment_id)
  select w.id,se.user_id,null,clock_timestamp(),'subject_enrollment',se.id
  from public.subject_enrollments se join public.profiles p on p.id=se.user_id
  join public.worksheets w on w.subject_id=se.subject_id and w.status='published'
  where se.status='approved' and p.role='user' and p.active=true and p.approval_status='approved' and p.academic_status='studying'
  on conflict(worksheet_id,user_id) do nothing returning 1
 ) select count(*) into v_ws from ins;
 with ins as (
  insert into public.exam_assignments(exam_id,user_id,assigned_by,assigned_at,assignment_source,subject_enrollment_id)
  select e.id,se.user_id,null,clock_timestamp(),'subject_enrollment',se.id
  from public.subject_enrollments se join public.profiles p on p.id=se.user_id
  join public.exams e on e.subject_id=se.subject_id and e.status='published'
  where se.status='approved' and p.role='user' and p.active=true and p.approval_status='approved' and p.academic_status='studying'
  on conflict(exam_id,user_id) do nothing returning 1
 ) select count(*) into v_ex from ins;
 return jsonb_build_object('worksheet_assignments_added',v_ws,'exam_assignments_added',v_ex,'server_time',clock_timestamp());
end $$;
revoke all on function private.reconcile_subject_deliveries_v179() from public,anon,authenticated;

create or replace function public.admin_integrity_report_v179() returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid();v_pair int;v_wa int;v_ea int;v_grade int;v_paper int;v_att int;v_score int;v_open int;
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
 select count(*) into v_pair from (
   select s.user_id,coalesce(nullif(w.settings->>'work_pair_key',''),w.id::text) k,count(*) n from public.submissions s join public.worksheets w on w.id=s.worksheet_id
   where s.status in ('submitted','confirmed','graded') group by s.user_id,coalesce(nullif(w.settings->>'work_pair_key',''),w.id::text) having count(*)>1
 ) q;
 select count(*) into v_wa from public.subject_enrollments se join public.profiles p on p.id=se.user_id join public.worksheets w on w.subject_id=se.subject_id and w.status='published'
 left join public.worksheet_assignments a on a.worksheet_id=w.id and a.user_id=se.user_id
 where se.status='approved' and p.role='user' and p.active=true and p.approval_status='approved' and p.academic_status='studying' and a.id is null;
 select count(*) into v_ea from public.subject_enrollments se join public.profiles p on p.id=se.user_id join public.exams e on e.subject_id=se.subject_id and e.status='published'
 left join public.exam_assignments a on a.exam_id=e.id and a.user_id=se.user_id
 where se.status='approved' and p.role='user' and p.active=true and p.approval_status='approved' and p.academic_status='studying' and a.id is null;
 select count(*) into v_grade from public.submissions s left join public.submission_grades g on g.submission_id=s.id
 where (s.status='graded' and (g.submission_id is null or g.grading_status<>'final')) or (g.grading_status='final' and s.status<>'graded');
 select count(*) into v_paper from public.submissions s join public.worksheets w on w.id=s.worksheet_id where w.mode='paper' and s.status in ('confirmed','graded')
 and not exists(select 1 from public.paper_scans ps where ps.submission_id=s.id and ps.scan_status in ('accepted','expired_accepted','duplicate'));
 select count(*) into v_att from (select session_id,user_id,count(*) n from public.attendance_records group by session_id,user_id having count(*)>1) q;
 select count(*) into v_score from public.submission_grades where score<0 or max_score<=0 or score>max_score;
 select count(*) into v_open from public.attendance_sessions where status='open' and coalesce(auto_close_at,started_at+interval '15 minutes')<clock_timestamp()-interval '5 minutes';
 return jsonb_build_object('ok',(v_pair+v_wa+v_ea+v_grade+v_paper+v_att+v_score+v_open)=0,'duplicate_pair_completion',v_pair,'missing_worksheet_assignments',v_wa,'missing_exam_assignments',v_ea,'grade_state_mismatch',v_grade,'paper_without_scan',v_paper,'duplicate_attendance',v_att,'invalid_grade_rows',v_score,'stale_open_attendance',v_open,'server_time',clock_timestamp());
end $$;
revoke all on function public.admin_integrity_report_v179() from public,anon;
grant execute on function public.admin_integrity_report_v179() to authenticated;

create or replace function public.admin_system_health_v179() returns jsonb language plpgsql security definer set search_path=public,private,storage,cron,pg_temp as $$
declare v_uid uuid:=auth.uid();v_base jsonb;v_integrity jsonb;v_required int;v_reconcile boolean;
begin
 if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
 v_base:=public.admin_system_health_v178();
 v_integrity:=public.admin_integrity_report_v179();
 select count(distinct p.proname) into v_required from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['admin_grade_submission_v179','admin_grade_exam_attempt_v179','start_exam_v179','submit_exam_attempt_v179','scan_attendance_qr_v179','admin_record_paper_scan_v179','admin_unlock_subject_unit_v179','admin_integrity_report_v179']);
 select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='reconcile_subject_deliveries_v179') into v_reconcile;
 return v_base || jsonb_build_object('version','V17.9-SYSTEM-HARDENED','backend_ok',coalesce((v_base->>'backend_ok')::boolean,false) and coalesce((v_integrity->>'ok')::boolean,false) and v_required=8 and v_reconcile,'integrity_ok',coalesce((v_integrity->>'ok')::boolean,false),'integrity',v_integrity,'hardened_action_rpcs',v_required,'delivery_reconcile',v_reconcile,'exam_idempotency',true,'attendance_idempotency',true,'grading_idempotency',true,'paper_scan_idempotency',true,'unit_unlock_idempotency',true,'admin_submission_notifications',true);
end $$;
revoke all on function public.admin_system_health_v179() from public,anon;
grant execute on function public.admin_system_health_v179() to authenticated;

create or replace function public.admin_system_health_v17() returns jsonb language sql stable security definer set search_path=public,private,storage,cron,pg_temp as $$
 select public.admin_system_health_v179() || jsonb_build_object('frontend_router_contract','single-owner');
$$;
revoke all on function public.admin_system_health_v17() from public,anon;
grant execute on function public.admin_system_health_v17() to authenticated;

do $$ declare j record; begin
 if to_regnamespace('cron') is not null then
   for j in select jobid from cron.job where jobname='docfullnr-reconcile-deliveries-v179' loop perform cron.unschedule(j.jobid); end loop;
   perform cron.schedule('docfullnr-reconcile-deliveries-v179','*/5 * * * *','select private.reconcile_subject_deliveries_v179();');
   for j in select jobid from cron.job where jobname='docfullnr-clean-action-receipts-v179' loop perform cron.unschedule(j.jobid); end loop;
   perform cron.schedule('docfullnr-clean-action-receipts-v179','17 3 * * *','delete from private.action_idempotency where created_at < clock_timestamp()-interval ''30 days'';');
 end if;
end $$;

select private.reconcile_subject_deliveries_v179();
notify pgrst,'reload schema';
