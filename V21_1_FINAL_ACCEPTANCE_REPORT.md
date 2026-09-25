# DOC-FULL-NR V21.1 Final Acceptance

## Goal
Make the phone experience a reliable field companion instead of a compressed desktop console, while preserving the complete Tablet/Desktop system.

## Mobile Essentials
The phone now exposes at most five primary navigation actions per role.

- **Admin:** Home, Attendance camera, Paper evidence capture, Work tracking, Courses
- **Teacher:** Home, Attendance camera, Work tracking, Courses, Profile
- **Student:** Home, Attendance, My work, Courses, Profile

The phone sidebar and “all menus” hamburger are removed. Desktop-heavy entry points such as exams, printing, settings, user administration, room-group administration, audit and promotion are hidden from phone UI while the underlying desktop functions remain in source.

## Reliable Back Navigation
`app.js` remains the route-history authority through `goBackUnified()`. V21.1 exposes that action on `DOCNR_BASE.goBack`. `v21-runtime.js` captures the global back button before lower UI layers can swallow the event, and provides browser-history/dashboard fallback if the bridge is unavailable. The phone back control also receives explicit touch/pointer priority.

## Desktop and Tablet Preservation
Tablet retains drawer-based touch navigation. Desktop retains the full sidebar and all existing business workflows. No database tables, submissions, grades, attendance records, exam attempts, room-group history or audit history are removed by this release.

## Validation
- Selected static regression contracts from V17 through V21.1: PASS
- Mobile/camera compatibility contracts V20.1–V20.7: PASS
- V21.1 Mobile Essentials static contract: PASS
- Browser regression scripts: 23/23 PASS
- Dedicated V21.1 Admin/Teacher/Student phone/tablet/desktop matrix: PASS
- JavaScript syntax: 24/24 PASS
- Index/Exam local asset integrity: PASS

## Remaining Real-Device Acceptance
Physical camera permissions and native browser/PWA permission prompts on iPhone, Android and iPad must still be verified on real hardware after deployment. GitHub Push/Actions/Pages live verification is performed by the One-Click installer using the repository owner's credentials.
