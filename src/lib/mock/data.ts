import {
  chambers,
  type Chamber,
  type Experiment,
  type ResearchAlert,
  type Scenario,
  type Telemetry,
} from "@/types";
import {
  defaultPolynomialPeakConfig,
  evaluatePolynomialPeak,
} from "@/features/rules/polynomial-peak";

export const DEMO_ANCHOR = Math.floor(Date.now() / 60000) * 60000;
const day = 86400000;
const iso = (n: number) => new Date(n).toISOString();
export const demoExperiments: Experiment[] = [
  {
    id: "BD-2026-008",
    name: "Mixed organic waste · Batch 08",
    start_date: iso(DEMO_ANCHOR - 9 * day - 6 * 3600000),
    end_date: null,
    status: "running",
    sensor_positions: ["top", "middle", "bottom"],
    conditions: "Single chamber · fixed aeration study",
  },
  {
    id: "BD-2026-007",
    name: "Mixed organic waste · Batch 07",
    start_date: iso(DEMO_ANCHOR - 28 * day),
    end_date: iso(DEMO_ANCHOR - 14 * day),
    status: "completed",
    sensor_positions: ["top", "middle", "bottom"],
    conditions: "Single chamber · fixed aeration study",
  },
  {
    id: "BD-2026-006",
    name: "Food & garden waste · Batch 06",
    start_date: iso(DEMO_ANCHOR - 48 * day),
    end_date: iso(DEMO_ANCHOR - 34 * day),
    status: "completed",
    sensor_positions: ["top", "middle", "bottom"],
    conditions: "Single chamber · mixed feedstock study",
  },
  {
    id: "BD-2026-005",
    name: "Organic feedstock · Batch 05",
    start_date: iso(DEMO_ANCHOR - 68 * day),
    end_date: iso(DEMO_ANCHOR - 55 * day),
    status: "completed",
    sensor_positions: ["top", "middle", "bottom"],
    conditions: "Single chamber · baseline study",
  },
];
export function demoFrame(
  timestamp: number,
  experimentId = demoExperiments[0].id,
  chamberId: Chamber = "L1",
): Telemetry {
  const exp =
    demoExperiments.find((e) => e.id === experimentId) ?? demoExperiments[0];
  const end = exp.end_date ? Date.parse(exp.end_date) : DEMO_ANCHOR;
  const daysBeforeEnd = (end - timestamp) / day;
  const drift =
    daysBeforeEnd < 5
      ? daysBeforeEnd * 2.05
      : Math.max(-16, 10.25 - (daysBeforeEnd - 5) * 6.1);
  const chamberIndex = chambers.indexOf(chamberId);
  const chamberOffset = [0, 1.3, -1.1][chamberIndex];
  const wiggle =
    Math.sin(
      ((timestamp - DEMO_ANCHOR) / 3600000) * 0.65 + chamberIndex * 0.7,
    ) * 0.32;
  return {
    experiment_id: experimentId,
    chamber_id: chamberId,
    timestamp: iso(timestamp),
    readings: (["top", "middle", "bottom"] as const).map((position, i) => ({
      sensor_id: `TEMP-${chamberId}-${position.toUpperCase()}-01`,
      position,
      temperature_c:
        Math.round(
          ([48.6, 52.3, 45.8][i] + chamberOffset + drift + wiggle * [1, 0.7, 0.8][i]) * 10,
        ) / 10,
      quality: "good",
    })),
  };
}
export function demoHistory(
  id: string,
  start: number,
  end: number,
  chamberId: Chamber = "L1",
) {
  const exp = demoExperiments.find((e) => e.id === id);
  if (!exp) return [];
  const low = Math.max(start, Date.parse(exp.start_date));
  const high = Math.min(
    end,
    exp.end_date ? Date.parse(exp.end_date) : Date.now(),
  );
  const step =
    high - low <= 6 * 3600000
      ? 5 * 60000
      : high - low <= 86400000
        ? 15 * 60000
        : 3600000;
  const frames: Telemetry[] = [];
  for (let time = low; time <= high; time += step)
    frames.push(demoFrame(time, id, chamberId));
  if (!frames.length || Date.parse(frames.at(-1)!.timestamp) < high)
    frames.push(demoFrame(high, id, chamberId));
  // An explicit short measurement gap demonstrates honest chart rendering.
  return frames.map((f, i) =>
    frames.length > 40 && i === Math.floor(frames.length * 0.35)
      ? {
          ...f,
          readings: f.readings.map((r) =>
            r.position === "bottom"
              ? { ...r, temperature_c: null, quality: "missing" as const }
              : r,
          ),
        }
      : f,
  );
}
export function demoLatest(
  scenario: Scenario,
  chamberId: Chamber = "L1",
): Telemetry | null {
  if (scenario === "waiting") return null;
  const frame = demoFrame(
    Date.now() -
      (scenario === "stale" || scenario === "disconnected" ? 8 * 60000 : 0),
    demoExperiments[0].id,
    chamberId,
  );
  if (scenario === "missing")
    frame.readings = frame.readings.filter((r) => r.position !== "middle");
  return frame;
}
export function demoAlerts(): ResearchAlert[] {
  const experiment = demoExperiments[0];
  const peakAlert: ResearchAlert[] = chambers.flatMap((chamberId, index) => {
    const peak = evaluatePolynomialPeak(
      demoHistory(
        experiment.id,
        DEMO_ANCHOR - defaultPolynomialPeakConfig.windowHours * 3_600_000,
        DEMO_ANCHOR,
        chamberId,
      ),
    );
    return peak.state === "alert"
      ? [
          {
            id: index === 0 ? "ALT-POLY-0082" : `ALT-POLY-0082-${chamberId}`,
            experiment_id: experiment.id,
            chamber_id: chamberId,
            kind: "temperature_peak" as const,
            title: "Temperature peak passed",
            description:
              "A quadratic fit of the chamber average indicates that the temperature has passed its peak and is falling.",
            action:
              "Review the temperature trend with the experiment measurements.",
            severity: "warning" as const,
            detected_at: peak.peakAt!,
            supporting_values: [
              {
                label: "Fit quality",
                value: `R² ${peak.rSquared!.toFixed(2)}`,
              },
              {
                label: "Peak detected",
                value: `${((DEMO_ANCHOR - Date.parse(peak.peakAt!)) / day).toFixed(1)} days ago`,
              },
              {
                label: "Latest fitted slope",
                value: `${peak.latestSlopeCPerHour!.toFixed(2)} °C/hour`,
              },
              {
                label: "Drop from fitted peak",
                value: `${peak.dropFromPeakC!.toFixed(1)} °C`,
              },
            ],
            acknowledged_at: null,
            acknowledged_by: null,
            resolved_at: null,
          },
        ]
      : [];
  });
  return [
    ...peakAlert,
    {
      id: "ALT-0081",
      experiment_id: demoExperiments[0].id,
      chamber_id: "L1",
      kind: "connection",
      title: "Monitoring resumed",
      description:
        "Simulated measurements are being received again after a brief interruption.",
      action: "Check that all three sensor zones have recent readings.",
      severity: "info",
      detected_at: iso(DEMO_ANCHOR - 2 * 3600000),
      supporting_values: [
        { label: "Available zones", value: "Top, Middle, Bottom" },
      ],
      acknowledged_at: iso(DEMO_ANCHOR - 110 * 60000),
      acknowledged_by: "Demo researcher",
      resolved_at: iso(DEMO_ANCHOR - 2 * 3600000),
    },
  ];
}
