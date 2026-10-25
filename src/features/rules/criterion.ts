import { type Position, type Telemetry } from "@/types";
import { slope, STALE_MS, zoneValue } from "@/features/telemetry/calculations";

export interface RuleConfig {
  methodologyValidated: boolean;
  corePositions: Position[];
  referencePeakC: number | null;
  windowDays: number;
  dropC: number;
  maxBottomSlopeCPerDay: number;
  maxGapMinutes: number;
  earliestDay: number;
}
export const defaultRule: RuleConfig = {
  methodologyValidated: false,
  corePositions: [],
  referencePeakC: null,
  windowDays: 3,
  dropC: 5,
  maxBottomSlopeCPerDay: 0.5,
  maxGapMinutes: 90,
  earliestDay: 7,
};
export interface CriterionResult {
  state: "passed" | "not_passed" | "insufficient_data" | "unavailable";
  explanation: string;
  averageCoreC?: number;
  dropFromPeakC?: number;
  bottomSlopeCPerDay?: number;
}
export function evaluateCriterionT(
  history: Telemetry[],
  startedAt: string,
  now: number,
  config = defaultRule,
): CriterionResult {
  if (
    !config.methodologyValidated ||
    !config.corePositions.length ||
    config.referencePeakC === null ||
    !Number.isFinite(config.referencePeakC)
  )
    return {
      state: "unavailable",
      explanation:
        "The researcher must confirm the core sensor mapping, reference peak, and calculation method before Criterion T can be evaluated.",
    };
  if (
    config.windowDays <= 0 ||
    config.maxGapMinutes <= 0 ||
    !Number.isFinite(config.windowDays) ||
    !Number.isFinite(config.maxGapMinutes) ||
    !Number.isFinite(config.dropC) ||
    !Number.isFinite(config.maxBottomSlopeCPerDay) ||
    !Number.isFinite(config.earliestDay) ||
    !Number.isFinite(Date.parse(startedAt))
  )
    return {
      state: "unavailable",
      explanation: "The research rule settings need review.",
    };
  const insufficient = (explanation: string): CriterionResult => ({
    state: "insufficient_data",
    explanation,
  });
  if (now - Date.parse(startedAt) < (config.earliestDay - 1) * 86400000)
    return insufficient(
      `Evaluation begins on experiment day ${config.earliestDay}.`,
    );
  const sorted = [...history].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  if (
    new Set(sorted.map((f) => f.experiment_id)).size > 1 ||
    new Set(sorted.map((f) => f.timestamp)).size !== sorted.length
  )
    return insufficient(
      "The history must contain one experiment with distinct measurement times.",
    );
  const start = now - config.windowDays * 86400000;
  const points = sorted.filter(
    (f) => Date.parse(f.timestamp) >= start && Date.parse(f.timestamp) <= now,
  );
  const gap = config.maxGapMinutes * 60000;
  if (
    points.length < 3 ||
    Date.parse(points[0].timestamp) - start > gap ||
    now - Date.parse(points.at(-1)!.timestamp) > STALE_MS
  )
    return insufficient(
      "Not enough recent data to evaluate Criterion T. A complete three-day history is required.",
    );
  const core: { time: number; value: number }[] = [];
  const bottom: { time: number; value: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    const frame = points[i];
    if (
      i > 0 &&
      Date.parse(frame.timestamp) - Date.parse(points[i - 1].timestamp) > gap
    )
      return insufficient(
        "The measurement history has gaps. Review sensor availability before evaluating Criterion T.",
      );
    const values = config.corePositions.map((p) =>
      zoneValue(frame, p, now, true),
    );
    const b = zoneValue(frame, "bottom", now, true);
    if (b === null || values.some((v) => v === null))
      return insufficient(
        "Required sensor measurements are missing or invalid.",
      );
    core.push({
      time: Date.parse(frame.timestamp),
      value: (values as number[]).reduce((a, b) => a + b, 0) / values.length,
    });
    bottom.push({ time: Date.parse(frame.timestamp), value: b });
  }
  // Time-weighted trapezoidal mean avoids bias from uneven sampling.
  const elapsed = core.at(-1)!.time - core[0].time;
  if (elapsed <= 0)
    return insufficient("Distinct measurement times are required.");
  const averageCoreC =
    core
      .slice(1)
      .reduce(
        (sum, p, i) =>
          sum + ((p.time - core[i].time) * (p.value + core[i].value)) / 2,
        0,
      ) / elapsed;
  const bottomSlopeCPerDay = slope(bottom)!;
  const dropFromPeakC = config.referencePeakC - averageCoreC;
  const passed =
    dropFromPeakC >= config.dropC &&
    bottomSlopeCPerDay <= config.maxBottomSlopeCPerDay;
  return {
    state: passed ? "passed" : "not_passed",
    explanation: passed
      ? "The temperature trend meets Criterion T. Additional measurements are required before deciding whether to stop aeration. Review the experiment data and consult the responsible researcher."
      : "The temperature trend does not meet Criterion T. Continue monitoring and review the experiment data.",
    averageCoreC,
    dropFromPeakC,
    bottomSlopeCPerDay,
  };
}
