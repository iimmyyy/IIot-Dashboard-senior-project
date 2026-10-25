import { describe, expect, it } from "vitest";
import { telemetryCsv } from "./export";
import { demoFrame } from "@/lib/mock/data";
describe("measurement export", () => {
  it("keeps UTC sensor times and Bangkok display times", () => {
    const frame = demoFrame(Date.parse("2026-10-23T08:00:00Z"));
    frame.readings[0].timestamp = "2026-10-23T07:59:00Z";
    const csv = telemetryCsv([frame], "demo");
    expect(csv).toContain('"2026-10-23T07:59:00Z","23 Oct 2026, 14:59"');
    expect(csv).toContain('"demo"');
    expect(csv.split("\r\n")).toHaveLength(4);
  });
  it("escapes fields that spreadsheet software could treat as formulas", () => {
    const frame = demoFrame(Date.now());
    frame.experiment_id = '=HYPERLINK("test")';
    expect(telemetryCsv([frame], "live")).toContain('"\'=HYPERLINK(""test"")"');
  });
});
