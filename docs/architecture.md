# BioDry architecture

## Local application boundary

The Issue #3 development environment contains exactly three containers:

```text
Browser
  -> localhost:3000
     Next.js frontend
       -> /api/v1 rewrite on the private Compose network
          FastAPI backend:8000
            -> SQLAlchemy + Alembic
               PostgreSQL:5432 + named volume
```

Only port 3000 is published. The browser never receives the private backend URL or database credentials. FastAPI is the authorization and transaction boundary; PostgreSQL is the durable source of truth for identities and research workflows. The frontend remains in the repository root and uses Next.js standalone output.

Temperature cards and charts are still clearly labeled simulated data. They are intentionally not written to PostgreSQL. PLC, MQTT, Vercel, notification delivery, and blower control are outside this milestone.

## Physical research model

The verified physical description is one vertically connected biodrying reactor with Top, Middle, and Bottom temperature zones and one shared blower at the bottom. The application never issues blower commands. Sensor identifiers, calibration details, and the authoritative historical mapping remain unresolved.

The earlier UI used L1, L2, and L3 as if they were separate machines, while also creating Top, Middle, and Bottom readings inside each selection. That could imply nine physical zones and contradicts the single-reactor description. Issue #3 therefore stores the original dataset label only as provenance; it does not claim that L1/L2/L3 are reactors, sensors, or physical positions. See [open-questions.md](open-questions.md).

## Persistent domain model

The database keeps the following concepts separate:

- users, server-side sessions, projects, and project memberships;
- reactors and sensor inventory metadata;
- experiments and their lifecycle;
- nullable daily measurements and immutable revisions;
- completion requests and professor decisions;
- alerts and acknowledgements;
- append-only audit events; and
- a notification outbox schema with no active delivery worker.

Scientific roles are scoped through project membership. Technical system administration is a separate flag and does not grant scientific approval authority.

## Workflow and safety boundaries

Staff create or revise drafts and submit them. Researchers validate or return submitted records and may request experiment completion. Professors certify or return validated records and approve or reject completion requests. Each mutation and its audit event commit in the same database transaction.

Research approval is not an equipment command. Criterion T, trend heuristics, acknowledgement, validation, certification, or experiment completion never means “stop the blower.” No automatic physical action exists in this stack.

## Authentication boundary

The Compose profile uses only PostgreSQL-backed accounts. Passwords use Argon2id. Random session tokens are kept in an HttpOnly SameSite cookie and stored in the database only as hashes. Session expiry, revocation, logout, database-backed login throttling, same-origin checks, CSRF checks, and project-role checks are enforced by FastAPI.

The older prototype login remains available only outside backend-auth mode for isolated demo compatibility. It cannot authenticate to the research API or grant access to database workflows.
