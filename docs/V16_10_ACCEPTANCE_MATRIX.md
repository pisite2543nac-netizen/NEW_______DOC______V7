# V16.10 Acceptance Matrix

| Flow | Frontend owner | Backend authority | Automated status |
|---|---|---|---|
| Login/Auth | app.js | Supabase Auth | source contract PASS |
| Account approval | v16-platform.js | decide_account_approval | RPC exists / RLS PASS |
| Student profile read-only | app.js/v16-7 | profiles RLS | PASS |
| All subjects catalog | v16-platform.js | subjects RLS | 11 active subjects |
| Join CODE | v16-platform.js | join_subject_with_code | RPC exists; previous transaction PASS |
| 13-unit roadmap | v16-8 | my_subject_learning_path | 11/11 complete paths |
| Sequential unlock | v16-8 | admin_unlock_subject_unit | RPC + sequential guard exists; previous transaction PASS |
| Digital draft/final | app.js | save/finalize RPC | RPC exists |
| Paper print pack | v16-7 | admin_prepare_paper_print_pack | RPC exists; payload previously transaction-tested |
| Full-sheet scan | v16-platform/v16-7 | storage + admin_record_paper_scan | private bucket/policy/RPC PASS |
| Attendance | v16-platform | attendance RPCs | RPC/RLS present |
| Exam | v16-exam | exam RPCs | RPC/RLS present; JS syntax PASS |
| Gradebook | v16-platform | admin_subject_gradebook | RPC exists |
| Promotion | v16-platform | promotion RPCs | RPC exists |
| Reports/Audit/System | app.js base router | RLS/admin RPCs | direct router bridge PASS |
| PWA cache | sw.js | GitHub Pages | V16.10 cache contract PASS |

Final Production acceptance additionally needs one real-device smoke run after deployment because camera/browser permission behavior cannot be validated from the source container.
