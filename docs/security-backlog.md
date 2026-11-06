# Security backlog

This backlog records implemented prototype guardrails and the work still required before real laboratory data or operational permissions are connected. A checked prototype control is not a production security certification.

## PR 1 guardrails implemented

- [x] Production defaults to a fail-closed `production` profile when `BIODRY_DEPLOYMENT_PROFILE` is absent.
- [x] Source-defined demo accounts are disabled in `production`.
- [x] `local-demo` is rejected when `NODE_ENV=production`.
- [x] `public-demo` is restricted to simulated data and requires a non-default deployment password of at least 16 characters.
- [x] Enabled demo login requires a non-default `AUTH_SESSION_SECRET` of at least 32 characters.
- [x] The former fallback session secret and the example placeholder are rejected.
- [x] Session cookies are HTTP-only, Secure in production, SameSite Strict, high priority, path-scoped, signed, and time-limited.
- [x] Prototype login has a best-effort process-local limit of five attempts per client/username per 15 minutes.
- [x] Notification provider tests are always disabled in `public-demo` and `production`.
- [x] Local notification tests require an authenticated Professor or Researcher, a same-origin JSON request, fixed server-side recipients, a 1 KiB body limit, and a best-effort limit of three tests per actor/client per 10 minutes.
- [x] Notification test request, acceptance, failure, and rate-limit events use the temporary server audit sink without logging secrets or recipients.
- [x] Automated tests mock providers and verify fail-closed deployment, session-secret, origin, role, recipient, and throttling behavior. Tests never send live messages.

## P0 before real users or research data

- [ ] Replace prototype accounts with the approved university identity provider or database-backed identities.
- [ ] Store only modern password hashes if local passwords are approved; implement enrollment, reset, disablement, and compromise response.
- [ ] Replace signed-cookie-only sessions with durable server-side sessions or approved identity tokens, including revocation, inventory, forced sign-out, privilege-change rotation, idle timeout, and absolute timeout.
- [ ] Replace process-local login throttling with a trusted, shared rate-limit/lockout store. Define proxy/IP trust and monitoring rules.
- [ ] Enforce project/reactor-scoped authorization at every backend read and mutation boundary. Hidden frontend controls are insufficient.
- [ ] Add explicit CSRF protection appropriate to the selected backend/session architecture for every state-changing endpoint. Retain origin checks and strict cookies as defense in depth.
- [ ] Persist immutable audit events with append-only controls, retention, authorized query access, integrity monitoring, and incident export.
- [ ] Verify production and preview environment variables in Vercel. Do not assume repository documentation reflects deployed settings.
- [ ] Rotate any provider credentials used during development and review provider-side access logs and scopes.
- [ ] Add automated secret scanning, dependency review, code scanning, security headers, HTTPS/HSTS review, and branch protection.

## Notifications before activation

- [ ] Remove direct provider calls from user request latency; write alert and outbox jobs in one database transaction.
- [ ] Implement a worker with bounded retry, exponential backoff, deduplication, delivery status, and dead-letter review.
- [ ] Persist provider request IDs and audit recipient-configuration changes without exposing recipient data to unauthorized users.
- [ ] Use distributed rate limiting and an approval policy for any non-production delivery-test endpoint.
- [ ] Define provider timeouts, outage behavior, delivery objectives, credential rotation, and incident response.
- [ ] Ensure CI, preview deployments, and automated tests use fake adapters and cannot access live provider secrets.

## Data and application security

- [ ] Move daily records, batch state, alert acknowledgements, and browser audit demonstrations out of `localStorage` before shared use.
- [ ] Preserve immutable raw sensor observations and manual-entry revision history.
- [ ] Validate all API payloads, object ownership, timestamps, units, sensor inventory, and state transitions transactionally.
- [ ] Define backup, restore-test, retention, deletion, export, and research-data access policies.
- [ ] Complete threat modeling for browser, Next.js, future FastAPI, database, gateway, MQTT, notification providers, and administrators.
- [ ] Complete accessibility, cross-browser, abuse, authorization, and security acceptance testing with each approved role.

## Deployment profiles

| Profile       | Allowed data                          | Prototype login                                                             | Notification tests                       |
| ------------- | ------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| `local-demo`  | Simulated only                        | Local convenience accounts with strong session secret                       | Optional, explicitly enabled, local only |
| `public-demo` | Simulated and non-sensitive only      | Fixed usernames plus deployment-provided strong password and session secret | Disabled                                 |
| `production`  | None until real backend/auth approval | Disabled                                                                    | Disabled                                 |

Do not change this table to claim production readiness when a flag is enabled. Production readiness requires completion and verification of the P0 items above.
