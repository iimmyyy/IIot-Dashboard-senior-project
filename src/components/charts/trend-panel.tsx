"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import Link from "next/link";
import { useHistory, useMonitor } from "@/hooks/use-monitor";
import { positions, type Position } from "@/types";
import { positionLabels, bangkokInput, dateTime } from "@/lib/utils";
import { sensorStats } from "@/features/telemetry/calculations";
import { telemetryCsv } from "@/features/telemetry/export";
import { Button } from "@/components/ui/button";
import { Details, EmptyState, Help } from "@/components/ui/shared";
const Chart = dynamic(() => import("./temperature-chart"), {
  ssr: false,
  loading: () => (
    <div className="chart-loading">Loading temperature chart…</div>
  ),
});
const ranges = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

export function TrendPanel({
  full = false,
  initialId = "",
}: {
  full?: boolean;
  initialId?: string;
}) {
  const { currentExperiment, experiments, now, mode } = useMonitor();
  const [range, setRange] = useState(24);
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ start: number; end: number } | null>(
    null,
  );
  const [customError, setCustomError] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [visible, setVisible] = useState<Position[]>([...positions]);
  const id =
    selected ||
    (full ? initialId : "") ||
    currentExperiment?.id ||
    (full ? experiments.data?.[0]?.id : undefined);
  const experiment = experiments.data?.find((e) => e.id === id);
  const end = experiment?.end_date
    ? Date.parse(experiment.end_date)
    : now
      ? Math.floor(now / 60000) * 60000
      : 0;
  const queryEnd = custom && applied ? applied.end : end;
  const queryStart = custom && applied ? applied.start : end - range * 3600000;
  const history = useHistory(id, queryStart, queryEnd);
  const frames = history.data ?? [];
  const exportCsv = () => {
    const csv = telemetryCsv(frames, mode);
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${mode}-${id}-temperatures.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportMessage(
      "CSV download started. The file includes UTC and Bangkok timestamps.",
    );
  };
  return (
    <section className={`card trend-card ${full ? "full-trends" : ""}`}>
      <div className="card-heading">
        <div>
          <h2>
            Temperature Trends{" "}
            <Help text="Actual recorded temperatures at each height in one chamber. Missing data stays visible as gaps. Drag the lower chart handles to zoom." />
          </h2>
          <p>
            {custom && applied
              ? `${dateTime(applied.start)} – ${dateTime(applied.end)} ICT`
              : `Across the chamber · ${range === 168 ? "last 7 days" : `last ${range} hours`}`}{" "}
            {mode === "demo" && "· simulated"}
          </p>
        </div>
        {full ? (
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!frames.length || history.isError}
          >
            <Download size={15} />
            Export CSV
          </Button>
        ) : (
          <Link className="text-link" href="/trends">
            Explore Trends <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      <div className="chart-toolbar">
        {full && (
          <label className="experiment-select">
            Experiment
            <select
              value={id ?? ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {experiments.data?.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.id} ·{" "}
                  {exp.status === "running" ? "Current Run" : "Completed"}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="range-group" aria-label="Chart time range">
          {ranges.map((r) => (
            <button
              key={r.hours}
              className={!custom && range === r.hours ? "selected" : ""}
              aria-pressed={!custom && range === r.hours}
              onClick={() => {
                setRange(r.hours);
                setCustom(false);
              }}
            >
              {r.label}
            </button>
          ))}
          <button
            className={custom ? "selected" : ""}
            aria-pressed={custom}
            onClick={() => setCustom(true)}
          >
            Custom
          </button>
        </div>
        <span className="chart-timezone">Bangkok time (ICT)</span>
      </div>
      {custom && (
        <form
          className="custom-range"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const start = Date.parse(bangkokInput(from));
              const end = Date.parse(bangkokInput(to));
              if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                start >= end ||
                end - start > 31 * 86400000 ||
                end > Date.now() + 60000
              ) {
                setCustomError(
                  "Choose a past period of up to 31 days, with the end after the start.",
                );
                return;
              }
              setApplied({ start, end });
              setCustomError("");
            } catch {
              setCustomError(
                "Enter a valid start and end date in Bangkok time.",
              );
            }
          }}
        >
          <label>
            From (Bangkok)
            <input
              type="datetime-local"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To (Bangkok)
            <input
              type="datetime-local"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <Button size="sm" type="submit">
            Apply Range
          </Button>
          {customError && (
            <p role="alert" className="error-text">
              {customError}
            </p>
          )}
        </form>
      )}
      {history.isError ? (
        <EmptyState
          title="Temperature history unavailable"
          message="We could not retrieve the measurements. Check the connection and try again."
          retry={() => {
            void history.refetch();
          }}
        />
      ) : history.isPending ? (
        <div className="chart-loading">
          {id ? "Loading temperature history…" : "Waiting for an experiment…"}
        </div>
      ) : !frames.length ? (
        <EmptyState
          title="No measurements in this period"
          message="Choose a different time range or experiment to view recorded temperatures."
        />
      ) : (
        <>
          {visible.length ? (
            <Chart history={frames} large={full} visible={visible} />
          ) : (
            <div className="chart-loading">
              Select a measurement zone below to view its history.
            </div>
          )}
          <div
            className="chart-legend"
            role="group"
            aria-label="Visible temperature zones"
          >
            {positions.map((p) => (
              <button
                key={p}
                aria-pressed={visible.includes(p)}
                className={visible.includes(p) ? "" : "zone-hidden"}
                onClick={() =>
                  setVisible((current) =>
                    current.includes(p)
                      ? current.filter((v) => v !== p)
                      : [...current, p],
                  )
                }
              >
                <span className={`sensor-dot ${p}`} />
                {positionLabels[p]}
                <span className="sr-only"> Temperature</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="chart-footnote">
        <span className="dot muted-dot" />
        Gaps indicate missing measurements.
        <span>Drag to zoom · select a legend to hide a zone</span>
      </div>
      {exportMessage && (
        <p className="inline-feedback" role="status">
          {exportMessage}
        </p>
      )}
      {full && frames.length > 0 && !history.isError && (
        <>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Temperature summary for the selected period
              </caption>
              <thead>
                <tr>
                  <th>Measurement Zone</th>
                  <th>Latest in Period</th>
                  <th>Lowest</th>
                  <th>Highest</th>
                  <th>Average</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const stats = sensorStats(frames, p);
                  const format = (n: number | null | undefined) =>
                    n == null ? "—" : `${n.toFixed(1)} °C`;
                  return (
                    <tr key={p}>
                      <td>
                        <span className={`sensor-dot ${p}`} />
                        {positionLabels[p]}
                      </td>
                      <td>{format(stats?.current)}</td>
                      <td>{format(stats?.min)}</td>
                      <td>{format(stats?.max)}</td>
                      <td>{format(stats?.average)}</td>
                      <td>
                        {stats?.change != null && stats.change > 0 ? "+" : ""}
                        {format(stats?.change)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Details title="Advanced Analysis">
            <p>
              The summary uses available valid measurements. Averages are sample
              means; values are not interpolated across missing data. Change
              compares the first and last measurements in the selected period
              and is unavailable if either is missing.
            </p>
            <p>
              Criterion T requires a validated method and complete three-day
              data. A temperature index is unavailable until its calculation is
              defined by the research team.
            </p>
            <Details title="Accessible measurement table">
              <div className="table-scroll accessible-data">
                <table>
                  <caption>Recorded temperature frames · Bangkok time</caption>
                  <thead>
                    <tr>
                      <th>Time (ICT)</th>
                      {positions.map((p) => (
                        <th key={p}>{positionLabels[p]} (°C)</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {frames.map((f) => (
                      <tr key={f.timestamp}>
                        <td>{dateTime(f.timestamp)}</td>
                        {positions.map((p) => (
                          <td key={p}>
                            {f.readings
                              .filter((r) => r.position === p)
                              .map((r) =>
                                r.quality === "good"
                                  ? r.temperature_c?.toFixed(1)
                                  : "Unavailable",
                              )
                              .join(" / ") || "Unavailable"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Details>
          </Details>
        </>
      )}
    </section>
  );
}
