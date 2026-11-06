# Testing strategy

The test pyramid keeps fast research-rule and data-contract feedback on every change, while reserving browser tests for the workflows that need a real UI and backend boundary.

## Unit tests

Run with `npm test`. Unit tests cover:

- Zod input contracts and unit/range validation.
- Role permissions (`researcher` writes; `professor` and `staff` read).
- Daily-record uniqueness and field-level change calculation.
- Polynomial peak and Criterion T calculations.
- Notification outbox idempotency keys and message formatting.
- MailerSend and LINE request contracts, fixed server-side recipients and LINE retry headers with mocked network responses.
- Telemetry calculations, ordering and export formatting.

These tests do not access a network, email provider or LINE.

Manual delivery tests use the authenticated `POST /api/notifications/test` route only when `NOTIFICATION_TEST_ENABLED=true`. The destination comes from server environment variables and cannot be supplied in the request body. Never enable this route in CI or point automated tests at real providers.

## Integration tests

Integration cases also run in Vitest and use controlled in-memory browser storage or mocked fetch calls. They cover:

- Saving a daily record and its audit event as one application operation.
- Updating the same `experiment + date + chamber` without creating a duplicate.
- Loading valid records and recovering safely from damaged demo storage.
- Alert acknowledgement persistence independent from alert resolution.
- Live API validation and failure behavior without mock-data fallback.

When FastAPI and a database are added, move persistence integration tests to an ephemeral test database and verify the record, audit event and notification-outbox rows in one transaction.

## End-to-end tests

Add Playwright when the persistent backend contract is available. The first browser suite should cover:

1. Unauthenticated users are redirected to sign-in.
2. Researcher signs in, creates L1/L2/L3 daily records, reloads and edits one value.
3. Switching L1/L2/L3 on Overview changes latest telemetry, history and machine-scoped alerts without mixing data.
4. Professor and Staff can view the same records but cannot see or call daily-record write actions.
5. Only Temperature Peak Passed appears as a graph marker; connection and system alerts remain in the alert list only.
6. A peak-passed batch becomes Ready for Review, opens an in-page confirmation dialog, can be completed by Researcher or Professor, and writes one audit event even after a repeated request.
7. A completed machine starts the next numbered batch, returns to Running, and ignores all peak alerts detected before the new start time.
8. Creating an alert adds exactly one Email job and one LINE job to a fake outbox.
9. A failed fake notification retries without producing a duplicate delivery.

E2E tests must use fake Email and LINE adapters. CI must never send a real message.

## CI/CD gates

`.github/workflows/ci.yml` runs on every pull request and push to `main`:

1. Dependency installation with `npm ci`.
2. ESLint.
3. TypeScript type checking.
4. Unit and integration tests.
5. Production build.

Deployment should require this job to pass. Add an E2E job after Playwright and the test backend exist; run it after the production build and before deployment. Production Email/LINE secrets belong only in the deployment secret store, never in GitHub test jobs or `NEXT_PUBLIC_` variables.
