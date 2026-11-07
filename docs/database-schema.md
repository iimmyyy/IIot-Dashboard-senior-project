# Database schema

Alembic owns schema creation. The initial migration creates:

| Area       | Tables                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Identity   | `users`, `auth_sessions`, `login_rate_limits`                                                        |
| Scope      | `projects`, `project_memberships`                                                                    |
| Research   | `reactors`, `sensors`, `experiments`, `measurements`, `measurement_revisions`, `completion_requests` |
| Operations | `alerts`, `alert_acknowledgements`, `audit_events`, `notification_outbox`                            |

Measurements permit null scientific values so a project member can save their own partial draft. The API requires at least one range-checked collected value. Every edit adds an immutable revision before changing the current record. Only the entry owner may revise or submit; Staff use a configurable time window. Workflow mutations and audit events share one transaction.

PostgreSQL also installs a trigger that rejects updates and deletes on `audit_events`. The application ORM applies the same rule to catch accidental mutations during development. Project memberships carry the scientific role; `users.is_system_admin` is technical metadata only.

Run migrations with `alembic -c alembic.ini upgrade head` from the backend directory. Container startup performs the same upgrade with bounded retries before serving traffic.
