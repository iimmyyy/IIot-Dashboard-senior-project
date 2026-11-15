import { describe, expect, it } from "vitest";
import type { Telemetry } from "@/types";
import {
  formatBatchRunningTime,
  notificationContextFromTelemetry,
} from "./notification-context";

describe("notification context", () => {
  it("uses current valid zone readings and calculates the batch age", () => {
    const sentAt = "2026-11-15T05:00:00.000Z";
    const frame: Telemetry = {
      experiment_id: "BD-2026-008",
      chamber_id: "L1",
      timestamp: sentAt,
      readings: [
        {
          sensor_id: "top",
          position: "top",
          temperature_c: 51.2,
          quality: "good",
        },
        {
          sensor_id: "middle",
          position: "middle",
          temperature_c: 53.4,
          quality: "good",
        },
        {
          sensor_id: "bottom",
          position: "bottom",
          temperature_c: 49.6,
          quality: "good",
        },
      ],
    };

    const context = notificationContextFromTelemetry(
      frame,
      "2026-11-05T17:00:00.000Z",
      sentAt,
    );

    expect(context.currentTemperaturesC).toEqual({
      top: 51.2,
      middle: 53.4,
      bottom: 49.6,
    });
    expect(context.currentAverageTemperatureC).toBeCloseTo(51.4);
    expect(formatBatchRunningTime(context.batchStartedAt, sentAt)).toBe(
      "9.5 days",
    );
  });

  it("does not present stale telemetry or invalid dates as current data", () => {
    const context = notificationContextFromTelemetry(
      {
        experiment_id: "BD-2026-008",
        chamber_id: "L1",
        timestamp: "2026-11-15T04:50:00.000Z",
        readings: [
          {
            sensor_id: "top",
            position: "top",
            temperature_c: 51.2,
            quality: "good",
          },
        ],
      },
      "invalid",
      "2026-11-15T05:00:00.000Z",
    );

    expect(context.currentAverageTemperatureC).toBeNull();
    expect(Object.values(context.currentTemperaturesC)).toEqual([
      null,
      null,
      null,
    ]);
    expect(formatBatchRunningTime(context.batchStartedAt, context.sentAt)).toBe(
      "Not available",
    );
  });
});
