# Testing strategy

## Frontend

Run from the repository root:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Vitest continues to cover telemetry validation, calculations, chart behavior, demo-mode isolation, prototype fallback authentication, and notification adapters with mocked networks. The production build verifies the standalone Next.js image input.

## Backend

Run with Python 3.12+ and the test extra:

```text
ruff check backend
pytest backend/tests
```

Backend tests use SQLite for fast transaction and API tests. They cover:

- database login, `/auth/me`, expiry, revocation, logout, CSRF, origin checks, and rate limiting;
- `401` versus `403` behavior;
- entry by all project roles, owner-only revision/submission, and Staff edit-window expiry;
- project-membership role enforcement across projects;
- Staff/Researcher/Professor audit scopes and separate pending/personal action endpoints;
- Researcher validation and Professor certification;
- completion request and approval;
- append-only audit protection and same-transaction audit creation; and
- Alembic upgrade from an empty database.

PostgreSQL-specific trigger behavior is verified by the Compose smoke job because SQLite cannot execute the PostgreSQL trigger function.

## Compose smoke and persistence

`scripts/smoke-local.mjs` runs through the browser-facing port and never addresses the backend service name. It verifies health, all three database users, authorization failures, the full measurement workflow, and completion approval.

After a normal `docker compose down` and `docker compose up -d`, `scripts/check-persistence.mjs` confirms the shared record remains in PostgreSQL. The smoke flow must never use `down -v`.

## CI order

1. Frontend install, lint, typecheck, Vitest, and build.
2. Python install, Ruff, pytest, and Alembic migration test.
3. `docker compose config`.
4. Build and start exactly three services.
5. Bootstrap non-production smoke users.
6. Run full workflow smoke test.
7. Stop without deleting the volume, restart, and verify persistence.
8. Stop services in an always-run cleanup step.

No automated test may receive live MailerSend or LINE credentials.
