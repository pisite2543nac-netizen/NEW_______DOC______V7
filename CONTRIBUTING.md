# Contributing

Production frontend remains Static PWA under `/site`.

- Do not introduce React/Vite into the production path.
- One route/event owner only; avoid global competing capture listeners/MutationObservers.
- New database changes are additive migrations.
- Keep Student data and the 198 template set intact.
- Feature branches must pass CI and security checks before promotion to production.
