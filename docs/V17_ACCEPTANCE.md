# DOC-FULL-NR V17 — Acceptance / Verification

Release objective: functional master flow, not a cosmetic overlay.

## Frontend architecture

- `site/app.js` is the single production Shell/Router owner.
- `site/v16-platform.js` renders feature views and returns all route transitions to `DOCNR_BASE.navigate`.
- V16.7 and V16.8 are view enhancers only.
- V16.9 clean-dashboard/runtime-rescue are not loaded by production.
- Admin and Student dashboards use direct route buttons, never hidden-menu click simulation.
- Old bulk worksheet release UI was removed from the active Admin subject room; standard templates are released through sequential unit unlock only.

## Automated source tests

- `tests/static_validation.py`: PASS
- `tests/unified_contract.py`: PASS
- `tests/button_contract.py`: PASS (27 critical button/action contracts)
- `tests/browser_contract.py`: PASS with headless Chromium and mocked backend; Admin Dashboard -> Students hub -> Users route bridge executed.
- `node --check`: PASS for active production JavaScript and service worker.

## Production backend health

`admin_system_health_v17()` verified with an authenticated Admin context:

- backend_ok: true
- templates: 198 = 55 paper + 143 digital
- active core subjects: 11
- active join codes: 11
- complete 13-unit subject paths: 11
- critical RPCs: 15/15
- critical RLS tables: 22/22
- private buckets: 5/5
- student profile read-only: PASS
- locked subject resources: PASS
- submission override computed relationship: PASS
- frontend router contract: single-owner

## Transactional production-flow tests

The following were executed inside database transactions and rolled back so no test data remained:

1. Course membership + learning path: approved enrollment -> 13 units returned.
2. Sequential unit unlock: Admin unlock Unit 1 -> Unit 1 became available; server previously rejected opening later units before prior unit.
3. Digital worksheet: assignment -> save draft -> final submit -> status `submitted`, attempt 1, not late.
4. Paper workflow: Unit 1 Paper assignment -> personalized print pack -> barcode payload present and single-line.
5. Attendance: student QR -> Admin scan -> status `present` -> automatic close deadline created.
6. Exam: temporary 50-question bank -> official 50Q/75min/20pt exam -> publish -> student start -> autosave -> submit -> grading final; submit response exposed no score.
7. Promotion: Prepare -> Approve -> Apply executed for the active test users, then rolled back.

Post-test clean-baseline verification showed zero persisted E2E enrollments/published templates/submissions/attendance sessions/exams/E2E question-bank rows/E2E promotion batches from these tests.

## Remaining unavoidable device smoke tests

These require real user hardware/browser permissions and cannot be fully simulated by database/headless tests:

- front-camera registration permission/capture on target phone
- paper full-sheet camera framing on target phone
- PWA install prompt/Add to Home Screen
- exam fullscreen behavior on the exact mobile browser

These are device smoke tests, not missing backend functions.
