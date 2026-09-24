# DOC-FULL-NR V21.0 — Final Acceptance Report

## Release intent
V21.0 is a major stability rebuild driven by the supplied desktop and phone usage videos. The release removes competing presentation runtimes from the production entrypoints and establishes a single presentation authority without replacing the existing business system or deleting academic history.

## Root causes addressed
- Multiple CSS/runtime generations were simultaneously controlling viewport, drawer, navigation, loading, and responsive behavior.
- Frontend source expected V20.6+ Teacher/Room Group/Staff RPCs while the packaged migration chain stopped at V20.5.
- Release/installer gates could pass without checking the backend-alignment files required by the frontend.
- Mobile CODE lists and navigation density produced excessive scrolling and unclear next actions.

## V21 architecture
- `site/app.js`: only business shell/router owner.
- `site/v21-runtime.js`: only presentation owner for viewport, drawer/backdrop, mobile navigation, network state, route progress, and fullscreen chrome.
- `site/v16-platform.js`: feature workflows and role-scoped business integration.
- `site/v16-exam.js`: dedicated exam entrypoint.
- `site/v21-core-ui.css`: final adaptive presentation layer.
- Production entrypoints no longer load `mobile.js`, `v19-ux-runtime.js`, or `v20-stability-runtime.js`.

## Backend/source alignment
`supabase/migrations/20260924_v21_0_production_alignment.sql` consolidates the V20.6+ backend contract required by V21, including Teacher role/scope, Room Group subject/classroom synchronization, Attendance/Late Barcode staff scope, Submission/Gradebook/Exam staff RPCs, history-preserving room-group withdrawal handling, and teacher-aware submission lifecycle enforcement.

The migration is packaged for source reproducibility. The One-Click installer intentionally does **not** mutate the Production database automatically.

## Verification summary
- Static Python contracts: **37/37 PASS**.
- Browser contracts: **23/23 PASS**.
- V21 browser matrix: **27/27 PASS** across Admin/Teacher/User and nine desktop/tablet/phone viewport/orientation cases down to 288×640.
- `site/*.js` syntax: **24/24 PASS**.
- `index.html`, `exam.html`, and Service Worker asset integrity: **PASS**.
- Current Production dataset: **11 active subjects, 187 Digital, 187 Paper, 374 total worksheets, 550 exam-bank questions**.
- Required V21 Production staff/admin RPCs: **20/20 present**.

## Known external verification still required
Physical mobile-camera/permission behavior must be smoke-tested on actual iPhone/Android/iPad hardware after deployment. GitHub Actions/Pages must also be verified after the owner runs the One-Click installer with repository write credentials.

## Security advisor status
Current Production advisor findings are retained for explicit review rather than blanket privilege changes: 15 `rls_enabled_no_policy` INFO, 162 `authenticated_security_definer_function_executable` WARN, and 1 leaked-password-protection WARN. Many application operations intentionally use `SECURITY DEFINER` RPCs with authorization checks inside the functions, so bulk revocation could break the system and requires a separate per-RPC security review.
