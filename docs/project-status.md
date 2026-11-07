# BioDry project status

Status date: 2026-11-07

## Current milestone

Issue #3 adds a complete local three-container application:

- standalone Next.js frontend;
- FastAPI application with SQLAlchemy 2 and Alembic; and
- PostgreSQL with a named persistent volume.

The frontend remains at the repository root. Browser API requests are same-origin through `/api/v1`; the backend and database have no published host ports.

## Implemented persistent capabilities

- PostgreSQL users with Argon2id password hashes.
- Random HttpOnly server-side sessions with expiry, revocation, and logout.
- PostgreSQL login throttling plus same-origin and CSRF protection.
- Project-scoped Professor, Researcher, and Staff memberships.
- Separate technical `is_system_admin` metadata that does not grant scientific approval.
- Projects, one-reactor metadata, sensor metadata schema, experiments, nullable manual measurements, immutable revisions, completion requests, alerts, acknowledgements, append-only audit events, and notification-outbox schema.
- Owner-only entry revision/submission for all three project roles, with a configurable Staff edit window.
- Researcher validation/rejection and Professor certification/rejection.
- Role-scoped audit access, personal action history, and a separate pending-review queue.
- Researcher completion request and Professor approval/rejection.
- Database-backed Daily Records and Experiment Workflow UI.
- Alembic migration at backend startup with bounded retries.
- Safe interactive user bootstrap and idempotent research-context initialization.

## Deliberately simulated or inactive

- Temperature telemetry and charts remain Demo Mode fixtures.
- L1/L2/L3 remain prototype telemetry dataset labels with no approved physical mapping.
- Sensor inventory is not seeded because the actual inventory is unconfirmed.
- Notification outbox rows have schema support, but no delivery worker sends Email or LINE.
- No PLC, MQTT, blower control, automatic equipment action, ML forecast, or T/D/E stopping decision exists.

## Role workflow

| Operation                              | Staff | Researcher | Professor |
| -------------------------------------- | ----- | ---------- | --------- |
| Read scoped project data               | Yes   | Yes        | Yes       |
| Create own draft measurement           | Yes   | Yes        | Yes       |
| Revise/submit own draft                | Yes¹  | Yes        | Yes       |
| Validate/return submitted measurement  | No    | Yes        | No        |
| Certify/return validated measurement   | No    | No         | Yes       |
| Request experiment completion          | No    | Yes        | No        |
| Approve/reject completion              | No    | No         | Yes       |
| Read technical audit log               | No    | Experiment | Project   |
| Read personal performed-action history | Yes   | Yes        | Yes       |

¹ Staff revisions and submissions are allowed for 24 hours after entry or return by default. `BIODRY_STAFF_EDIT_WINDOW_HOURS` changes this provisional policy. Professor confirmation is still required.

All checks run at the FastAPI operation boundary. Hiding a button is never treated as authorization.

## Verification status

The repository contains frontend tests, backend pytest coverage, Alembic migration coverage, Compose health checks, a full workflow smoke script, and a persistence check. The current development machine lacks Python and Docker, so backend and Compose execution must be confirmed by CI or a Docker-equipped reviewer. Local Node checks remain available.

## Remaining work

- Obtain professor answers in [open-questions.md](open-questions.md).
- Validate the real sensor inventory and research methodology.
- Complete deployment-neutral production controls in [production-requirements.md](production-requirements.md).
- Implement a durable notification worker only after provider and retry requirements are approved.
- Add hardware ingestion in a separate milestone; never add blower automation implicitly.
