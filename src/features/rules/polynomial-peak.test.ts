import { describe, expect, it } from "vitest";
import type { Telemetry } from "@/types";
import {
  defaultPolynomialPeakConfig,
  evaluatePolynomialPeak,
} from "./polynomial-peak";
import {
  DEMO_ANCHOR,
  demoAlerts,
  demoExperiments,
  demoHistory,
} from "@/lib/mock/data";

const start = Date.parse("2026-10-20T00:00:00Z");
function historyFrom(values: number[], stepHours = 1): Telemetry[] {
  return values.map((temperature, index) => ({
    experiment_id: "test",
    chamber_id: "one",
    timestamp: new Date(start + index * stepHours * 3_600_000).toISOString(),
    readings: (["top", "middle", "bottom"] as const).map((position) => ({
      sensor_id: position,
      position,
      temperature_c: temperature,
      quality: "good" as const,
    })),
  }));
}

const config = {
  ...defaultPolynomialPeakConfig,
  windowHours: 12,
  minPoints: 8,
  maxGapHours: 2,
};

describe("quadratic temperature peak alert", () => {
  it("alerts after a well-fitted peak when the latest slope is falling", () => {
    const values = Array.from(
      { length: 13 },
      (_, hour) => 62 - 0.18 * (hour - 5) ** 2,
    );
    const result = evaluatePolynomialPeak(historyFrom(values), config);
    expect(result.state).toBe("alert");
    expect(result.rSquared).toBeCloseTo(1);
    expect(result.latestSlopeCPerHour).toBeLessThan(0);
    expect(result.dropFromPeakC).toBeGreaterThan(0.5);
    expect(Date.parse(result.peakAt!)).toBe(
      start + 5 * 3_600_000,
    );
  });

  it("does not alert while the fitted peak is still ahead", () => {
    const values = Array.from(
      { length: 13 },
      (_, hour) => 62 - 0.18 * (hour - 16) ** 2,
    );
    expect(evaluatePolynomialPeak(historyFrom(values), config).state).toBe(
      "no_alert",
    );
  });

  it("does not treat a linear decline as a passed quadratic peak", () => {
    const values = Array.from({ length: 13 }, (_, hour) => 60 - hour * 0.4);
    expect(evaluatePolynomialPeak(historyFrom(values), config).state).toBe(
      "no_alert",
    );
  });

  it("requires R squared above the configured threshold", () => {
    const values = [48, 55, 49, 58, 50, 57, 49, 56, 51, 55, 50, 54, 52];
    const result = evaluatePolynomialPeak(historyFrom(values), config);
    expect(result.rSquared).toBeLessThanOrEqual(config.minRSquared);
    expect(result.state).toBe("no_alert");
  });

  it("requires enough complete measurements without large gaps", () => {
    expect(
      evaluatePolynomialPeak(historyFrom([50, 51, 52]), config).state,
    ).toBe("insufficient_data");
    const gapped = historyFrom(
      Array.from({ length: 13 }, (_, hour) => 62 - 0.18 * (hour - 5) ** 2),
    ).filter((_, index) => index < 4 || index > 7);
    expect(evaluatePolynomialPeak(gapped, config).state).toBe(
      "insufficient_data",
    );
  });

  it("detects the completed peak in the current demo experiment", () => {
    const result = evaluatePolynomialPeak(
      demoHistory(
        demoExperiments[0].id,
        DEMO_ANCHOR - 7 * 86_400_000,
        DEMO_ANCHOR,
      ),
    );
    expect(result.state).toBe("alert");
    expect(result.rSquared).toBeGreaterThan(0.7);
    const alert = demoAlerts().find((item) => item.id === "ALT-POLY-0082");
    expect(alert?.severity).toBe("warning");
    expect(alert?.detected_at).toBe(result.peakAt);
    expect(Date.parse(alert!.detected_at)).toBeLessThan(
      DEMO_ANCHOR - 24 * 60 * 60 * 1000,
    );
    expect(alert?.supporting_values[0].value).toMatch(/^R² 0\./);
  });
});
