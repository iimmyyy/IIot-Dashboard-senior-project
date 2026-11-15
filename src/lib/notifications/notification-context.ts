import { averageTemperature, zoneValue } from "@/features/telemetry/calculations";
import { positions, type Position, type Telemetry } from "@/types";

export type NotificationContext = {
  currentTemperaturesC: Record<Position, number | null>;
  currentAverageTemperatureC: number | null;
  batchStartedAt: string | null;
  sentAt: string;
};

const millisecondsPerDay = 86_400_000;

export function notificationContextFromTelemetry(
  frame: Telemetry | null,
  batchStartedAt: string | null,
  sentAt: string,
): NotificationContext {
  const now = Date.parse(sentAt);
  const usableNow = Number.isFinite(now) ? now : Date.now();
  return {
    currentTemperaturesC: Object.fromEntries(
      positions.map((position) => [
        position,
        zoneValue(frame ?? undefined, position, usableNow),
      ]),
    ) as Record<Position, number | null>,
    currentAverageTemperatureC: averageTemperature(
      frame ?? undefined,
      usableNow,
    ),
    batchStartedAt,
    sentAt,
  };
}

export function formatCurrentTemperature(value: number | null) {
  return value !== null && Number.isFinite(value)
    ? `${value.toFixed(1)} °C`
    : "Not available";
}

export function formatBatchRunningTime(
  batchStartedAt: string | null,
  sentAt: string,
) {
  if (!batchStartedAt) return "Not available";
  const started = Date.parse(batchStartedAt);
  const sent = Date.parse(sentAt);
  if (!Number.isFinite(started) || !Number.isFinite(sent) || sent < started)
    return "Not available";

  const days = Math.round(((sent - started) / millisecondsPerDay) * 10) / 10;
  return `${days.toFixed(1)} ${days === 1 ? "day" : "days"}`;
}
