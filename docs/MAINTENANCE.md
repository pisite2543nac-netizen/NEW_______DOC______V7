# Maintenance Plan

## Daily/weekly checks

- GitHub Pages latest deployment success
- Supabase Edge Function errors
- Registration pending count
- Failed submissions/uploads
- Audit anomalies

## Before each release

- Preserve 198 ready templates count
- Preserve Answer Key ownership/RLS
- Run static/security regression
- Confirm private storage buckets
- Confirm User does not receive grades/scores/answer keys through API
- Bump service worker cache version when frontend assets change

## Data retention

Never delete submissions, grades, academic history or audit records merely to clean the UI. Prefer inactive/archive/status transitions.

## Incident rule

If a release breaks authentication/submission/security, stop further changes, preserve evidence/logs, restore frontend backup if needed and issue a forward database fix rather than destructive data rollback.
