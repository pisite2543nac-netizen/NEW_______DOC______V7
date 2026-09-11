# Test Gate

`static_validation.py` checks production structure, manifests, old route-owner references, PWA icon source assets, release markers and security-sensitive frontend patterns.

CI additionally runs `node --check` on production JS and `deno check` on Edge Functions.

Database integration/security checks are executed against Supabase during release verification; no production data is deleted by tests.
