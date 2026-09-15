# DOC-FULL-NR V17.3 — Production Acceptance

## Local validation completed
- STATIC VALIDATION PASS
- MASTER FLOW CONTRACT PASS
- BUTTON CONTRACT PASS (27 critical actions)
- COURSE CODE CONTRACT PASS
- COLLEGE BRANDING CONTRACT PASS
- V17.3 RUNTIME CONTRACT PASS
- Browser contract PASS
- Course CODE browser contract PASS
- Real-use copy/fullscreen browser contract PASS
- Node syntax PASS for all active production JavaScript

## Backend production health
`admin_system_health_v17()` returned `backend_ok=true` with 11 active subjects, 11 active join codes, 198 canonical templates (55 paper + 143 digital), 13 units in all 11 subjects, 15 critical RPCs, 22 critical RLS tables, 5 private buckets, locked future resources, read-only student profile and single-owner frontend contract.

## Real-use improvements in V17.3
- Device-specific PWA installation guide for Android, iPhone/iPad, Windows and macOS.
- Preferred fullscreen installed-app display with standalone fallback and Fullscreen API control.
- Same-window exam navigation so the PWA window remains active.
- System-wide copy/cut/context-menu/selection deterrence with safe exceptions for form fields and Admin course CODE copy.
- Explicit PostgREST profile relationships for course enrollment and exam results.
- Direct paper print + Barcode controls in course/unit pages.
- Paper evidence capture requires whole-sheet preview, retake or explicit Admin confirmation before private upload.
- Every Admin unit exposes built-in teaching slides, teacher resource upload, Digital preview and Paper print controls from the same unit card.

## Platform limitation
Web/PWA code cannot guarantee OS-level screenshot prevention or true native fullscreen on every iOS/device combination. V17.3 requests the strongest standards-based PWA/fullscreen behavior available and retains a manual Fullscreen control as fallback.
