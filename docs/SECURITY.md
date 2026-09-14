# Security Baseline

## Mandatory guarantees

1. No Service Role/API secret/private key/password is embedded in frontend or repository.
2. User cannot read another student's private profile/submission.
3. User cannot change role, active/approval status, student code, grade, room, seat or academic state.
4. User cannot read worksheet/exam answer keys.
5. User cannot read worksheet grades, grade, rubric, Admin comment or exam score/max_score.
6. Final submission is accepted only after Server validates assignment, account state, published state, open/due time, override and attempts.
7. QR/Barcode confirmation is verified on Server and bound to the assigned user/work.
8. Exports are Admin-only and audited.
9. Promotion is Admin-only and audited; history is immutable to User.
10. Storage remains private; access is via permission-checked signed URLs.

## Exam privacy

`exam_attempts` direct SELECT is Admin-only. User obtains non-sensitive state using `my_exam_attempt_status()` and submit/start RPCs never return score/max_score.

## Account approval

Self-registration produces `approval_status=pending` and `active=false`. Pending/rejected/suspended accounts can see only their account-state page and logout.

## Phone number / OTP

Phone OTP is disabled by project policy.

- Registration still collects the student's phone number.
- The number is stored in `profiles.phone` as contact information.
- Student access does not depend on SMS/OTP verification.
- Frontend has no OTP verification route or SMS gate.
- Admin maintains the phone number as part of the official student profile.
- Do not introduce fake/static OTP values.
