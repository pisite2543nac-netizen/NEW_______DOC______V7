-- DOC-FULL-NR V15.1 Subject Rooms
-- Subjects are the single source of truth for course rooms.
-- Active approved users may read active normal subjects for course registration
-- and approved rooms remain visible even before the first worksheet is published.

drop policy if exists subjects_read on public.subjects;
create policy subjects_read on public.subjects
for select to authenticated
using (
  private.is_admin()
  or (
    private.is_active_user(auth.uid())
    and active = true
    and subject_type = 'subject'
  )
  or (
    private.is_active_user(auth.uid())
    and exists (
      select 1
      from public.worksheets w
      join public.worksheet_assignments a on a.worksheet_id = w.id
      where w.subject_id = subjects.id
        and a.user_id = auth.uid()
        and w.status = 'published'
    )
  )
);
