-- V17.1 subject join CODE registry + uniqueness + automatic lifecycle
create unique index if not exists subject_join_codes_active_code_uniq on public.subject_join_codes(join_code) where active=true;
-- Production migration applied through Supabase on 2026-09-15.
-- Authoritative functions: private.ensure_subject_join_code, public.admin_subject_join_code_registry,
-- public.admin_subject_join_code, public.admin_regenerate_subject_join_code and subjects_join_code_sync trigger.
