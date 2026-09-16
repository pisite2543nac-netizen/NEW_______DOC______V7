# V17.7 Classroom Transaction Hardened

## ห้องเรียน
Student -> CODE -> Server validates active student + active subject + Admin-only join code.
Enrollment has unique (subject_id,user_id). Re-entering the same correct CODE is idempotent.
Published work assignments are upserted safely.

## Digital
- Server time controls open/due.
- Draft allowed only while Digital window is open.
- Required answers checked again on the server.
- Attachment path must belong to that user + worksheet.
- Final submit uses request_key UUID and a private receipt ledger.
- A retry with the same request key returns the same submission instead of creating another attempt.
- After due: Digital is rejected; student must use Paper.
- Digital and Paper in the same work_pair_key cannot both become completed.

## Paper
- Paper becomes the late channel after the paired Digital due time.
- Student can print their personalized Paper + Barcode only after Digital deadline.
- Student cannot self-confirm Paper.
- Admin scans Barcode + full-sheet image.
- Scan stores evidence in Private Storage and creates/confirms one Paper submission.
- Duplicate network retry for the same storage path is idempotent.
- Paper / late work credit factor = 0.50.

## Grading
Admin grades through admin_grade_submission_v177():
1. lock submission
2. validate score/max score
3. upsert final submission_grades
4. set submission = graded
5. audit log
6. notify student that grading is complete
All in one database transaction.

## Gradebook
Work component = finalized actual score ratios, not submission completion.
Digital/Paper pair = one denominator item.
On-time Digital factor = 1.00.
Paper/late factor = 0.50.
Submitted but not yet graded = completed status, but contributes 0 points until grading is final.
Components remain 40 / 20 / 20 / 20 by default.

## Backend health
admin_system_health_v17() now reports V17.7-CLASSROOM-HARDENED and checks:
- 374 templates = 187 Digital + 187 Paper
- 11 subjects with 17 units
- 187 logical pairs
- 20 slide pages/unit
- >=2 worksheet pages
- private idempotency ledger
- one-completion-per-pair trigger
- hardened Digital submit RPC
- hardened grading RPC
- real-grade Gradebook
- Paper Admin-scan-only contract
