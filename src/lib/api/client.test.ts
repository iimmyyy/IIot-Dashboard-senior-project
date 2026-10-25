import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client";
import { telemetrySchema } from "@/types";
import { demoAlerts, demoFrame } from "@/lib/mock/data";
import { bangkokInput, dateTime } from "@/lib/utils";
afterEach(() => vi.unstubAllGlobals());
describe("contracts and acknowledgements", () => {
  it("rejects invalid temperatures and duplicate sensor ids", () => {
    const frame = demoFrame(Date.now());
    expect(
      telemetrySchema.safeParse({
        ...frame,
        readings: [{ ...frame.readings[0], temperature_c: "53" }],
      }).success,
    ).toBe(false);
    expect(
      telemetrySchema.safeParse({
        ...frame,
        readings: [frame.readings[0], frame.readings[0]],
      }).success,
    ).toBe(false);
  });
  it("persists acknowledgement separately from resolution", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const before = demoAlerts()[0];
    const after = await api.acknowledge(before, "Researcher A");
    expect(after.acknowledged_by).toBe("Researcher A");
    expect(after.acknowledged_at).toBeTruthy();
    expect(after.resolved_at).toBeNull();
    expect((await api.alerts())[0].acknowledged_by).toBe("Researcher A");
  });
  it("recovers safely from damaged browser storage", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: () => "invalid" });
    expect((await api.alerts())[0].acknowledged_at).toBeNull();
  });
  it("formats and parses all local display times in Bangkok", () => {
    expect(dateTime("2026-10-23T08:00:00Z")).toBe("23 Oct 2026, 15:00");
    expect(bangkokInput("2026-10-23T15:00")).toBe("2026-10-23T08:00:00.000Z");
  });
});
