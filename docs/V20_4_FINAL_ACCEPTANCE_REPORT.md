# DOC-FULL-NR V20.4 Final Acceptance Report

**Release:** V20.4 REAL-DEVICE MOBILE ROUTER • ADAPTIVE UX • CAMERA FLOW  
**Date:** 2026-09-23

## Incident reproduced from real phone recording

The V20.3 recording showed Admin **Attendance Flow** returning to the Dashboard before the camera task could be reached. Source inspection found that `renderAttendanceHub()` legitimately navigated to `attendance`, but `ADMIN_ROUTES` did not authorize `attendance`; the unified router therefore replaced the request with `dashboard`.

V20.4 fixes the route contract itself rather than adding another visual workaround.

## Acceptance changes

- Admin `attendance` is authorized and grouped under the Attendance Hub for active-nav/back behavior.
- Phone bottom navigation calls `DOCNR_BASE.navigate(route)` directly.
- App-level nav serial and feature-level nav epoch reject stale async renders.
- Camera runtime stops streams on route-start and existing page lifecycle events.
- Attendance camera permission is requested only after room and subject are selected.
- Paper Scan Hub/Center have stale-route guards.
- Phone/Tablet/Desktop receive device-specific UX while retaining the same green/white theme and system features.
- GitHub Actions workflow now includes V20.4 static and browser regression gates.

## Regression result

Production JavaScript syntax passed. Static contracts passed. Core browser flows plus V20.2/V20.3 compatibility and the new V20.4 mobile-router regression passed. The V20.4 browser test explicitly reproduces the former failure path and asserts that an Attendance tap results in `attendance` exactly once and never falls back to `dashboard`.

## Backend

No V20.4 database migration is required. Existing production backend/RPC contracts are retained.

## Remaining real-device gate

The release environment cannot physically grant an iOS/Android camera permission. Browser MediaStream lifecycle and fallback flows are tested, but an Android + iPhone smoke test after deployment remains the final hardware acceptance step.
