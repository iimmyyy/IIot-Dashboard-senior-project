# BioDry architecture

This document separates verified physical facts, the current frontend prototype, and the target data model. It does not assign unresolved historical labels to physical equipment.

## Verified physical architecture

The latest project specification describes:

- one vertically connected biodrying reactor/chamber;
- temperature measurement zones at **Top**, **Middle**, and **Bottom** within that reactor;
- one shared blower installed at the bottom;
- PLC and gateway equipment that collect measurements outside the browser; and
- Phase 1 monitoring and decision support only.

The browser must not connect directly to a PLC, MQTT broker, or measurement database. The application does not issue blower commands. A missing blower status remains `unknown`; temperature evidence, acknowledgement, validation, or research approval does not prove that the physical blower was started or stopped.

Exact equipment identifiers, sensor inventory, wiring, calibration metadata, and the authoritative mapping of historical datasets still require confirmation. See [open-questions.md](./open-questions.md).

## Current prototype model

The November 6 prototype introduced `L1`, `L2`, and `L3` as three selectable `Chamber` values and presents them as separate machines. It isolates telemetry, daily records, alerts, and batch state by `experiment_id + chamber_id`.

That model conflicts with the verified one-reactor description. The conflicting implementation includes:

| Area                       | Current prototype assumption                                      | Conflict or risk                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/index.ts`       | `Chamber = L1 \| L2 \| L3`                                        | Treats an unresolved label as a physical chamber identity.                                                                       |
| Chamber selector and guide | Calls L1/L2/L3 separate machines                                  | The current physical system is one reactor with three vertical measurement zones.                                                |
| Mock telemetry             | Creates Top/Middle/Bottom readings inside each L1/L2/L3 selection | May invent nine physical zones that do not exist in the connected reactor.                                                       |
| Daily records              | Keys records by experiment, date, and `chamber_id`                | May attach field measurements to the wrong physical or historical entity.                                                        |
| Batch lifecycle            | Completes and restarts each experiment/machine pair               | Does not match the requested researcher-to-professor completion workflow and may conflate research approval with a physical run. |
| Historical labels          | Uses L1/L2/L3 as current machine identifiers                      | L1/L2/L3 may instead identify historical lysimeters, apparatuses, or experimental conditions.                                    |

PR 1 intentionally does not rename these fields, migrate browser storage, or overwrite historical meaning. The prototype remains demonstration-only until the professor confirms the mapping. A later migration must preserve the original label and provenance of every historical record.

## Target conceptual model

The future backend should keep these identities distinct:

| Concept                                           | Purpose                                                                                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project_id`                                      | Authorization and research-program boundary.                                                                                                       |
| `reactor_id`                                      | One physical connected reactor/chamber.                                                                                                            |
| `sensor_id`                                       | Stable identity for one physical sensor.                                                                                                           |
| `sensor.position`                                 | Physical position such as `top`, `middle`, or `bottom`; several sensors may share a position.                                                      |
| `experiment_id`                                   | One research experiment or run associated with a reactor and conditions.                                                                           |
| `historical_lysimeter_id` or condition identifier | Preserves L1/L2/L3 or other legacy apparatus/configuration labels without treating them as current sensor positions. The final name is unresolved. |
| `blower_id`                                       | The one shared blower associated with the reactor.                                                                                                 |
| `blower_status`                                   | Observed status only; `unknown` when no validated source is available.                                                                             |

A possible relationship is:

```text
Project
  └─ Reactor (one physical connected chamber)
       ├─ Sensors (each has Top/Middle/Bottom position metadata)
       ├─ Shared blower (observed status only)
       └─ Experiments
            └─ Optional historical apparatus/condition reference
```

This is a conceptual boundary, not an approved database schema. Cardinality, identifier formats, ownership, and historical import rules require professor and hardware-team confirmation.

## Current application boundaries

The repository root remains the Next.js 16 application used by Vercel. It currently provides:

- simulated telemetry and experiment fixtures;
- browser-local daily records, batch state, acknowledgements, and audit demonstrations;
- signed prototype sessions when an explicit demo deployment profile is valid;
- server-only MailerSend and LINE adapters; and
- read/review UI, charts, alerts, and research-rule explanations.

There is no FastAPI service, PostgreSQL database, durable audit store, server-side session store, MQTT integration, or PLC integration in PR 1.

## Deployment profiles and trust boundary

`BIODRY_DEPLOYMENT_PROFILE` is server-only:

| Profile       | Intended use                                                    | Authentication                                                                                      | Provider tests                                            |
| ------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `local-demo`  | Local development with simulated data                           | Source-defined usernames; local convenience password; strong configured session secret required     | Optional only when `NOTIFICATION_TEST_ENABLED=true`       |
| `public-demo` | Public isolated presentation with simulated, non-sensitive data | Source-defined usernames plus a strong deployment-provided password; strong session secret required | Always disabled                                           |
| `production`  | Future real deployment                                          | Prototype authentication disabled until approved identity/backend auth exists                       | Always disabled in the current frontend-only architecture |

Production defaults to `production` when no profile is provided. Invalid or incomplete settings fail closed. The former fallback session secret is rejected.

## Notification-test boundary

The notification-test route is a local integration aid, not a production alert pipeline. It:

- is unavailable in `public-demo` and `production`;
- requires an authenticated Professor or Researcher in `local-demo`;
- requires an explicit same-origin JSON request;
- accepts only the channel, never a recipient or provider secret;
- limits body size and applies a best-effort process-local rate limit;
- records request, acceptance, failure, and rate-limit audit events to the temporary server log sink; and
- uses fixed server environment recipients.

Process-local throttling and console audit events are not durable or globally consistent on serverless infrastructure. Distributed throttling, revocable sessions, durable auditing, transactional outbox delivery, and backend authorization remain required before real users or data are connected.

## Research and operational safety

The quadratic peak function is a trend-review heuristic. Criterion T is a separate proposed temperature-only calculation. Neither evaluates Drying Rate (D) or Air Utilization (E), and neither authorizes stopping aeration.

The future workflow must keep these events separate:

1. a sensor observation;
2. an advisory trend or criterion result;
3. a human acknowledgement;
4. research validation;
5. professor certification or rejection;
6. any physical action performed outside this Phase 1 application.

No automatic blower control is planned for the current phase.
