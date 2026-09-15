# DOC-FULL-NR V17 Master Functional Flow

## Core rule

One button = one action = one router = one backend contract. `site/app.js` is the only production shell/router owner. `site/v16-platform.js` renders feature views but never owns Sidebar navigation. V16.7 and V16.8 only enhance active views. V16.9 dashboard/rescue files remain historical source only and are not loaded by production.

## Admin main routes

- Dashboard
- Courses / subject rooms
- Students & access
- Work / grading / reports
- Attendance / classroom / presence
- Exam
- Academic year / promotion / audit / system
- Profile

## Student main routes

- Dashboard
- Catalog / CODE join
- Enrolled courses
- My work
- Attendance
- Exam
- Profile / academic history

## Course flow

Catalog -> select subject -> `join_subject_with_code` -> approved enrollment -> subject room -> 13-unit roadmap -> Admin `admin_unlock_subject_unit` sequentially -> Digital/Paper/resources assigned and exposed only for unlocked units.

## Digital work

Assignment check -> open -> draft/autosave -> required validation -> preview -> `finalize_digital_submission`. Overrides and late-credit rules remain server-side.

## Paper work

Admin print pack -> student-specific barcode/token -> whole-sheet camera capture -> private submissions storage -> `admin_record_paper_scan` -> duplicate/expiry/server validation.

## Attendance

Student QR -> authorized scanner -> 15-minute session -> Present/Late/Absent/Excused -> summary/finalize -> realtime notifications.

## Exam

Question bank -> create -> publish -> assignment -> start -> server timer -> autosave -> violations -> submit/auto-submit. Student never receives score/key/rubric/admin comment.

## Grade / academic lifecycle

Submission grading -> Gradebook 40/20/20/20 -> report/export -> promotion Prepare -> Review -> Approve -> Apply -> academic history.

## Health contract

`admin_system_health_v17()` verifies the V16.10 backend invariants and marks the frontend router contract as `single-owner`. Health checks are non-blocking and cannot stall Dashboard rendering.
