# DOC-FULL-NR V17.9 — Full System Hardening

## Transaction core
- Digital submission: V17.7 idempotent request receipt + server hard deadline + required-answer validation.
- Grading: `admin_grade_submission_v179` serializes grading, stores request receipts, and replays the same result after network retry.
- Exam: `start_exam_v179` serializes exam start; `submit_exam_attempt_v179` is idempotent; exam grading has a request receipt.
- Attendance: `scan_attendance_qr_v179` prevents duplicate business actions caused by repeated requests.
- Paper: `admin_record_paper_scan_v179` makes full-sheet evidence registration replay-safe.
- Unit release: `admin_unlock_subject_unit_v179` makes the Start Teaching action replay-safe.

## Data consistency
- `private.reconcile_subject_deliveries_v179()` repairs missing worksheet/exam assignments for approved active learners every 5 minutes.
- `admin_integrity_report_v179()` verifies: duplicate logical-pair completion, missing assignments, grade/submission mismatch, Paper without accepted scan, duplicate attendance, invalid scores, and stale attendance sessions.
- `admin_system_health_v17()` now wraps the V17.9 health contract.

## Admin/User interaction
- New Digital/Paper submissions generate an Admin notification once per submission.
- Grading continues to notify the learner.
- Deadline notifications from V17.8 remain active at 1 hour remaining and at deadline.

## Gradebook invariant
- A Digital/Paper pair is one logical work item.
- The work component uses finalized grading score ratios, not merely submission status.
- Late/Paper credit is capped at 50%.
- Work / behavior / midterm / final remain 40 / 20 / 20 / 20 unless Admin changes the subject settings to another total of 100.

## Student late-work invariant
Digital is the on-time channel only. After the server deadline, the student uses the personalized Paper workflow and Admin full-sheet scan. The UI no longer presents “allow late Digital” as a normal teaching option.
