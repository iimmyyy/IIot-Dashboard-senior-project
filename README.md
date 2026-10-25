# BioDry · Research Monitor

A frontend MVP for a university biodrying laboratory: one vertical chamber, temperature sensors at Top, Middle, and Bottom, and one shared blower. All application text is English. Displayed times use **Asia/Bangkok (ICT, UTC+7)** and temperatures use **Celsius (°C)**. API timestamps remain ISO 8601 with a UTC offset.

**Monitoring and review only. There are no blower controls, automatic equipment actions, or ML predictions. Criterion T alone never establishes the full stopping criteria.**

## Run locally

Use Node.js 24 LTS and npm. From the repository root:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. The root redirects to `/dashboard`. No backend is needed in the default demo mode. Use `npm ci` for an installation matching the committed lockfile.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Run `npm start` after a production build, with the development server stopped. `npm run format` formats source and documentation.

## What is implemented

- **Overview**: current run, elapsed time, last measurement time, connection state, three temperature cards, valid chamber average, recent trends, a single-chamber schematic, alert review, and expandable research details.
- **Temperature Trends**: experiment selector, 1-hour/6-hour/24-hour/7-day/custom ranges, keyboard-accessible sensor visibility buttons, hover details, chart zoom/pan, summary statistics, accessible measurement table, and CSV export. Custom ranges use Bangkok time and cover up to 31 days. CSV exports all sensor measurements in the selected period, regardless of chart visibility.
- **Experiment History**: search, status filtering, run dates, duration, experimental conditions, sensor zones, and links to each run's results.
- **Alerts**: severity/status/Bangkok-date filters, supporting evidence, recommended human action, and confirmed acknowledgement with a name and timestamp. Acknowledgement and resolution are independent.
- **System Status**: data service, live stream, sensor availability, measurement freshness, refresh status, and expandable connection diagnostics.
- Responsive desktop navigation and mobile bottom navigation; an optional quick start guide is available through the book icon and desktop sidebar. Visible keyboard focus, text alongside status colors, explanatory tooltips, and reduced-motion support are included.

The stack is Next.js App Router, React, TypeScript, Tailwind CSS, a shadcn-style source-owned Button using Radix Slot/CVA, Lucide icons, modular Apache ECharts, TanStack Query, Zod, and Vitest. ECharts is loaded client-side directly rather than through a React wrapper. No external font service is required.

## Demo mode

```dotenv
NEXT_PUBLIC_DATA_MODE=demo
```

A persistent amber banner identifies **Demo Mode — Simulated Data**. Four fictional experiment records, simulated temperature history, a deliberate missing-measurement gap, and two demonstration alert fixtures are included. No spreadsheet or historical research files existed in the repository, so no research data was imported and no L1/L2/L3 mapping was assumed.

On **System Status**, select Normal Monitoring, Outdated Readings, Missing Middle Sensor, Connection Lost, or Waiting for Sensor Data. Return to Overview to see that condition. These scenarios affect current measurements only; history and alert demonstrations remain independent fixtures. The selected scenario lasts for the current session. Demo measurements refresh every 15 seconds. Demonstration records use relative dates when the app is loaded.

Demo acknowledgements are stored in this browser's `localStorage` under `biodry-ack-v1`. They survive reloads but are not shared across devices. Clearing that key resets demonstration acknowledgements. The name entered is a demonstration attribution, not an authenticated identity.

## Live mode and FastAPI integration

Copy `.env.example` to `.env.local`, then set:

```dotenv
NEXT_PUBLIC_DATA_MODE=live
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/telemetry
```

Restart development after changing variables. Production `NEXT_PUBLIC_` values are embedded at build time: configure them before building and redeploy when changing modes or URLs. Use HTTPS/WSS for deployed services. These variables are public addresses, never secrets.

Live mode shows a **Live Data** banner and never substitutes demo readings when the service fails. The proposed REST contracts live in `src/lib/api/client.ts`; runtime schemas and inferred TypeScript types live in `src/types/index.ts`. Adjust these adapters once the backend team agrees the contract.

### Proposed endpoints

| Method    | Path                                                      | Expected JSON                                                          |
| --------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| GET       | `/api/v1/system/status`                                   | System status object                                                   |
| GET       | `/api/v1/experiments`                                     | Experiment array                                                       |
| GET       | `/api/v1/experiments/{id}`                                | Experiment object or `null`                                            |
| GET       | `/api/v1/telemetry/latest`                                | Latest telemetry frame or `null`                                       |
| GET       | `/api/v1/telemetry/history?experiment_id=…&start=…&end=…` | Telemetry frame array; start/end are ISO UTC timestamps                |
| GET       | `/api/v1/alerts`                                          | Alert array                                                            |
| POST      | `/api/v1/alerts/{id}/acknowledge`                         | Updated alert; request body `{ "acknowledged_by": "Researcher name" }` |
| WebSocket | `/ws/telemetry`                                           | Individual telemetry frames, optionally `{ "type": "heartbeat" }`      |

Responses are direct arrays/objects, without an envelope. An empty array means a successful request with no records; failures should return an HTTP error. Alert titles, descriptions, recommended actions, and other display text supplied by the backend must be English. The backend owns persistent alerts, their resolution, and research rule evaluation. This frontend does not create live research alerts from incomplete measurements.

Telemetry example:

```json
{
  "experiment_id": "EXP-001",
  "chamber_id": "CHAMBER-01",
  "timestamp": "2026-10-23T08:00:00Z",
  "readings": [
    {
      "sensor_id": "TEMP-TOP-01",
      "position": "top",
      "temperature_c": 58.4,
      "quality": "good"
    },
    {
      "sensor_id": "TEMP-MID-01",
      "position": "middle",
      "temperature_c": 61.2,
      "quality": "good"
    },
    {
      "sensor_id": "TEMP-BOTTOM-01",
      "position": "bottom",
      "temperature_c": 55.8,
      "quality": "good"
    }
  ]
}
```

Each reading may also include its own ISO `timestamp`. Positions are `top`, `middle`, and `bottom`; multiple uniquely identified sensors per position are supported. Quality is `good`, `missing`, or `error`; missing temperatures should be `null`. The schema's −50 to 200 °C range is an input validation guard, **not a research or safety threshold**. Confirm the instrument range with the backend team.

An experiment contains `id`, `name`, `start_date`, nullable `end_date`, `status` (`running` or `completed`), `sensor_positions` (position array), and `conditions` (separate experimental condition text). The MVP assumes at most one running experiment in the workspace.

An alert contains `id`, `experiment_id`, `title`, `description`, `action`, `severity` (`info`, `warning`, or `critical`), `detected_at`, `supporting_values` (array of `{ label, value }` strings), nullable `acknowledged_at`, nullable `acknowledged_by`, and nullable `resolved_at`.

System status contains `api_connected` (boolean), nullable `last_sync`, and `blower_status` (`on`, `off`, or `unknown`, defaulting to `unknown`). Blower state is only displayed if reported; it is never inferred from temperatures or controlled by this app.

### Connection behavior

- REST requests time out after 15 seconds. Latest measurements are polled every 15 seconds; system and alerts every 30 seconds, and experiment metadata every 60 seconds.
- Live WebSocket data is validated before entering the query cache. Duplicate or older timestamps cannot replace newer frames. Frames more than 30 seconds in the future are rejected. Clock agreement with the backend is required.
- Disconnects retry at 1, 2, 4, 8, 16, then at most 30 seconds. An open stream with no valid data or heartbeat for 90 seconds is reconnected.
- Measurements older than 90 seconds are labeled outdated and withheld from current temperature cards. A sensor's individual timestamp is checked when supplied. Missing or invalid sensors are never replaced with invented values.
- Every reported sensor in a zone must be valid to show that zone's average. Every zone must be valid to show the equal-weight chamber average. Backend sensor inventory/expected sensor membership still needs agreement: a sensor silently omitted from a multi-sensor zone cannot be distinguished from a changed inventory without metadata.
- Chart gaps remain visible. No smoothing or interpolation changes raw data. Historical frames are sorted; live history and latest data never fall back to mocks.

The backend must allow the frontend origin through CORS and WebSocket origin checks. Authentication, authorization, and trusted acknowledgement attribution must be agreed and implemented before connecting a shared production service; the MVP has no login and currently sends the entered name. Never put access tokens into `NEXT_PUBLIC_` variables. The browser communicates only with FastAPI, never directly with PLC, MQTT, or InfluxDB.

## Research methodology requiring professor confirmation

`src/features/rules/criterion.ts` is a pure, configurable temperature-only evaluator. It returns `passed`, `not_passed`, `insufficient_data`, or `unavailable`. It checks recent coverage, duplicate frames, mixed experiments, missing values, and gaps before returning a numerical evaluation.

The proposed defaults are a 3-day core mean at least 5 °C below the relevant reference peak and a bottom temperature trend no greater than 0.5 °C/day, with evaluation beginning on experiment day 7. The implemented candidate method uses an equal average of configured core zones, a time-weighted trapezoidal mean, and least-squares bottom trend in °C/day. These are explicit **proposals requiring validation**, not universal limits.

By default, `methodologyValidated` is false, `corePositions` is empty, and `referencePeakC` is null. Consequently, the dashboard does not claim Criterion T has passed. The professor must confirm:

1. Which sensors or zones define the core, and whether equal zone weighting is appropriate.
2. The relevant reference peak, its time window, and its source.
3. Day boundaries in Bangkok time, sampling frequency, acceptable gaps, minimum coverage, and the exact averaging and trend methods.
4. How Criterion T persistence over two consecutive research days is assessed by the backend.
5. The required Drying Rate (D) and Air Utilization (E) measurements and the approved full stopping rule.

T alone never evaluates D/E or authorizes stopping aeration. The full research rule requires T, D, and E for two consecutive days beginning on day 7. Human researchers remain responsible for decisions and physical operation. Backend-driven rule results can be added through a typed adapter; no UI redesign is required.

## Validation and limitations

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` are the verification commands. Unit tests cover zone averages, missing/faulty/stale/future readings, trends, endpoint statistics, Criterion T outcomes and data sufficiency, stream validation/reconnection/cleanup, acknowledgement without resolution, API validation, live failures without mock fallback, and Bangkok date conversion.

Validation completed: lint, typecheck, production build, and **37 unit tests passed**. Both development and production servers started successfully; all five page routes plus the historical result link returned HTTP 200, with English document language and no Thai text in the HTML. No browser was available in the implementation session, so visual layout, keyboard interaction, chart interaction, downloads, and mobile/tablet behavior have not been verified in a real browser. No physical PLC, sensor, or FastAPI service was available for an end-to-end live integration test.

Before laboratory rollout, complete a browser check at desktop, tablet, and mobile widths; try every demo scenario; use chart range and visibility controls; open a completed run; export a CSV; acknowledge an alert and reload; test a backend disconnection and reconnection. Confirm expected sensor inventory and the research method with the team.

## Deploy to Vercel

Import this repository into Vercel and select the **Next.js** framework preset. Use the root directory, `npm run build`, and the default Next.js output. Set the three public environment variables for the intended mode before deployment. Demo mode needs no backend or secrets. For live mode, use a separately hosted FastAPI service with HTTPS/WSS and the approved frontend origin. Long-running WebSocket connections are made directly to that backend.

## Source organization

```text
src/app/                   App Router pages, application styles, error states
src/components/ui/         Shared source-owned UI primitives
src/components/layout/     Navigation, application shell, quick start guide
src/components/chamber/    One-chamber schematic
src/components/charts/     Client-side chart and historical exploration
src/features/telemetry/    Temperature calculations, overview, system status
src/features/experiments/  Experiment history
src/features/alerts/       Alert review and acknowledgement
src/features/rules/        Configurable, testable Criterion T calculation
src/hooks/                 Query provider and monitoring hooks
src/lib/api/               Central REST adapter and mode selection
src/lib/mock/              Explicitly simulated demonstration fixtures
src/lib/websocket/         Validated stream, ordering, backoff, watchdog
src/types/                 Shared Zod schemas and TypeScript contracts
```
