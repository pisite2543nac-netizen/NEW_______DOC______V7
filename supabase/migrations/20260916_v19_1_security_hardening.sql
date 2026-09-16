-- DOC-FULL-NR V19.1 SECURITY HARDENING
-- Tighten direct RPC exposure without changing classroom/business behavior.

-- Trigger-only functions should not be callable through PostgREST.
revoke all on function public.enforce_work_pair_single_completion() from public, anon, authenticated;
revoke all on function public.sync_submission_status_from_grade() from public, anon, authenticated;

-- Admin and learner V19 RPCs require an authenticated session.
revoke execute on function public.admin_unlock_subject_unit_v19(uuid,integer,timestamptz,timestamptz,boolean,integer,boolean,uuid) from public, anon;
revoke execute on function public.admin_update_unit_schedule_v19(uuid,integer,timestamptz,timestamptz,boolean,integer,boolean,uuid) from public, anon;
revoke execute on function public.my_digital_worksheet_access_v19(uuid) from public, anon;
grant execute on function public.admin_unlock_subject_unit_v19(uuid,integer,timestamptz,timestamptz,boolean,integer,boolean,uuid) to authenticated;
grant execute on function public.admin_update_unit_schedule_v19(uuid,integer,timestamptz,timestamptz,boolean,integer,boolean,uuid) to authenticated;
grant execute on function public.my_digital_worksheet_access_v19(uuid) to authenticated;

-- Older admin-only diagnostic RPCs must never be callable anonymously.
revoke execute on function public.admin_subject_join_code_registry() from public, anon;
revoke execute on function public.admin_system_health_v177() from public, anon;

-- Fix mutable search_path warning on exam payload trigger helper.
alter function private.enforce_exam_safe_payload_v18() set search_path = public, private, pg_temp;
