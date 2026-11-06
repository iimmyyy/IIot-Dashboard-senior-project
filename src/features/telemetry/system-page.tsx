"use client";
import {
  Check,
  CircleHelp,
  FlaskConical,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Thermometer,
  TriangleAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useMonitor } from "@/hooks/use-monitor";
import { Badge, Details, PageHeading } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { dateTime, positionLabels } from "@/lib/utils";
import { positions, type Scenario } from "@/types";
import { zoneCondition, zoneValue } from "@/features/telemetry/calculations";
import { NotificationTestPanel } from "@/features/notifications/notification-test-panel";
const scenarios: { value: Scenario; label: string; description: string }[] = [
  {
    value: "normal",
    label: "Normal Monitoring",
    description: "All zones reporting.",
  },
  {
    value: "stale",
    label: "Outdated Readings",
    description: "Latest readings are eight minutes old.",
  },
  {
    value: "missing",
    label: "Missing Middle Sensor",
    description: "Middle zone unavailable.",
  },
  {
    value: "disconnected",
    label: "Connection Lost",
    description: "Data stream disconnected.",
  },
  {
    value: "waiting",
    label: "Waiting for Sensor Data",
    description: "Connected; no readings yet.",
  },
];
export function SystemPage({
  notificationTestsEnabled = false,
}: {
  notificationTestsEnabled?: boolean;
}) {
  const {
    mode,
    scenario,
    setScenario,
    status,
    connection,
    frame,
    now,
    system,
    latest,
    refresh,
    invalidFrames,
    stale,
  } = useMonitor();
  const healthy = status === "Monitoring Active";
  return (
    <>
      <PageHeading
        title="System Status"
      >
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw size={15} />
          Check Again
        </Button>
      </PageHeading>
      <section
        className={`card system-overview ${healthy ? "system-healthy" : "system-attention"}`}
      >
        <span className="system-status-icon">
          {healthy ? <ShieldCheck size={30} /> : <TriangleAlert size={30} />}
        </span>
        <div>
          <h2>{healthy ? "System Connected" : status}</h2>
        </div>
        <Badge tone={healthy ? "good" : "warning"}>
          {healthy ? <Check size={13} /> : <TriangleAlert size={13} />}
          {healthy ? "Monitoring Active" : "Attention Required"}
        </Badge>
      </section>
      <div className="system-grid">
        <section className="card">
          <div className="card-heading">
            <h2>
              <Server size={18} />
              Data Connections
            </h2>
          </div>
          <div className="status-row">
            <span>
              <Server size={16} />
              Data Service
            </span>
            <Badge
              tone={
                system.isError || !system.data?.api_connected
                  ? "warning"
                  : "good"
              }
            >
              {system.isPending
                ? "Checking…"
                : system.isError || !system.data?.api_connected
                  ? "Connection Interrupted"
                  : mode === "demo"
                    ? "Simulated"
                    : "Connected"}
            </Badge>
          </div>
          <div className="status-row">
            <span>
              <Wifi size={16} />
              Live Updates
            </span>
            <Badge tone={connection === "connected" ? "good" : "warning"}>
              {connection === "connected"
                ? mode === "demo"
                  ? "Simulated"
                  : "Connected"
                : connection === "reconnecting"
                  ? "Reconnecting"
                  : connection === "connecting"
                    ? "Connecting"
                    : "Connection Lost"}
            </Badge>
          </div>
          <div className="status-row">
            <span>
              <RefreshCw size={16} />
              Data Synchronization
            </span>
            <strong>
              {latest.isError || system.isError
                ? "Refresh needed"
                : latest.isFetching
                  ? "Updating…"
                  : stale
                    ? "Sensor Data Outdated"
                    : frame
                      ? "Up to date"
                      : "Waiting for data"}
            </strong>
          </div>
          <div className="status-row stacked">
            <span>Last Successful Refresh</span>
            <strong>
              {latest.dataUpdatedAt
                ? `${dateTime(latest.dataUpdatedAt)} ICT`
                : "No successful refresh yet"}
            </strong>
          </div>
          <div className="status-row stacked">
            <span>Last Sensor Measurement</span>
            <strong>
              {frame
                ? `${dateTime(frame.timestamp)} ICT`
                : "No measurements received"}
            </strong>
          </div>
        </section>
        <section className="card">
          <div className="card-heading">
            <h2>
              <Thermometer size={18} />
              Sensor Availability
            </h2>
          </div>
          {positions.map((p) => {
            const valid = zoneValue(frame, p, now ?? 0) !== null;
            const condition = zoneCondition(frame, p, now ?? 0);
            const sensors =
              frame?.readings.filter((r) => r.position === p) ?? [];
            return (
              <div className="status-row sensor-status-row" key={p}>
                <span>
                  <span className={`sensor-dot ${p}`} />
                  <span>
                    {positionLabels[p]} Temperature
                    <small>
                      {sensors.length
                        ? `${sensors.length} sensor${sensors.length === 1 ? "" : "s"} at this height`
                        : "No readings received"}
                    </small>
                  </span>
                </span>
                <Badge tone={valid ? "good" : "warning"}>
                  {valid ? <Check size={12} /> : <TriangleAlert size={12} />}
                  {valid
                    ? "Available"
                    : condition === "error"
                      ? "Sensor Error"
                      : condition === "outdated"
                        ? "Outdated"
                        : "Unavailable"}
                </Badge>
              </div>
            );
          })}
          <div className="sensor-status-note">
            <CircleHelp size={16} />
            <p>
              A zone temperature is shown only when every reported sensor at
              that height has a valid, recent reading.
            </p>
          </div>
        </section>
      </div>
      {mode === "demo" && (
        <section className="card demo-scenarios">
          <div className="card-heading">
            <div>
              <h2>
                <FlaskConical size={19} />
                Demo Scenarios
              </h2>
            </div>
            <Badge tone="teal">Simulated Only</Badge>
          </div>
          <div className="scenario-grid">
            {scenarios.map((s) => (
              <button
                key={s.value}
                className={`scenario-button ${scenario === s.value ? "chosen" : ""}`}
                aria-pressed={scenario === s.value}
                onClick={() => setScenario(s.value)}
              >
                {s.value === "normal" ? (
                  <Radio size={20} />
                ) : s.value === "disconnected" ? (
                  <WifiOff size={20} />
                ) : (
                  <Thermometer size={20} />
                )}
                <strong>{s.label}</strong>
                <span>{s.description}</span>
                {scenario === s.value && (
                  <Check size={16} className="scenario-check" />
                )}
              </button>
            ))}
          </div>
        </section>
      )}
      <NotificationTestPanel enabled={notificationTestsEnabled} />
      <div className="card diagnostics">
        <Details title="Advanced Connection Details">
          <dl className="diagnostic-list">
            <dt>Data source</dt>
            <dd>
              {mode === "demo"
                ? "Demo Mode — Simulated Data"
                : "Live FastAPI service"}
            </dd>
            <dt>API connection</dt>
            <dd>
              {mode === "demo"
                ? "Mock REST adapter"
                : process.env.NEXT_PUBLIC_API_URL
                  ? "Configured"
                  : "Not configured"}
            </dd>
            <dt>WebSocket connection</dt>
            <dd>
              {mode === "demo"
                ? "Simulated stream"
                : process.env.NEXT_PUBLIC_WS_URL
                  ? connection
                  : "Not configured"}
            </dd>
            <dt>Ignored invalid messages</dt>
            <dd>{invalidFrames}</dd>
            <dt>Outdated reading threshold</dt>
            <dd>90 seconds</dd>
            <dt>Time display</dt>
            <dd>Asia/Bangkok (UTC+7), English</dd>
            <dt>Blower status</dt>
            <dd>
              {system.data?.blower_status === "unknown" || !system.data
                ? "Unavailable"
                : system.data.blower_status}
            </dd>
          </dl>
          <p>
            Live updates reconnect automatically with increasing delays of up to
            30 seconds. Measurements with invalid formats or timestamps are
            rejected. Older messages cannot replace newer measurements.
          </p>
          <p>
            No browser connection is made to laboratory equipment or the
            historical database. All live data comes through the research
            backend.
          </p>
          {latest.isError && (
            <p className="error-text">{latest.error.message}</p>
          )}
          {system.isError && (
            <p className="error-text">{system.error.message}</p>
          )}
        </Details>
      </div>
    </>
  );
}
