# DOC-FULL-NR V17.9 — Final Acceptance Report

วันที่ตรวจ: 16 กันยายน 2569

## Canonical production structure

- Active subjects: 11
- Active subject CODEs: 11
- Units: 17 / subject
- Built-in slides: 20 pages / unit
- Digital worksheets: 187
- Paper worksheets: 187
- Ready templates: 374
- Logical Digital/Paper work pairs: 187
- Minimum worksheet pages: 2
- Late/Paper credit cap: 0.50
- Gradebook default: Work 40 + Behavior 20 + Midterm 20 + Final 20

## V17.9 transaction hardening

Critical actions use server-side transactions/advisory locks and idempotent request receipts where applicable:

- join subject CODE -> unique enrollment + assignment inheritance
- Digital draft/final submit -> hard server deadline + required answers + work-pair exclusivity
- worksheet grading -> grade + submission status + audit + notification in one transaction
- exam start/submit -> lock + idempotent submit
- exam manual grading -> idempotent grading
- attendance QR scan -> idempotent scan
- Paper scan -> idempotent full-sheet evidence receipt
- unit unlock -> idempotent unlock
- assignment reconciliation -> every 5 minutes
- attendance auto-finalize -> every minute
- deadline reminders -> every minute
- stale action receipt cleanup -> daily

## Production integrity scan

All checked anomaly counters were 0 after the migration and after rollback tests:

- duplicate completed work pair: 0
- missing published worksheet assignment: 0
- missing published exam assignment: 0
- grade/submission state mismatch: 0
- confirmed Paper without scan evidence: 0
- invalid grade row: 0
- duplicate attendance record: 0
- stale open attendance session: 0

## Rollback E2E tests

The following tests were executed inside database transactions and rolled back so Production data was not retained.

### Classroom -> Digital -> Gradebook

PASS:
- correct CODE approves enrollment
- published unit assignment inherited
- Draft saves
- repeated Digital submit with the same request key returns the same submission and same attempt count
- repeated Admin grade request returns idempotent replay
- Gradebook counts one logical work pair
- Gradebook uses actual finalized score, not only completion state

### Exam

PASS:
- synthetic published exam starts
- answer submission is graded
- repeated submit request is idempotent
- correct answer produced final score in the rollback test

### Attendance

PASS:
- QR scan produced one Present record
- repeated scan with the same request key replayed the same transaction
- unique `(session_id,user_id)` record remained one row

### Paper backlog

PASS:
- Paper opens only after paired Digital deadline
- Admin scan records one Paper submission
- full-sheet metadata = true
- repeated scan request is idempotent
- late credit factor = 0.50

## Frontend validation

PASS:
- Static Validation
- Master Flow Contract
- Button Contract
- Course CODE Contract
- Branding Contract
- V17.3 Runtime Contract
- V17.4 Learning Content Contract
- V17.5 Work Pair Contract
- V17.6 Full Set Contract
- V17.6.1 Icon Contract
- V17.7 Transaction Contract
- V17.8 Notification Contract
- V17.9 Full System Hardening Contract
- JavaScript syntax checks
- Dashboard browser contract
- Course CODE browser contract
- Real-use browser contract

## Notification runtime

- worksheet deadline reminder: 1 hour before due
- deadline reached notification
- grading notification to student
- submission received notification to active Admin
- in-app realtime + PWA OS popup/replay when the application session is available

A normal PWA notification is not equivalent to a remote push service after the operating system has completely killed the application.
