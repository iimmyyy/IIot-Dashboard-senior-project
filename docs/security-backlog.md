# Security backlog before production

The current login is suitable for a local prototype only. Complete these items before connecting shared laboratory data or deploying to real users.

## Authentication and sessions

- Replace source-defined demo accounts and plaintext demo passwords with the university identity provider or a database-backed account service using a modern password hash.
- Remove the fallback session secret and fail startup when `AUTH_SESSION_SECRET` is absent outside tests. Store and rotate the secret through the deployment secret manager.
- Replace or harden the custom signed cookie session. Add server-side revocation, session inventory, forced sign-out and rotation after privilege changes.
- Add login throttling, temporary lockout and security monitoring for repeated failures.
- Review CSRF protection for every state-changing route and Server Action. Continue validating request origin and use explicit authorization checks at the operation boundary.
- Define role permissions on the backend rather than relying on hidden frontend controls.

## Data, audit and notifications

- Persist immutable authentication, batch, alert and daily-record audit events in the backend with retention and authorized access rules.
- Keep MailerSend and LINE credentials server-only, grant minimum send-only permissions, rotate them and never expose them through `NEXT_PUBLIC_` variables or logs.
- Persist the notification outbox transactionally with alert creation. Add bounded retries, exponential backoff, dead-letter review and delivery-status auditing.
- Restrict notification test operations to authorized roles, an explicit environment flag and configured recipients; never accept an arbitrary destination from a browser request.
- Add dependency and secret scanning, security headers, production HTTPS and a deployment security review.
