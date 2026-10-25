import { describe, expect, it } from "vitest";
import { defaultRule, evaluateCriterionT, type RuleConfig } from "./criterion";
import type { Telemetry } from "@/types";
const now = Date.parse("2026-10-23T08:00:00Z");
const start = new Date(now - 9 * 86400000).toISOString();
const config: RuleConfig = {
  ...defaultRule,
  methodologyValidated: true,
  corePositions: ["middle"],
  referencePeakC: 65,
};
const history: Telemetry[] = Array.from({ length: 73 }, (_, i) => ({
  experiment_id: "test",
  chamber_id: "one",
  timestamp: new Date(now - (72 - i) * 3600000).toISOString(),
  readings: [
    {
      sensor_id: "m",
      position: "middle",
      temperature_c: 55 - i / 36,
      quality: "good",
    },
    {
      sensor_id: "b",
      position: "bottom",
      temperature_c: 50 - i / 72,
      quality: "good",
    },
  ],
}));
describe("Criterion T research rule", () => {
  it("requires an approved methodology, mapping and reference peak", () => {
    expect(evaluateCriterionT(history, start, now).state).toBe("unavailable");
    expect(
      evaluateCriterionT(history, start, now, {
        ...config,
        referencePeakC: null,
      }).state,
    ).toBe("unavailable");
  });
  it("evaluates only temperature and explains the additional measurements required", () => {
    const result = evaluateCriterionT(history, start, now, config);
    expect(result.state).toBe("passed");
    expect(result.averageCoreC).toBeCloseTo(54);
    expect(result.bottomSlopeCPerDay).toBeCloseTo(-1 / 3);
    expect(result.explanation).toContain(
      "Additional measurements are required",
    );
  });
  it("fails when the configured drop is not reached", () =>
    expect(
      evaluateCriterionT(history, start, now, { ...config, referencePeakC: 56 })
        .state,
    ).toBe("not_passed"));
  it("fails when the bottom is warming above the configured limit", () => {
    const warming = history.map((f, i) => ({
      ...f,
      readings: f.readings.map((r) =>
        r.position === "bottom" ? { ...r, temperature_c: 45 + i / 12 } : r,
      ),
    }));
    expect(evaluateCriterionT(warming, start, now, config).state).toBe(
      "not_passed",
    );
  });
  it("requires day 7 and complete recent three-day data", () => {
    expect(
      evaluateCriterionT(
        history,
        new Date(now - 4 * 86400000).toISOString(),
        now,
        config,
      ).state,
    ).toBe("insufficient_data");
    expect(
      evaluateCriterionT(history.slice(10), start, now, config).state,
    ).toBe("insufficient_data");
    expect(
      evaluateCriterionT(history.slice(0, -1), start, now, config).state,
    ).toBe("insufficient_data");
  });
  it("rejects gaps and missing sensors", () => {
    expect(
      evaluateCriterionT(
        history.filter((_, i) => i < 25 || i > 30),
        start,
        now,
        config,
      ).state,
    ).toBe("insufficient_data");
    expect(
      evaluateCriterionT(
        history.map((f, i) => (i === 12 ? { ...f, readings: [] } : f)),
        start,
        now,
        config,
      ).state,
    ).toBe("insufficient_data");
  });
  it("rejects mixed experiments and duplicate frames", () => {
    expect(
      evaluateCriterionT([...history, history[0]], start, now, config).state,
    ).toBe("insufficient_data");
    expect(
      evaluateCriterionT(
        history.map((f, i) => (i === 0 ? { ...f, experiment_id: "other" } : f)),
        start,
        now,
        config,
      ).state,
    ).toBe("insufficient_data");
  });
  it("returns no result from invalid configuration", () =>
    expect(
      evaluateCriterionT(history, start, now, { ...config, maxGapMinutes: -1 })
        .state,
    ).toBe("unavailable"));
  it("sorts out-of-order historical frames before evaluation", () =>
    expect(
      evaluateCriterionT([...history].reverse(), start, now, config).state,
    ).toBe("passed"));
});
