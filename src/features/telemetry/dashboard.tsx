"use client";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Circle,
  Clock3,
  FlaskConical,
  Minus,
  Radio,
  RefreshCw,
  Thermometer,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { useHistory, useMonitor } from "@/hooks/use-monitor";
import { age, dateTime, duration, positionLabels, cn } from "@/lib/utils";
import {
  averageTemperature,
  trend,
  zoneValue,
  zoneCondition,
} from "@/features/telemetry/calculations";
import { positions } from "@/types";
import {
  Badge,
  Details,
  EmptyState,
  Help,
  PageHeading,
} from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Chamber } from "@/components/chamber/chamber";
import { ChamberSelector } from "@/components/chamber/chamber-selector";
import { TrendPanel } from "@/components/charts/trend-panel";
import { AlertCard } from "@/features/alerts/alert-card";
import { BatchStatusCard } from "@/features/experiments/batch-status";
import { alertBelongsToBatch } from "@/features/experiments/batch-lifecycle";
import { useCurrentBatchRun } from "@/features/experiments/use-current-batch-run";

export function Dashboard() {
  const {
    currentExperiment: experiment,
    now,
    frame,
    status,
    stale,
    alerts,
    selectedChamber,
    latest,
    experiments,
    refresh,
  } = useMonitor();
  const currentBatchRun = useCurrentBatchRun();
  const end = now ? Math.floor(now / 60000) * 60000 : 0;
  const history = useHistory(
    experiment?.id,
    Math.max(end - 3 * 86400000, Date.parse(currentBatchRun.started_at)),
    end,
  );
  const frames = history.isError ? [] : (history.data ?? []);
  const average = averageTemperature(frame, now ?? 0);
  const activeAlerts =
    alerts.data?.filter(
      (a) => !a.resolved_at && a.experiment_id === experiment?.id,
    ).filter(
      (alert) => !alert.chamber_id || alert.chamber_id === selectedChamber,
    ) ?? [];
  const primaryAlert =
    activeAlerts.find((a) => !a.acknowledged_at) ?? activeAlerts[0];
  const healthy = status === "Monitoring Active";
  const peakAlert = alerts.data?.find(
    (alert) =>
      alert.kind === "temperature_peak" &&
      alert.experiment_id === experiment?.id &&
      alert.chamber_id === selectedChamber &&
      alertBelongsToBatch(alert.detected_at, currentBatchRun),
  );
  return (
    <>
      <PageHeading
        title="Overview"
      >
        <ChamberSelector />
        <Badge tone={healthy ? "good" : "warning"}>
          {healthy ? <Radio size={13} /> : <TriangleAlert size={13} />}
          {status}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          aria-label="Refresh monitoring data"
        >
          <RefreshCw size={15} />
          Refresh
        </Button>
      </PageHeading>
      {experiments.isError && (
        <EmptyState
          title="Experiment information unavailable"
          message="Check your connection, then try loading the current experiment again."
          retry={refresh}
        />
      )}
      {!healthy && !latest.isPending && (
        <div className="connection-warning" role="status">
          <WifiOff size={19} />
          <div>
            <strong>{status}</strong>
            <p>
              {stale
                ? "The latest readings are more than 90 seconds old. Current values are hidden until new measurements arrive."
                : "Check the sensor connection and the System Status page. Current measurements may be unavailable."}
            </p>
          </div>
          <Link href="/system">
            Check Connection <ArrowRight size={15} />
          </Link>
        </div>
      )}
      <section className="experiment-strip">
        <div className="experiment-strip-main">
          <span className="experiment-icon">
            <FlaskConical size={22} />
          </span>
          <div>
            <h2>
              {experiment?.name ??
                (experiments.isPending
                  ? "Loading current experiment…"
                  : "No current experiment")}
            </h2>
            <span className="experiment-id">
              {experiment?.id ?? "Waiting for experiment details"}
            </span>
          </div>
        </div>
        <div className="run-details">
          <div>
            <span>
              <Clock3 size={13} />
              Duration
            </span>
            <strong>
              {experiment && now ? duration(experiment.start_date, now) : "—"}
            </strong>
          </div>
          <div>
            <span>
              <Activity size={13} />
              Last Updated
            </span>
            <strong>
              {frame && now ? age(frame.timestamp, now) : "No data yet"}
            </strong>
            <small>
              {frame
                ? `${dateTime(frame.timestamp)} ICT`
                : "Waiting for Sensor Data"}
            </small>
          </div>
          <Link
            href="/experiments"
            className="strip-link"
            aria-label="View experiment history"
          >
            <ArrowUpRight size={19} />
          </Link>
        </div>
      </section>
      <BatchStatusCard />
      <div className="section-heading">
        <h2>
          Live Temperature{" "}
          <Help text="Temperatures in degrees Celsius at three heights in the selected prototype dataset. L1/L2/L3 are not an approved hardware mapping. All available sensors at each height are averaged only when their readings are valid and recent." />
        </h2>
      </div>
      <div className="temperature-grid">
        {positions.map((p) => {
          const value = zoneValue(frame, p, now ?? 0);
          const condition = zoneCondition(frame, p, now ?? 0);
          const direction = value === null ? "Unavailable" : trend(frames, p);
          const TrendIcon =
            direction === "Falling"
              ? ArrowDownRight
              : direction === "Rising"
                ? ArrowUpRight
                : Minus;
          return (
            <section
              className={`card temperature-card temperature-${p}`}
              key={p}
            >
              <div className="temp-card-top">
                <span>
                  <span className={`sensor-dot ${p}`} />
                  {positionLabels[p]} Temperature
                </span>
                <Thermometer size={19} />
              </div>
              <div className="temperature-number">
                {value === null ? "—" : value.toFixed(1)}
                <span>°C</span>
              </div>
              <div className="temp-card-bottom">
                <span className="trend-label">
                  <TrendIcon size={15} />
                  {direction}
                </span>
                <span
                  className={cn(
                    "sensor-health",
                    value === null && "sensor-unavailable",
                  )}
                >
                  {value === null ? (
                    <TriangleAlert size={12} />
                  ) : (
                    <Check size={12} />
                  )}
                  {value === null
                    ? condition === "error"
                      ? "Sensor error"
                      : condition === "outdated"
                        ? "Data outdated"
                        : "Reading unavailable"
                    : "Sensor healthy"}
                </span>
              </div>
            </section>
          );
        })}
      </div>
      <div className="temperature-summary">
        <span>
          <Circle size={13} />
          <strong>Average Temperature</strong>
          <Help text="Equal average of the three zone temperatures. Each zone is averaged from its valid sensors. Unavailable when any required zone has missing, invalid, or outdated measurements." />
          <b>{average === null ? "—" : `${average.toFixed(1)} °C`}</b>
        </span>
      </div>
      <div className="dashboard-visual-grid">
        <TrendPanel />
        <Chamber />
      </div>
      <div className="section-heading alert-section-heading">
        <h2>
          Attention & Insights{" "}
          {activeAlerts.filter((a) => !a.acknowledged_at).length > 0 && (
            <span className="count-label">
              {activeAlerts.filter((a) => !a.acknowledged_at).length} to review
            </span>
          )}
        </h2>
        <Link href="/alerts" className="text-link">
          View All Alerts <ArrowRight size={14} />
        </Link>
      </div>
      {alerts.isError ? (
        <EmptyState
          title="Alert status unavailable"
          message="Alerts could not be retrieved. Check the connection before assuming there are no active alerts."
          retry={() => {
            void alerts.refetch();
          }}
        />
      ) : alerts.isPending ? (
        <div className="card loading-state">Loading alerts…</div>
      ) : primaryAlert ? (
        <AlertCard alert={primaryAlert} compact />
      ) : (
        <div className="card no-alerts">
          <Check size={19} />
          <div>
            <h3>No Active Alerts</h3>
            <p>
              No issues have been reported. Continue monitoring the experiment.
            </p>
          </div>
        </div>
      )}
      <div className="research-details">
        <Details title="Batch Completion Criterion">
          <div className="rule-heading">
            <h3>Polynomial Temperature Peak · {selectedChamber}</h3>
            <Badge tone={peakAlert ? "warning" : "neutral"}>
              {peakAlert ? "Peak Passed" : "Monitoring"}
            </Badge>
          </div>
          <p>
            The prototype selection becomes ready for review when its quadratic
            temperature fit has R² above 0.70, downward curvature, a passed fitted
            peak, a negative latest slope, and the configured post-peak confirmation.
          </p>
          <div className="supporting-values">
            {peakAlert?.supporting_values.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            )) ?? (
              <div>
                <span>Fit quality threshold</span>
                <strong>R² &gt; 0.70</strong>
              </div>
            )}
          </div>
          <p>
            T, D and E are not part of the current prototype completion rule.
            A Researcher or Professor must confirm completion manually.
          </p>
        </Details>
      </div>
    </>
  );
}
