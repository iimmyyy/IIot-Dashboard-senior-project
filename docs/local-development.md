# Local development

## Requirements

- Docker with Compose v2
- Node.js 24 and npm for optional host-side frontend checks

Copy `.env.example` to `.env` and set a strong, local-only `POSTGRES_PASSWORD`. Do not commit `.env`.

## Start the stack

```text
docker compose up --build -d --wait
docker compose exec backend python -m app.cli init-research
docker compose exec backend python -m app.cli create-user --username staff --display-name "Local Staff" --role staff
docker compose exec backend python -m app.cli create-user --username researcher --display-name "Local Researcher" --role researcher
docker compose exec backend python -m app.cli create-user --username professor --display-name "Local Professor" --role professor
```

The user command prompts for a password without echoing it. Open `http://localhost:3000`. The backend and database are intentionally not exposed on host ports.

## Normal lifecycle

```text
docker compose logs -f backend frontend
docker compose down
docker compose up -d --wait
```

Normal `down` preserves `biodry_postgres_data`. Running `docker compose down -v` permanently deletes the local research database and should be reserved for an intentional clean reset.

## Checks

Frontend checks run on the host with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Backend checks run with `pip install -e "./backend[test]"`, `ruff check backend`, and `pytest backend/tests`. After bootstrapping smoke users, set the `BIODRY_SMOKE_*` variables described in `.env.example`, then run `npm run smoke:local`.
