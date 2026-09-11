# Deployment Guide

## Production path

GitHub Actions deploys the `/site` directory to GitHub Pages.

## Required gate

1. Run `python tests/static_validation.py`
2. Run `node --check` for all production JS
3. Verify no V9/V11/V12/V13/V14 frontend owner is referenced by `site/index.html` or `site/exam.html`
4. Validate manifest and service-worker cache marker
5. Apply Supabase migration after a transaction dry-run/security review
6. Deploy Edge Functions
7. Create GitHub backup branch from current main
8. Create staging branch and commit V15 files
9. Verify staging source
10. Fast-forward main only after staging is valid
11. Wait for `deploy-pages.yml`
12. Verify public V15 marker

## PWA icons

Source repository stores `.png.b64` icon payloads. Pages workflow decodes them before upload so binary PWA assets are produced deterministically.

## Rollback

Frontend: move `main` back to the backup SHA and allow Pages workflow to redeploy.

Backend: V15 migration is additive. Do not perform ad-hoc destructive rollback. Correct forward with a reviewed migration while preserving Production data.
