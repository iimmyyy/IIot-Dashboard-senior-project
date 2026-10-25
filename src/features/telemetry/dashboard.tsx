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
  Info,
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
import { defaultRule, evaluateCriterionT } from "@/features/rules/criterion";
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
import { TrendPanel } from "@/components/charts/trend-panel";
import { AlertCard } from "@/features/alerts/alert-card";

export function Dashboard() {
  const {
    currentExperiment: experiment,
    now,
    frame,
    status,
    stale,
    mode,
    alerts,
    latest,
    experiments,
    refresh,
    connection,
  } = useMonitor();
  const end = now ? Math.floor(now / 60000) * 60000 : 0;
  const history = useHistory(experiment?.id, end - 3 * 86400000, end);
  const frames = history.isError ? [] : (history.data ?? []);
  const average = averageTemperature(frame, now ?? 0);
  const activeAlerts =
    alerts.data?.filter(
      (a) => !a.resolved_at && a.experiment_id === experiment?.id,
    ) ?? [];
  const primaryAlert =
    activeAlerts.find((a) => !a.acknowledged_at) ?? activeAlerts[0];
  const healthy = status === "Monitoring Active";
  const rule = evaluateCriterionT(
    frames,
    experiment?.start_date ?? "",
    now ?? 0,
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR LAB, AT A GLANCE"
        title="Overview"
        description="A clear view of your chamber. Confidence in your next step."
      >
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
            <span className="overline">CURRENT EXPERIMENT</span>
            <h2>
              {experiment?.name ??
                (experiments.isPending
                  ? "Loading current experiment…"
                  : "No current experiment")}
            </h2>
            <span className="experiment-id">
              {experiment?.id ?? "Waiting for experiment details"}
              <span>·</span>Single chamber study
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
      <div className="section-heading">
        <h2>
          Live Temperature{" "}
          <Help text="Temperatures in degrees Celsius at three heights in one chamber. All available sensors at each height are averaged only when their readings are valid and recent." />
        </h2>
        <span>
          {mode === "demo"
            ? "Simulated readings"
            : connection === "connected"
              ? "System Connected"
              : "Connection Interrupted"}
          <span className={cn("dot", healthy ? "good-dot" : "warning-dot")} />
        </span>
      </div>
      <div className="temperature-grid">
        {positions.map((p) => {
          const value = zoneValue(frame, p, now ?? 0);
          const condition = zoneCondition(frame, p, now ?? 0);
          const sensorTimes =
            frame?.readings
              .filter((reading) => reading.position === p)
              .map((reading) =>
                Date.parse(reading.timestamp ?? frame.timestamp),
              ) ?? [];
          const measuredAt = sensorTimes.length
            ? new Date(Math.min(...sensorTimes)).toISOString()
            : undefined;
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
              <div className="temp-timestamp">
                {measuredAt && now
                  ? `Measured ${age(measuredAt, now)}`
                  : "Waiting for Sensor Data"}
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
        <span>Top, Middle, and Bottom are zones in one connected chamber.</span>
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
        <Details title="Research Criteria & Supporting Calculations">
          <div className="rule-heading">
            <h3>Temperature Criterion T</h3>
            <Badge>
              {rule.state === "unavailable"
                ? "Awaiting Method Confirmation"
                : rule.state.replaceAll("_", " ")}
            </Badge>
          </div>
          <p>{rule.explanation}</p>
          <div className="supporting-values">
            <div>
              <span>Core temperature average</span>
              <strong>{defaultRule.windowDays} days</strong>
            </div>
            <div>
              <span>Required drop from reference peak</span>
              <strong>At least {defaultRule.dropC} °C</strong>
            </div>
            <div>
              <span>Bottom temperature trend limit</span>
              <strong>≤ {defaultRule.maxBottomSlopeCPerDay} °C/day</strong>
            </div>
          </div>
          <p>
            <strong>Additional measurements required.</strong> Drying Rate (D)
            and Air Utilization (E) cannot be evaluated using temperature
            sensors alone. The research stopping rule requires T, D, and E for
            two consecutive days, beginning on day 7. The responsible researcher
            makes operational decisions.
          </p>
          <p>
            Core sensor mapping, the relevant reference peak, sampling
            requirements, and the calculation method must be approved before
            enabling this configurable research rule.
          </p>
        </Details>
      </div>
      <div className="monitoring-note">
        <Info size={15} />
        <span>
          A little context: this workspace monitors your experiment and supports
          review. Blower operation remains with the laboratory team.
        </span>
      </div>
    </>
  );
}
