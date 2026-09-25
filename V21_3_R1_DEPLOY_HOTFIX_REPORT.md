# DOC-FULL-NR V21.3 R1 — Deploy/CI Hotfix

## Root cause from real installer log
V21.3 source contracts and JavaScript checks passed locally, release commit was pushed, then GitHub Actions failed in `Validate release`; installer correctly reverted the release commit.

## Root cause reproduced
- `tests/v197_programming_activity_contract.py` accepted programming assets only through V21.2.
- `tests/v202_adaptive_mobile_camera_contract.py` accepted the camera runtime service-worker asset only through V21.2.
- `tests/v206_adaptive_stability_browser_contract.py` still asserted the legacy sidebar/backdrop model although V21.3 intentionally removes the production sidebar/drawer.

## R1 fixes
1. Extend V19.7 programming asset compatibility to V21.3.
2. Extend V20.2 camera/service-worker compatibility to V21.3.
3. Make V20.6 browser compatibility validate the V21.3 no-sidebar architecture instead of requiring the removed legacy backdrop behavior.
4. Make the Windows One-Click installer run the same full static contract list as GitHub Actions before pushing `main`.
5. Keep the V21.3 application/runtime/business logic unchanged; this R1 is a release-gate/deploy hotfix.

## Release state
The original V21.3 attempt was rolled back by the installer after Actions failure. R1 is intended to deploy the same V21.3 application with corrected validation contracts.
