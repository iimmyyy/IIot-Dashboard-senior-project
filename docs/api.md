# API reference

All application endpoints use the `/api/v1` prefix. Browser requests should use the same-origin path, never the private Compose hostname.

## Authentication

- `POST /auth/login` creates a database session and sets session/CSRF cookies.
- `GET /auth/me` returns the authenticated user and project memberships.
- `POST /auth/logout` revokes the current session.

Unsafe requests require the CSRF cookie value in `X-CSRF-Token` and the configured frontend origin. Unauthenticated requests return `401`; authenticated users lacking a project role return `403`.

## Research workflows

- `GET|POST /experiments`
- `GET /experiments/{experiment_id}`
- `GET|POST /daily-records`
- `PUT /daily-records/{measurement_id}`
- `POST /measurements/{measurement_id}/{submit|validate|certify|reject}`
- `GET /actions/pending` returns the authenticated user's role-scoped review queue.
- `GET /actions/mine` returns only actions performed by the authenticated user, with current workflow status and reviewer when available.
- `POST /experiments/{experiment_id}/completion-requests`
- `GET /approvals`
- `POST /approvals/{request_id}/{approve|reject}`
- `GET /alerts`
- `POST /alerts/{alert_id}/acknowledge`
- `GET /audit-events?experiment_id=...` is available to Researcher and Professor members of that experiment's project. Staff receive `403`.
- `GET /audit-events?project_id=...` is project-wide and Professor-only. Researchers must select an experiment.
- `GET /health`

OpenAPI documentation is available inside the backend container at `/api/docs`; it is intentionally not published directly to the host. All list and mutation operations are project-scoped.
