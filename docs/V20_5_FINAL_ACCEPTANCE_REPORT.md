# DOC-FULL-NR V20.5 Final Acceptance Report

**Release:** V20.5 LATE TEACHER BARCODE • ADMIN ROOM GROUPS • STABLE MOBILE  
**Date:** 2026-09-23

## Acceptance
The V20.5 source aligns with the production Supabase migration `v20_5_teacher_late_barcode_admin_room_groups` and preserves the existing DOC-FULL-NR architecture.

### Late attendance
The first 15-minute flow remains unchanged. At/after the server deadline, `scan_attendance_qr_v179` rejects the normal scan route and students must scan a temporary teacher-issued `DOCNR-LATE` token. The server validates account eligibility, classroom membership, approved subject enrollment, token expiry, attendance-session timing, idempotency and audit history.

### Admin room groups
Admin-defined groups are stored separately from subject enrollment and classroom history. Admin can create/update groups, replace active members, and bulk-enroll a group into a subject. Bulk enrollment also reconciles published worksheet and exam assignments.

## Verification
All static contracts and all browser contracts included in the release were run. V20.5 production backend was also exercised in a rollback-only transaction: teacher token issue, student late scan, session closure and Admin group membership all passed. No smoke-test data was retained.

## Residual risks
Supabase Security/Performance Advisors still contain project-wide warnings described in `V20_5_TEST_RESULTS.txt`; they are not hidden or represented as zero-warning. Physical mobile-camera hardware/permission dialogs must still be accepted on representative Android/iPhone devices before a large classroom rollout.
