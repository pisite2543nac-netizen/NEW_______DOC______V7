-- DOC-FULL-NR V16.10 unified production health contract.
-- Read-only Admin RPC used by the unified dashboard. No canonical templates are changed.
create or replace function public.admin_system_health_v1610()
returns jsonb
language plpgsql
security definer
set search_path = public, private, storage, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_standard integer; v_paper integer; v_digital integer;
  v_subjects integer; v_codes integer; v_paths integer; v_rpcs integer;
  v_rls integer; v_private_buckets integer;
  v_profile_lock boolean; v_subject_file_policy boolean;
  v_storage_subject_policy boolean; v_override_relation boolean; v_ok boolean;
begin
  if v_uid is null or not private.is_admin(v_uid) then raise exception 'ADMIN_REQUIRED'; end if;

  select count(*) filter(where reference_code is not null),
         count(*) filter(where reference_code is not null and mode='paper'),
         count(*) filter(where reference_code is not null and mode='digital')
    into v_standard,v_paper,v_digital from public.worksheets;
  select count(*) into v_subjects from public.subjects where active=true and subject_type='subject';
  select count(*) into v_codes from public.subject_join_codes where active=true;
  select count(*) into v_paths from (
    select w.subject_id from public.worksheets w join public.subjects s on s.id=w.subject_id
    where s.active=true and s.subject_type='subject' and w.reference_code is not null
      and coalesce((w.settings->>'template_ready')::boolean,false)=true
      and private.docnr_unit_no(w.settings) is not null
    group by w.subject_id having count(distinct private.docnr_unit_no(w.settings))=13
  ) q;
  select count(*) into v_rpcs from (
    select distinct p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array[
      'join_subject_with_code','my_subject_learning_path','admin_unlock_subject_unit',
      'save_worksheet_draft','finalize_digital_submission','admin_prepare_paper_print_pack',
      'admin_record_paper_scan','attendance_session_snapshot','scan_attendance_qr',
      'admin_subject_gradebook','start_exam','save_exam_answers','submit_exam_attempt',
      'prepare_promotion_batch','apply_promotion_batch'])
  ) x;
  select count(*) into v_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname=any(array[
      'profiles','subjects','subject_join_codes','subject_enrollments','worksheets','worksheet_assignments',
      'submissions','submission_grades','submission_overrides','subject_files','attendance_sessions',
      'attendance_records','exams','exam_assignments','exam_attempts','paper_tokens','paper_scans',
      'promotion_batches','promotion_items','academic_history','app_notifications','user_presence']);
  select count(*) into v_private_buckets from storage.buckets
    where id=any(array['avatars','paper-pdfs','subject-files','submissions','worksheet-files']) and public=false;
  select exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_admin_only') into v_profile_lock;
  select exists(select 1 from pg_policies where schemaname='public' and tablename='subject_files' and policyname='subject_files_read') into v_subject_file_policy;
  select exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='nangrong_subject_files_assigned_read') into v_storage_subject_policy;
  select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='user_id' and pg_get_function_arguments(p.oid) like '%submission_overrides%') into v_override_relation;

  v_ok := v_standard=198 and v_paper=55 and v_digital=143 and v_subjects=11 and v_codes=11
    and v_paths=11 and v_rpcs=15 and v_rls=22 and v_private_buckets=5 and v_profile_lock
    and v_subject_file_policy and v_storage_subject_policy and v_override_relation;

  return jsonb_build_object(
    'version','V16.10-UNIFIED-PRODUCTION','server_time',clock_timestamp(),'backend_ok',v_ok,
    'standard_templates',v_standard,'paper_templates',v_paper,'digital_templates',v_digital,
    'active_subjects',v_subjects,'active_join_codes',v_codes,'subjects_with_13_units',v_paths,
    'critical_rpcs',v_rpcs,'critical_rls_tables',v_rls,'private_buckets',v_private_buckets,
    'student_profile_readonly',v_profile_lock,
    'locked_subject_resources',v_subject_file_policy and v_storage_subject_policy,
    'submission_override_relationship',v_override_relation);
end
$$;
revoke all on function public.admin_system_health_v1610() from public, anon;
grant execute on function public.admin_system_health_v1610() to authenticated;
notify pgrst,'reload schema';
