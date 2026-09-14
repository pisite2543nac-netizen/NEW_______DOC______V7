# V16 Exam + Gradebook + Paper Scan

## Exam rules
50 MCQ / 4 choices / 75 minutes / 20 points / 1 attempt by default. Formula is correct × 20 / 50. Student result screens never expose score or answer key.

## Gradebook
Total = Work 40 + Behavior 20 + Midterm 20 + Final 20. Work denominator is the number of worksheets actually assigned to that user in the subject, not the count of ready templates.

## Paper full-sheet evidence
The barcode/QR identifies the authoritative token. The camera capture is a full-sheet evidence copy. Admin verifies token state and metadata against the server before accepting the scan. Evidence is stored privately and served by signed URLs.

## Realtime
The UI subscribes only to relevant subject/work/exam/scan data and debounces rerenders to avoid the legacy MutationObserver freeze problem.
