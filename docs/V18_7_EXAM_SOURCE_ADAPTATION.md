# V18.7 — ALL_Test Exam Source Adaptation

## Source used
Uploaded source package: `ALL_Test_pisite2543nac.github.io-main(1).zip`.

The bundled `initial-question-bank-all-subjects.json` contains 550 questions (11 subjects × 50) with 4 choices per question and the exact Basic 10 / Easy 15 / Hard 25 distribution per subject.

SHA-256 of the uploaded bank and `site/data/exam-question-bank-v18.json`:

`cc56e27cbb6f38f9aee094d7aa2ed382bd3497f22a7f72b536ab763e082fd284`

## What was adapted into DOC-FULL-NR
- Exam dashboard cards and subject-oriented flow.
- Student pre-exam instruction screen.
- 50-question navigation grid with answered/current/flagged states.
- 75-minute server-backed countdown and automatic submit.
- 4-choice answer cards, autosave and resume.
- Fullscreen prompt/guard and event auditing for tab switch, fullscreen exit, copy/paste/cut, context menu and print.
- Admin question-bank UI, JSON import/export and 50-question exam creation.
- Admin results grouped/filterable by registration data: grade level, room, department and major.
- Existing room worksheet checklist from V18.6 remains in the same package.

## Intentionally NOT copied from the standalone source
- Firebase Auth / Firestore.
- Separate student registration for the exam site.
- Separate Admin username/password stored in a static site.
- localStorage as the authoritative result database.
- delayed answer-key reveal to students.

Those parts would conflict with DOC-FULL-NR's existing Supabase Auth, approval, subject enrollment, RLS, exam-safe payload and score privacy contracts.

## Backend used
The adapted UI uses the existing production contracts, including:
- `start_exam_v18`
- `submit_exam_attempt_v18`
- `save_exam_answers`
- `record_exam_violation`
- `admin_create_exam_from_bank_v18`
- `admin_import_exam_bank_v18`
- `admin_grade_exam_attempt_v18`
- `admin_reset_exam_user`

Answer keys remain server-side/Admin-only. Student exam payloads use the V18 safe-payload contract.
