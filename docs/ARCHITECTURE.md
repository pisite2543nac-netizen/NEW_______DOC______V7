# V15 Architecture

## Frontend

Static PWA under `/site`. `index.html` loads one production route owner set only: `app.js`, `mobile.js`, `v15-platform.js`. Exam runs through `exam.html` + `v15-exam.js`.

Legacy V9/V11/V12/V13/V14 augmentation files may remain in repository history but **must not be loaded by V15 pages**.

## Backend

Supabase project `thjscmfqunlaqxlievna` provides Auth, PostgreSQL, RLS, RPC, Storage and Edge Functions.

### Identity lifecycle

`Auth User → profiles(pending) → Admin approval → active approved User → subject enrollment → Admin subject approval → assignments`.

### Two base roles

Only `admin` and `user`. Classroom leader is stored in `classroom_leaders` and grants a narrow attendance capability.

### Learning domain

`subjects → subject_enrollments → worksheets/exams → assignments → submissions/attempts`.

### Sensitive domain

`worksheet_answer_keys`, `submission_grades`, `exam_answer_keys`, Audit and Admin grading fields are not readable by normal User.

### Academic domain

`classrooms`, `classroom_memberships`, `academic_history`, `promotion_batches`, `promotion_items` preserve year-to-year history.

### Time contract

Client countdown is display-only. Server functions use `clock_timestamp()` to determine open/closed/due/late/attempt state.
