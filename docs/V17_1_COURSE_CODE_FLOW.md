# V17.1 Course CODE Flow

## Admin
- Every active subject has exactly one active join CODE.
- Admin sees a central CODE registry on the course page.
- Admin can copy, set or regenerate CODE.
- Active CODE values are unique across subjects.
- New active subjects automatically get a CODE.

## Student
- Student selects a subject, enters the CODE received from Admin, and calls `join_subject_with_code`.
- A valid CODE immediately approves the subject enrollment.
- Existing published worksheets are assigned to the new member.
- UI navigates directly into that subject room after successful join.
- Students cannot read `subject_join_codes` directly because RLS SELECT is Admin-only.
