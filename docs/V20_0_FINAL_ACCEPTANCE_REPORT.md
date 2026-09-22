# DOC-FULL-NR V20.0 Final Acceptance

V20.0 extends the existing DOC-FULL-NR project without creating a replacement app or changing the main router architecture. The release keeps legacy contracts for grading, exams, attendance, printing, PWA, and Special Activities while making V20.0 the single user-visible release.

## Teaching presentation

The 187 built-in unit decks retain exactly 20 pages each (3,740 logical pages). Runtime content combines production worksheet metadata (`learning_goal`, `key_concepts`, `practice_steps`, `control_points`, `case_study`, `exit_questions`) with subject-specific teaching knowledge derived from the existing question-bank explanations. Answer keys and option payloads are not added to the student slide payload.

Slides include definition/explanation, concepts, principle/process, examples, correct/incorrect comparison, case study, analysis, common mistakes, troubleshooting, precautions, Digital/Paper worksheet links, exam alignment, teacher note, review question and key takeaway. Light/Dark contrast and presentation/fullscreen behavior are covered by V20 browser tests.

## Reversible teaching close

`admin_lock_subject_unit_v20` is backend-authoritative. Only the latest opened unit can be closed while a later unit is still published. Closing changes the matching canonical worksheet templates back to `draft`; assignments, submissions, grades and history are preserved. Existing reopen/unlock flow restores access without recreating academic data.

## Unified UX and Print

Admin/User dashboards expose Special Activities as a top-level area and use V20.0 visible release metadata. V19.6 Print Center features remain present; V20 adds a consistent print metadata/header treatment without removing legacy print functions.

## Production and regression

Production migrations were applied and verified with a transaction/rollback smoke check. Full static contracts, JavaScript syntax checks, browser flows and required responsive viewports passed. Supabase advisor warnings are not reported as zero; existing security/performance items remain for separate per-function/per-table audit rather than blanket revocation.
