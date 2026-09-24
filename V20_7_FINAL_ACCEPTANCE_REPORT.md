# DOC-FULL-NR V20.7 Final Acceptance Report

**Release:** V20.7 LONG-TERM UX • TEACHER WORKSPACE • PRODUCTION STABILITY  
**Date:** 2026-09-24

## Scope
This release prioritizes production stability and usability over preserving the previous color theme. The existing architecture and historical student data are preserved.

## UI / Device
- New final UI layer loaded last: `site/v20-longterm-ui.css`.
- Desktop: persistent dark navigation, wide content workspace, simplified cards/tables/modals.
- Tablet: touch-first two-column/adaptive layouts and drawer behavior.
- Phone: single-column content, safe-area aware padding, 44px+ controls, bottom navigation, internal table scrolling.
- Modal height and table overflow are contained; closed backdrops do not intercept touch.
- Reduced-motion is supported.

## Teacher workspace
Teacher is a real role, not an Admin alias. The UI routes teachers to scoped workflows and uses production `staff_*_v206` / `my_teacher_assignments_v206` RPCs for submissions, gradebook, attendance, exams, room-group filters, and reports. Admin-only System Settings and owner-level privileges remain outside teacher routes.

## Room groups
Admin Room Groups use the V20.6 dynamic backend: classroom linking/sync, subject binding, seat number management, auto numbering, duplicate seat detection, and history-preserving enrollment withdrawal behavior.

## Attendance / Late barcode
Normal attendance remains server-authoritative. Teacher/Admin late codes use `staff_issue_late_attendance_barcode_v206`, render QR + Code128, support rotate/revoke, and student camera fallbacks remain available.

## Production database verification
Verified against Supabase project `thjscmfqunlaqxlievna`:
- Active subjects: 11
- Digital worksheets: 187
- Paper worksheets: 187
- Canonical worksheets: 374
- Exam question bank: 550
- Production contains V20.6/V20.6.1 teacher/room-group migrations plus subsequent teacher grade/exam scope, stability/security delta, teacher submission lifecycle, canonical worksheet cleanup, and room-group filter migrations.

## Tests executed
- Static Python contracts: **36/36 PASS**.
- JavaScript syntax: `site/app.js`, `site/v16-platform.js`, `site/v16-exam.js` PASS via `node --check`.
- Chromium browser contracts PASS:
  - core browser contract
  - real-use browser contract
  - V20.2 adaptive mobile/camera
  - V20.3 interaction/camera compatibility
  - V20.4 real-device router regression simulation
  - V20.5 late barcode / room groups
  - V20.6 adaptive stability, 6 viewports/orientations

## Physical-device limitation
Automated Chromium coverage cannot prove OS-level camera permission dialogs or every physical iPhone/Android/iPad camera implementation. This release does not claim physical-device camera certification until tested on representative hardware.

## Deployment
GitHub connector write access returned HTTP 403 in this environment, so this report does not claim that V20.7 was pushed/live. The One-Click installer retains backup, local tests, commit/push, GitHub Actions wait, Pages marker verification, and failure rollback gates for execution in an authorized Windows environment.
