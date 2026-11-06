# BioDry Research Monitor

BioDry is a local research monitoring and approval application for a university biodrying project. The complete local stack contains exactly three application containers:

1. Next.js frontend on `http://localhost:3000`;
2. FastAPI backend on the private Compose network; and
3. PostgreSQL with a named persistent volume and no published database port.

Temperature charts remain clearly marked **Demo Mode — Simulated Data**. This milestone does not connect PLCs, MQTT, sensors, Vercel, or blower controls. Research approval never causes a physical action.

## Start the local stack

Requirements: Docker Engine with Docker Compose v2.

```powershell
Copy-Item .env.example .env
# Edit .env and set a unique POSTGRES_PASSWORD.
docker compose up --build -d
docker compose ps
```

The backend waits for PostgreSQL health, applies Alembic migrations with bounded retries, and then starts. The frontend waits for backend health. Open `http://localhost:3000` only after all three services are healthy.

The browser never uses `http://backend:8000`. Next.js proxies same-origin `/api/v1/*` requests to FastAPI over the private Compose network.

## Initialize research metadata and users

Create the local project, one reactor, and one running experiment:

```powershell
docker compose exec backend python -m app.cli init-research
```

Create database-backed users. Password input is hidden and is never stored in the repository or command history:

```powershell
docker compose exec backend python -m app.cli create-user --username staff --display-name "Laboratory Staff" --role staff
docker compose exec backend python -m app.cli create-user --username researcher --display-name "Researcher" --role researcher
docker compose exec backend python -m app.cli create-user --username professor --display-name "Professor" --role professor
```

`--system-admin` is optional and grants technical administration metadata only. It does not bypass scientific project roles.

## Persistent research workflow

- **Staff** create or revise nullable daily measurements, then submit them.
- **Researcher** validate submitted records or return them with a reason.
- **Professor** certify validated records or return them with a reason.
- After at least one certified record, a Researcher may request experiment completion.
- A Professor may approve or reject that request. Approval changes research experiment status only; it does not control the blower.

Every mutation writes an audit event in the same database transaction. Audit events are append-only in the ORM and protected by a PostgreSQL trigger. Measurement revisions retain prior values, reason, author, and timestamp.

## Authentication and request security

- Users and Argon2id password hashes are stored in PostgreSQL.
- The browser receives a random HttpOnly session token; only its SHA-256 hash is stored.
- Sessions have server-side expiry and revocation. Logout revokes the database session.
- Cookie-authenticated writes require same-origin validation and a session-bound CSRF token.
- Login attempts are limited in PostgreSQL by client and username.
- API authorization checks project membership and role at every operation boundary.
- Missing authentication returns `401`; authenticated users with the wrong role or project return `403`.

Prototype source-defined accounts remain available only when the frontend is deliberately run outside the database-authenticated stack. Compose always uses database authentication.

## Persistence and safe shutdown

Normal shutdown preserves PostgreSQL data:

```powershell
docker compose down
docker compose up -d
```

Do not use `docker compose down -v` unless permanent database deletion is explicitly intended. Backup and restore commands are documented in [docs/backup-restore.md](docs/backup-restore.md).

## Checks

Frontend:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Backend, when Python 3.12+ is installed:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/pip install -e "./backend[test]"
backend/.venv/Scripts/ruff check backend
backend/.venv/Scripts/pytest backend/tests
```

Compose validation and the full local smoke path:

```powershell
docker compose config
node scripts/smoke-local.mjs
```

The smoke script requires `BIODRY_SMOKE_STAFF_PASSWORD`, `BIODRY_SMOKE_RESEARCHER_PASSWORD`, and `BIODRY_SMOKE_PROFESSOR_PASSWORD` in the process environment. It verifies health, database login, `/auth/me`, `401`, `403`, Staff entry, Researcher validation, Professor certification, and completion approval. `scripts/check-persistence.mjs` verifies the shared record after a Compose down/up cycle.

## Repository layout

```text
/
├── src/                  Next.js application (kept at repository root)
├── backend/              FastAPI, SQLAlchemy, Alembic, pytest
├── compose.yaml          frontend + backend + db only
├── Dockerfile            standalone Next.js image
├── scripts/              local full-stack smoke checks
└── docs/                 architecture, API, operations, security, status
```

## Documentation

- [Local development](docs/local-development.md)
- [Architecture](docs/architecture.md)
- [API and workflow contract](docs/api.md)
- [Database schema](docs/database-schema.md)
- [Backup and restore](docs/backup-restore.md)
- [Deployment-neutral production requirements](docs/production-requirements.md)
- [Testing strategy](docs/testing-strategy.md)
- [Security backlog](docs/security-backlog.md)
- [Open research and hardware questions](docs/open-questions.md)
