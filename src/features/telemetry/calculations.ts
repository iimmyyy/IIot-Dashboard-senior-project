import { positions, type Position, type Telemetry } from "@/types";

export const STALE_MS = 90_000;
export function zoneCondition(
  frame: Telemetry | undefined,
  position: Position,
  now: number,
) {
  if (!frame) return "waiting";
  const sensors = frame.readings.filter(
    (reading) => reading.position === position,
  );
  if (
    sensors.some((reading) => reading.quality === "error") ||
    Date.parse(frame.timestamp) > now + 30_000
  )
    return "error";
  if (
    now - Date.parse(frame.timestamp) > STALE_MS ||
    sensors.some(
      (reading) =>
        reading.timestamp && now - Date.parse(reading.timestamp) > STALE_MS,
    )
  )
    return "outdated";
  if (
    !sensors.length ||
    sensors.some(
      (reading) =>
        reading.quality === "missing" || reading.temperature_c === null,
    )
  )
    return "missing";
  return zoneValue(frame, position, now) === null ? "error" : "good";
}
export function zoneValue(
  frame: Telemetry | undefined,
  position: Position,
  now: number,
  allowHistorical = false,
): number | null {
  if (
    !frame ||
    (!allowHistorical &&
      (now - Date.parse(frame.timestamp) > STALE_MS ||
        Date.parse(frame.timestamp) > now + 30_000))
  )
    return null;
  const sensors = frame.readings.filter((r) => r.position === position);
  if (
    !sensors.length ||
    sensors.some(
      (r) =>
        r.quality !== "good" ||
        r.temperature_c === null ||
        (r.timestamp &&
          ((allowHistorical ? Date.parse(frame.timestamp) : now) -
            Date.parse(r.timestamp) >
            STALE_MS ||
            Date.parse(r.timestamp) > Date.parse(frame.timestamp) + 30_000)),
    )
  )
    return null;
  return (
    sensors.reduce((sum, sensor) => sum + sensor.temperature_c!, 0) /
    sensors.length
  );
}
export function averageTemperature(frame: Telemetry | undefined, now: number) {
  const values = positions.map((p) => zoneValue(frame, p, now));
  return values.some((v) => v === null)
    ? null
    : (values as number[]).reduce((a, b) => a + b, 0) / 3;
}
export function slope(points: { time: number; value: number }[]) {
  if (points.length < 2) return null;
  const origin = points[0].time;
  const xs = points.map((p) => (p.time - origin) / 86_400_000);
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const yMean = points.reduce((a, b) => a + b.value, 0) / points.length;
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  return denominator === 0
    ? null
    : points.reduce(
        (sum, p, i) => sum + (xs[i] - xMean) * (p.value - yMean),
        0,
      ) / denominator;
}
export function trend(history: Telemetry[], position: Position) {
  if (history.length < 2) return "Unavailable";
  const end = Date.parse(history.at(-1)!.timestamp);
  const recent = history.filter(
    (f) => Date.parse(f.timestamp) >= end - 6 * 3600000,
  );
  if (
    recent.length < 2 ||
    recent.some((f) => zoneValue(f, position, end, true) === null)
  )
    return "Unavailable";
  if (
    recent.some(
      (f, i) =>
        i > 0 &&
        Date.parse(f.timestamp) - Date.parse(recent[i - 1].timestamp) >
          90 * 60000,
    )
  )
    return "Unavailable";
  const rate = slope(
    recent.map((f) => ({
      time: Date.parse(f.timestamp),
      value: zoneValue(f, position, end, true)!,
    })),
  );
  return rate === null
    ? "Unavailable"
    : rate > 0.5
      ? "Rising"
      : rate < -0.5
        ? "Falling"
        : "Stable";
}
export function sensorStats(history: Telemetry[], position: Position) {
  const values = history
    .map((f) => zoneValue(f, position, 0, true))
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  const first = history[0] && zoneValue(history[0], position, 0, true);
  const last = history.at(-1) && zoneValue(history.at(-1), position, 0, true);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    average: values.reduce((a, b) => a + b, 0) / values.length,
    current: last ?? null,
    change: first != null && last != null ? last - first : null,
  };
}
