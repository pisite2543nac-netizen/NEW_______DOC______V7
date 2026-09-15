-- DOC-FULL-NR V17.3 relationship disambiguation.
-- Keeps the user/profile relation unique for PostgREST embedded selects.

alter table public.subject_enrollments
  drop constraint if exists subject_enrollments_decided_by_fkey;
alter table public.subject_enrollments
  add constraint subject_enrollments_decided_by_fkey
  foreign key (decided_by) references auth.users(id) on delete set null;

alter table public.exam_attempts
  drop constraint if exists exam_attempts_graded_by_fkey;
alter table public.exam_attempts
  add constraint exam_attempts_graded_by_fkey
  foreign key (graded_by) references auth.users(id) on delete set null;

notify pgrst, 'reload schema';
