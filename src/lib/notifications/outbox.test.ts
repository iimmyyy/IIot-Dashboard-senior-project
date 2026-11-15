import { describe, expect, it } from "vitest";
import { demoAlerts } from "@/lib/mock/data";
import {
  createAlertNotificationJobs,
  formatEmailAlert,
  formatLineAlert,
  formatLineFlexAlert,
} from "./outbox";

describe("notification outbox contract", () => {
  const context = {
    currentTemperaturesC: { top: 51.2, middle: 53.4, bottom: 49.6 },
    currentAverageTemperatureC: 51.4,
    batchStartedAt: "2026-11-05T17:00:00.000Z",
    sentAt: "2026-11-15T05:00:00.000Z",
  };

  it("creates one idempotent pending job per future channel", () => {
    const alert = demoAlerts()[0];
    const jobs = createAlertNotificationJobs(alert, "2026-10-29T02:00:00Z");
    expect(jobs.map((job) => job.channel)).toEqual(["email", "line"]);
    expect(jobs.every((job) => job.status === "pending")).toBe(true);
    expect(jobs.map((job) => job.idempotency_key)).toEqual([
      `${alert.id}:email`,
      `${alert.id}:line`,
    ]);
  });

  it("formats a concise LINE alert with evidence and action", () => {
    const message = formatLineAlert(demoAlerts()[0], context, "L2");
    expect(message).toContain("BioDry Alert — L2");
    expect(message).toContain("Top 51.2 °C");
    expect(message).toContain("Batch running time: 9.5 days");
    expect(message).toContain("Action:");
    expect(message.length).toBeLessThan(1000);
  });

  it("formats a LINE Flex Message card with fallback text and alert details", () => {
    const message = formatLineFlexAlert(demoAlerts()[0], context, "L2");
    expect(message.type).toBe("flex");
    expect(message.altText).toContain("BioDry Alert: L2");
    expect(message.contents.type).toBe("bubble");
    expect(JSON.stringify(message.contents)).toContain("SUPPORTING VALUES");
    expect(JSON.stringify(message.contents)).toContain("RECOMMENDED ACTION");
    expect(JSON.stringify(message.contents)).toContain("CURRENT BATCH");
    expect(JSON.stringify(message.contents)).toContain("51.2 °C");
    expect(JSON.stringify(message.contents)).toContain("9.5 days");
  });

  it("formats a readable email report and escapes provider HTML", () => {
    const alert = {
      ...demoAlerts()[0],
      title: "Peak <passed>",
    };
    const report = formatEmailAlert(alert, context, "L1");
    expect(report.subject).toContain("L1");
    expect(report.text).toContain("Recommended action");
    expect(report.text).toContain("Top temperature: 51.2 °C");
    expect(report.text).toContain("Batch running time: 9.5 days");
    expect(report.html).toContain("Peak &lt;passed&gt;");
    expect(report.html).not.toContain("Peak <passed>");
  });
});
