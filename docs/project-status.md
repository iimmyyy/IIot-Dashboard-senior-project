# BioDry project status

Status date: 2026-11-06
Scope: frontend prototype plus PR 1 security and documentation guardrails

## Executive status

BioDry is a polished Next.js monitoring and workflow demonstration. It is not a production control system or a production data platform.

The current repository includes simulated telemetry, charts, alerts, browser-local daily records and batch state, prototype roles, and server-only notification adapters. PR 1 makes the prototype authentication and notification-test paths fail closed outside explicitly configured demonstration use. It also records the unresolved mismatch between the one-reactor physical specification and the L1/L2/L3 software model.

Do not connect real laboratory data, real operational permissions, or PLC control to this version.

## Implemented application capabilities

- Next.js 16 App Router application at the repository root, compatible with the existing Vercel build layout.
- English monitoring UI for Overview, Temperature Trends, Daily Records, Experiment History, Alerts, and System Status.
- Simulated Top/Middle/Bottom temperature data, freshness checks, visible gaps, Bangkok-time display, Celsius units, chart zoom, and CSV export.
- Alert acknowledgement separate from resolution.
- Quadratic temperature-peak review signal with transparent evidence.
- Separate proposed Criterion T calculation with `unavailable` and `insufficient_data` states.
- Browser-local daily records, batch lifecycle, alert acknowledgements, and audit demonstrations.
- Source-owned role UI for Professor, Researcher, and Staff.
- MailerSend and LINE provider adapters with fixed server-side recipients.
- Unit/integration tests and GitHub Actions running install, lint, typecheck, tests, and production build.

All browser-local records and role actions are demonstration behavior. They are not shared, durable, transactionally enforced, or suitable for research records.

## PR 1 security guardrails

### Authentication

- `production` is the default profile when `NODE_ENV=production` and no deployment profile is set.
- Prototype accounts cannot authenticate in `production`.
- `local-demo` cannot run under `NODE_ENV=production`.
- `public-demo` works only with simulated data, a deployment-provided non-default password of at least 16 characters, and a non-default session secret of at least 32 characters.
- The former fallback HMAC secret and the example placeholder are rejected.
- Invalid or missing session configuration causes session decoding to return no session; session creation fails instead of signing with a known secret.
- Session cookies are HTTP-only, SameSite Strict, Secure in production, high priority, path-scoped, signed, and limited to eight hours.
- Prototype login has a process-local five-attempt/15-minute limit by client and username.

The session remains a signed-cookie-only prototype. There is no durable session inventory, revocation, shared lockout, account lifecycle, or institutional identity integration.

### Notification tests

- Provider tests are unavailable in `public-demo` and `production`, even if the previous enable flag is set.
- Local tests require the explicit flag plus an authenticated Professor or Researcher.
- The route requires a same-origin JSON request, rejects extra destination fields, limits request size, and applies a process-local three-attempt/10-minute limit per actor and client.
- Recipients and credentials remain server-only.
- Test attempts and outcomes use the temporary structured server-log audit sink.
- Automated tests use mocked providers and cannot send live messages.

Process-local rate limits and console audit events are best-effort development controls. They are not durable or globally consistent in Vercel/serverless environments.

## Physical architecture status

The latest authoritative project description is one vertically connected reactor/chamber with Top, Middle, and Bottom temperature zones and one shared blower at the bottom.

The current UI and browser models instead treat L1/L2/L3 as separate machines, each with Top/Middle/Bottom readings. Daily records and batch state are keyed by `experiment_id + chamber_id`. Historical L1/L2/L3 labels may represent lysimeters, apparatuses, or experiment configurations rather than the new physical reactor.

PR 1 does not perform a breaking rename or data migration. The contradiction and the target identity boundaries are documented in [architecture.md](./architecture.md). Questions requiring professor and hardware-team confirmation are in [open-questions.md](./open-questions.md).

## Current role-permission review

| Operation                      | Current prototype                                       | Professor requirement supplied in Issue #1                     | Status                                                   |
| ------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| Enter daily field measurements | Researcher only                                         | Staff records field measurements, subject to scope/edit limits | Contradiction; do not treat current behavior as approved |
| Validate measurements          | No distinct validation state                            | Researcher validates                                           | Missing                                                  |
| Final certification            | No distinct certification state                         | Professor certifies/rejects                                    | Missing                                                  |
| Request experiment completion  | No request state                                        | Researcher requests completion                                 | Missing                                                  |
| Complete a batch               | Researcher or Professor directly after quadratic signal | Professor approves final completion after research review      | Contradiction                                            |
| Start next batch               | Researcher or Professor                                 | Unconfirmed                                                    | Open question                                            |
| Authorization scope            | Role only in client/browser functions                   | Project/reactor scope enforced by backend                      | Missing                                                  |
| Audit                          | Browser storage and server console                      | Durable immutable audit trail                                  | Missing                                                  |

PR 1 reviews and documents these differences. It does not implement the future workflow because the exact permission matrix is unresolved and backend enforcement belongs to PR 3.

## Research and safety status

- The quadratic peak is an advisory trend-review heuristic, not the validated T/D/E stopping rule.
- Criterion T remains a proposed temperature-only rule pending methodology approval.
- Drying Rate and Air Utilization are not inferred from temperature.
- Acknowledgement, validation, certification, or experiment completion does not mean the blower stopped.
- Blower status remains `unknown` when no authoritative measurement exists.
- The application contains no blower-control command and performs no automatic physical action.

## Not implemented in PR 1

- FastAPI, PostgreSQL, SQLAlchemy, Alembic, or Docker Compose.
- Durable users, sessions, projects, reactors, sensors, experiments, records, approvals, audit logs, or notification outbox.
- Backend object-level authorization or workflow state machine.
- MQTT, gateway, PLC, InfluxDB, or TimescaleDB integration.
- Automatic production notification delivery.
- Automatic or manual web blower control.

These items remain ordered for later PRs in Issue #1.

## Deployment status

- The Next.js application remains at the repository root.
- The Vercel `next build` command and root application layout are unchanged. The local `typecheck` script now generates Next.js route types first so a clean CI checkout can be checked reliably.
- No Vercel project files or build commands are changed by PR 1.
- Public demo deployment now requires explicit server environment settings; see the README and [architecture.md](./architecture.md).
- Repository settings do not prove the current Vercel environment is safe. A project owner must inspect Production and Preview variables before deploying this branch.

## Validation

The required branch checks are:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Final results for this branch are recorded in the pull request. Automated tests cover the deployment policy, rejection of known/default secrets, session expiry/tampering, local abuse controls, notification route origin/role/body/rate checks, provider contracts with mocked network calls, research calculations, telemetry validation, and browser-local prototype workflows.

## Next work

1. Obtain answers in [open-questions.md](./open-questions.md).
2. Complete and verify the P0 items in [security-backlog.md](./security-backlog.md).
3. PR 2: add the backend/database/container skeleton without moving the root frontend.
4. PR 3: implement durable scoped authorization, measurement states, validation, certification, actions, and audit history.
5. PR 4: add telemetry and notification outbox integrations only after contracts, security, and lab validation are approved.
