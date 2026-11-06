import { positions, type Telemetry } from "@/types";
import { zoneValue } from "@/features/telemetry/calculations";

export interface PolynomialPeakConfig {
  windowHours: number;
  minPoints: number;
  minRSquared: number;
  maxGapHours: number;
  minHoursAfterPeak: number;
  minDropC: number;
}

export interface PolynomialPeakResult {
  state: "alert" | "no_alert" | "insufficient_data";
  explanation: string;
  rSquared?: number;
  peakAt?: string;
  peakTemperatureC?: number;
  latestSlopeCPerHour?: number;
  dropFromPeakC?: number;
  pointsUsed?: number;
}

export const defaultPolynomialPeakConfig: PolynomialPeakConfig = {
  windowHours: 24 * 7,
  minPoints: 12,
  minRSquared: 0.7,
  maxGapHours: 3,
  minHoursAfterPeak: 1,
  minDropC: 0.5,
};

function solveThreeByThree(
  coefficients: number[][],
  values: number[],
): [number, number, number] | null {
  const matrix = coefficients.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column]))
        pivot = row;
    }
    if (Math.abs(matrix[pivot][column]) < 1e-12) return null;
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    for (let index = column; index < 4; index++)
      matrix[column][index] /= divisor;
    for (let row = 0; row < 3; row++) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let index = column; index < 4; index++)
        matrix[row][index] -= factor * matrix[column][index];
    }
  }
  return [matrix[0][3], matrix[1][3], matrix[2][3]];
}

function quadraticFit(points: { x: number; y: number }[]) {
  const sums = points.reduce<{
    x: number;
    x2: number;
    x3: number;
    x4: number;
    y: number;
    xy: number;
    x2y: number;
  }>(
    (result, point) => {
      const x2 = point.x * point.x;
      result.x += point.x;
      result.x2 += x2;
      result.x3 += x2 * point.x;
      result.x4 += x2 * x2;
      result.y += point.y;
      result.xy += point.x * point.y;
      result.x2y += x2 * point.y;
      return result;
    },
    { x: 0, x2: 0, x3: 0, x4: 0, y: 0, xy: 0, x2y: 0 },
  );
  const solved = solveThreeByThree(
    [
      [sums.x4, sums.x3, sums.x2],
      [sums.x3, sums.x2, sums.x],
      [sums.x2, sums.x, points.length],
    ],
    [sums.x2y, sums.xy, sums.y],
  );
  if (!solved) return null;
  const [a, b, c] = solved;
  const mean = sums.y / points.length;
  const total = points.reduce(
    (sum, point) => sum + (point.y - mean) ** 2,
    0,
  );
  if (total < 1e-12) return null;
  const residual = points.reduce(
    (sum, point) =>
      sum + (point.y - (a * point.x ** 2 + b * point.x + c)) ** 2,
    0,
  );
  return { a, b, c, rSquared: 1 - residual / total };
}

export function evaluatePolynomialPeak(
  history: Telemetry[],
  config = defaultPolynomialPeakConfig,
): PolynomialPeakResult {
  if (
    config.windowHours <= 0 ||
    config.minPoints < 3 ||
    config.minRSquared < 0 ||
    config.minRSquared > 1 ||
    config.maxGapHours <= 0 ||
    config.minHoursAfterPeak < 0 ||
    config.minDropC < 0
  )
    return {
      state: "insufficient_data",
      explanation: "Polynomial peak settings are invalid.",
    };
  const sorted = [...history]
    .filter((frame) => Number.isFinite(Date.parse(frame.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (!sorted.length)
    return {
      state: "insufficient_data",
      explanation: "No temperature history is available.",
    };
  const experimentId = sorted[0].experiment_id;
  if (sorted.some((frame) => frame.experiment_id !== experimentId))
    return {
      state: "insufficient_data",
      explanation: "Temperature history contains multiple experiments.",
    };
  const end = Date.parse(sorted.at(-1)!.timestamp);
  const start = end - config.windowHours * 3_600_000;
  const samples = sorted
    .filter((frame) => Date.parse(frame.timestamp) >= start)
    .flatMap((frame) => {
      const values = positions.map((position) =>
        zoneValue(frame, position, 0, true),
      );
      if (values.some((value) => value === null)) return [];
      return [
        {
          time: Date.parse(frame.timestamp),
          temperature:
            (values as number[]).reduce((sum, value) => sum + value, 0) /
            values.length,
        },
      ];
    });
  if (samples.length < config.minPoints)
    return {
      state: "insufficient_data",
      explanation: `At least ${config.minPoints} complete chamber measurements are required.`,
      pointsUsed: samples.length,
    };
  if (samples[0].time - start > config.maxGapHours * 3_600_000)
    return {
      state: "insufficient_data",
      explanation: "A complete polynomial evaluation window is required.",
      pointsUsed: samples.length,
    };
  if (
    samples.some(
      (sample, index) =>
        index > 0 &&
        sample.time - samples[index - 1].time >
          config.maxGapHours * 3_600_000,
    )
  )
    return {
      state: "insufficient_data",
      explanation: "Temperature history has a gap that is too large.",
      pointsUsed: samples.length,
    };
  const origin = samples[0].time;
  const points = samples.map((sample) => ({
    x: (sample.time - origin) / 3_600_000,
    y: sample.temperature,
  }));
  const fit = quadraticFit(points);
  if (!fit)
    return {
      state: "insufficient_data",
      explanation: "The temperature variation is insufficient for a quadratic fit.",
      pointsUsed: samples.length,
    };
  const latestX = points.at(-1)!.x;
  const hasDownwardCurve = fit.a < -1e-8;
  const peakX = hasDownwardCurve ? -fit.b / (2 * fit.a) : Number.NaN;
  const latestSlopeCPerHour = 2 * fit.a * latestX + fit.b;
  const peakTemperatureC = Number.isFinite(peakX)
    ? fit.a * peakX ** 2 + fit.b * peakX + fit.c
    : undefined;
  const latestTemperatureC =
    fit.a * latestX ** 2 + fit.b * latestX + fit.c;
  const dropFromPeakC =
    peakTemperatureC === undefined
      ? undefined
      : peakTemperatureC - latestTemperatureC;
  const peakIsConfirmed =
    fit.rSquared > config.minRSquared &&
    hasDownwardCurve &&
    peakX >= 0 &&
    peakX <= latestX - config.minHoursAfterPeak &&
    latestSlopeCPerHour < 0 &&
    dropFromPeakC !== undefined &&
    dropFromPeakC >= config.minDropC;
  return {
    state: peakIsConfirmed ? "alert" : "no_alert",
    explanation: peakIsConfirmed
      ? "A quadratic fit indicates that the chamber temperature has passed a peak and is falling."
      : "No confirmed quadratic temperature peak is currently detected.",
    rSquared: fit.rSquared,
    peakAt: Number.isFinite(peakX)
      ? new Date(origin + peakX * 3_600_000).toISOString()
      : undefined,
    peakTemperatureC,
    latestSlopeCPerHour,
    dropFromPeakC,
    pointsUsed: samples.length,
  };
}
