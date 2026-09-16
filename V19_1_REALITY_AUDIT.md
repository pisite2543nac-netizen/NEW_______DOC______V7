# DOC-FULL-NR V19.1 Reality Audit

## Production verified
- Supabase project `DOC-FULL-NR-UNIVERSAL` is ACTIVE_HEALTHY.
- Active subjects: 11.
- Digital templates: 187.
- Paper templates: 187.
- Logical subject-unit pairs: 187.
- Active exam question bank: 550.
- V19 attendance-gate database trigger is present.
- V19 unit schedule and digital-access RPCs are present.
- V19.1 security hardening has removed anonymous access from the new V19 RPCs and trigger-only functions.

## Deployment issue from V19.0 and fix
The V19.0 installer itself cloned, backed up and pushed correctly, but GitHub Actions stopped at the legacy V17.3 runtime contract because the exact compatibility label for the teacher resource upload control had changed. V19.1 restores the compatibility label `เพิ่มสไลด์/สื่อของครู` and adds broader V19.1 regression checks so the release is validated before Pages deployment.

## Security note
Supabase Security Advisor still reports the project-level Auth setting **Leaked Password Protection Disabled**. This setting is outside the SQL migration used by this package. Existing callable SECURITY DEFINER RPCs are also listed by the linter; the application functions retain server-side role/ownership checks. V19.1 specifically hardens the new V19 RPCs and trigger-only functions without changing legacy permissions broadly, to avoid breaking production behavior.
