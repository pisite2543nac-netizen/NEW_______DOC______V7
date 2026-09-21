# DOC-FULL-NR V19.8 System Audit

V19.8 separates **กิจกรรมพิเศษ** from course-room navigation. The programming activity keeps the 21910-2010 subject UUID only as an internal namespace/configuration key; users do not need approved enrollment in that subject to use the activity.

## Verified preserved systems
- Authentication / account approval / profiles
- 11 subjects × 17 official units
- Digital/Paper worksheet pair flow and attendance gate
- Room checklist, grading, 40/20/20/20 gradebook and automatic grade cut
- Exam center, ready-made 25+25 exam preset, two-attempt/makeup backend
- Attendance / classroom leader / presence
- Print center / personalized Paper / Barcode-QR / A4 summaries
- PWA / responsive layout / mobile navigation / dark mode
- Code Typing Academy: HTML 50 + Python 50, server sessions, hash validation, ranking, quests, daily focus, official 30 stages / 40 activity points

## V19.8 changes
- New top-level **กิจกรรมพิเศษ** menu for Admin and User.
- Removed Code Typing entry buttons from all course pages.
- New special-activity hub designed for future additional activities.
- Admin activity dashboard and leaderboard use all active approved studying users, independent of course enrollment.
- Mobile bottom navigation includes the Special Activities route.

## Safety / integrity
- Activity tables remain unavailable for direct authenticated writes.
- User actions are performed through guarded SECURITY DEFINER RPCs.
- Server-authoritative session timing and SHA-256 target validation remain active.
- Activity points remain separate from the 100-point course grade.
