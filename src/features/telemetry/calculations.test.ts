import { describe, expect, it } from "vitest";
import {
  averageTemperature,
  sensorStats,
  slope,
  STALE_MS,
  trend,
  zoneValue,
  zoneCondition,
} from "./calculations";
import type { Telemetry } from "@/types";
const now = Date.parse("2026-10-23T08:00:00Z");
const frame: Telemetry = {
  experiment_id: "test",
  chamber_id: "one",
  timestamp: new Date(now).toISOString(),
  readings: [
    { sensor_id: "t", position: "top", temperature_c: 50, quality: "good" },
    { sensor_id: "m", position: "middle", temperature_c: 53, quality: "good" },
    { sensor_id: "b", position: "bottom", temperature_c: 47, quality: "good" },
  ],
};
describe("usable temperatures", () => {
  it("distinguishes missing, outdated and faulty sensors", () => {
    expect(zoneCondition(undefined, "top", now)).toBe("waiting");
    expect(zoneCondition({ ...frame, readings: [] }, "top", now)).toBe(
      "missing",
    );
    expect(zoneCondition(frame, "top", now + STALE_MS + 1)).toBe("outdated");
    expect(
      zoneCondition(
        { ...frame, readings: [{ ...frame.readings[0], quality: "error" }] },
        "top",
        now,
      ),
    ).toBe("error");
  });
  it("averages multiple sensors within a position", () => {
    expect(
      zoneValue(
        {
          ...frame,
          readings: [
            ...frame.readings,
            {
              sensor_id: "t2",
              position: "top",
              temperature_c: 54,
              quality: "good",
            },
          ],
        },
        "top",
        now,
      ),
    ).toBe(52);
  });
  it("requires all three zones for the chamber average", () => {
    expect(averageTemperature(frame, now)).toBe(50);
    expect(
      averageTemperature({ ...frame, readings: frame.readings.slice(1) }, now),
    ).toBeNull();
  });
  it("does not replace missing or faulty readings", () => {
    expect(zoneValue({ ...frame, readings: [] }, "top", now)).toBeNull();
    expect(
      zoneValue(
        { ...frame, readings: [{ ...frame.readings[0], quality: "error" }] },
        "top",
        now,
      ),
    ).toBeNull();
  });
  it("withholds stale and future readings", () => {
    expect(zoneValue(frame, "top", now + STALE_MS + 1)).toBeNull();
    expect(zoneValue(frame, "top", now - 60000)).toBeNull();
  });
  it("checks individual sensor timestamps, including in historical data", () => {
    expect(
      zoneValue(
        {
          ...frame,
          readings: [
            {
              ...frame.readings[0],
              timestamp: new Date(now - 300000).toISOString(),
            },
          ],
        },
        "top",
        now,
        true,
      ),
    ).toBeNull();
  });
  it("does not average around an invalid sensor in the same zone", () => {
    expect(
      zoneValue(
        {
          ...frame,
          readings: [
            ...frame.readings,
            {
              sensor_id: "t2",
              position: "top",
              temperature_c: null,
              quality: "missing",
            },
          ],
        },
        "top",
        now,
      ),
    ).toBeNull();
  });
});
it("uses the sensor's actual age, even when the enclosing frame is recent", () => {
  const readingTime = new Date(now - 140000).toISOString();
  const recentFrame = {
    ...frame,
    timestamp: new Date(now - 80000).toISOString(),
    readings: [{ ...frame.readings[0], timestamp: readingTime }],
  };
  expect(zoneValue(recentFrame, "top", now)).toBeNull();
});
describe("historical analysis", () => {
  const frames = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    ...frame,
    timestamp: new Date(now - (6 - i) * 3600000).toISOString(),
    readings: frame.readings.map((r) => ({
      ...r,
      temperature_c: r.temperature_c! - i,
    })),
  }));
  it("uses degrees Celsius per day for slope", () => {
    expect(
      slope([
        { time: now, value: 50 },
        { time: now + 86400000, value: 48 },
      ]),
    ).toBe(-2);
    expect(slope([{ time: now, value: 50 }])).toBeNull();
  });
  it("identifies falling trends from sufficient recent data", () =>
    expect(trend(frames, "top")).toBe("Falling"));
  it("does not state a trend across missing data or large gaps", () => {
    expect(
      trend(
        frames.map((f, i) => (i === 3 ? { ...f, readings: [] } : f)),
        "top",
      ),
    ).toBe("Unavailable");
    expect(trend([frames[0], frames[6]], "top")).toBe("Unavailable");
  });
  it("does not invent a current or endpoint change when the final frame is missing", () => {
    const stats = sensorStats(
      [
        ...frames,
        {
          ...frame,
          timestamp: new Date(now + 1000).toISOString(),
          readings: [],
        },
      ],
      "top",
    );
    expect(stats?.current).toBeNull();
    expect(stats?.change).toBeNull();
  });
});
