# DOC-FULL-NR V21.3 — No-Sidebar Stability Release

Date: 2026-09-25

## Goal
Remove the unreliable production sidebar/drawer entirely and keep one direct navigation path per device.

## Navigation
- Desktop: Top Function Bar + Dashboard cards
- Tablet: Top Function Bar + touch-first operational pages
- Phone: Bottom Quick Actions only
- Shared controls: Home / Back / Theme / Logout
- No production Sidebar / Drawer / hamburger menu

## Stability changes
- `app.js` remains the only business router/shell owner
- `v21-runtime.js` remains the viewport/mobile-navigation owner
- `paintNav()` updates all direct route controls rather than the retired sidebar
- runtime drawer API is retained only as no-op compatibility; it cannot create an overlay
- direct route fallback no longer clicks hidden sidebar controls

## Verification
- Installer compatibility chain V20.1 → V21.3: PASS
- `static_validation.py`: PASS
- JavaScript syntax: 24/24 PASS
- Course CODE browser: PASS
- Real-use navigation browser: PASS
- Gradebook browser: PASS
- Exam Admin browser: PASS
- Adaptive mobile/camera browser: PASS
- Real-device mobile router browser: PASS
- Late barcode / Room Group browser: PASS
- V21.3 no-sidebar browser matrix: PASS

## Important scope
This release intentionally invalidates legacy acceptance checks whose sole requirement was that a sidebar/drawer exist. Those checks were replaced by direct-navigation acceptance. Business features and backend authorization were not removed.

## Hardware/live limitation
Physical iPhone/Android/iPad camera permission still requires a post-deploy smoke test. GitHub Pages live deployment is performed by the One-Click installer using the owner's Git credentials.
