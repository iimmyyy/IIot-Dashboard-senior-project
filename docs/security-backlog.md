# Security backlog

## Implemented for the local stack

- [x] Database-backed unique users and Argon2id hashes.
- [x] Interactive or environment-driven one-time CLI bootstrap; no application credential is hardcoded.
- [x] Random session tokens stored only as SHA-256 hashes.
- [x] HttpOnly, SameSite Strict session cookie and separate session-bound CSRF cookie.
- [x] Server-side expiry, revocation, and logout.
- [x] Database-backed login attempt limits.
- [x] Explicit same-origin validation for every unsafe HTTP method.
- [x] Strict `401` unauthenticated and `403` unauthorized behavior.
- [x] Project-scoped authorization for every read and mutation.
- [x] Owner-only measurement revision/submission and configurable Staff edit window.
- [x] Audit access separated by role: none for Staff, experiment scope for Researcher, project scope for Professor.
- [x] Project membership role, rather than the user's global label, drives workflow authorization.
- [x] Database URLs assembled from discrete settings so reserved password characters are encoded safely.
- [x] Scientific project roles separated from technical system administration.
- [x] Audit records written in the same transaction as each workflow mutation.
- [x] ORM mutation protection and PostgreSQL trigger protection for audit events.
- [x] Fixed private backend/database network boundary in Compose.
- [x] Notification delivery tests disabled in the database-authenticated Compose stack.

## Required before a production deployment

- [ ] Institutional identity, MFA, account recovery, suspension, and offboarding policy.
- [ ] Password policy and breach screening if local passwords remain allowed.
- [ ] Shared/distributed throttling if more than one backend instance is deployed.
- [ ] Secure cookies and HTTPS/TLS at the actual ingress.
- [ ] Trusted-proxy and forwarded-address configuration for the chosen topology.
- [ ] Session inventory, forced global sign-out, idle timeout, and administrator response tools.
- [ ] Secret manager integration and scheduled rotation for database/provider credentials.
- [ ] Database least-privilege roles separating migrations from application runtime.
- [ ] Backup encryption, restore drills, retention, deletion, and research-data export policy.
- [ ] Automated dependency, container, secret, and code scanning with branch protection.
- [ ] Security headers and Content Security Policy verified against the final ingress.
- [ ] Structured security monitoring, alerting, incident response, and audit export.
- [ ] Independent authorization, CSRF, session, and penetration review.
- [ ] Confirm the provisional Staff edit-window duration and correction policy with the professor.

## Notifications before activation

- [ ] Write alert and outbox rows in one transaction using approved alert rules.
- [ ] Add a separate durable worker with bounded retry, backoff, deduplication, and dead-letter review.
- [ ] Keep CI and local smoke tests on fake providers without real provider secrets.
- [ ] Audit recipient changes and delivery status without exposing recipient data.

Local Compose completion is not a production security certification.
