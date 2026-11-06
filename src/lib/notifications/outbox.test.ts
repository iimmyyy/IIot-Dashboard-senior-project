import { describe, expect, it } from "vitest";
import { demoAlerts } from "@/lib/mock/data";
import {
  createAlertNotificationJobs,
  formatEmailAlert,
  formatLineAlert,
  formatLineFlexAlert,
} from "./outbox";

describe("notification outbox contract", () => {
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
    const message = formatLineAlert(demoAlerts()[0], "L2");
    expect(message).toContain("BioDry Alert — L2");
    expect(message).toContain("Action:");
    expect(message.length).toBeLessThan(1000);
  });

  it("formats a LINE Flex Message card with fallback text and alert details", () => {
    const message = formatLineFlexAlert(demoAlerts()[0], "L2");
    expect(message.type).toBe("flex");
    expect(message.altText).toContain("BioDry Alert: L2");
    expect(message.contents.type).toBe("bubble");
    expect(JSON.stringify(message.contents)).toContain("SUPPORTING VALUES");
    expect(JSON.stringify(message.contents)).toContain("RECOMMENDED ACTION");
  });

  it("formats a readable email report and escapes provider HTML", () => {
    const alert = {
      ...demoAlerts()[0],
      title: "Peak <passed>",
    };
    const report = formatEmailAlert(alert, "L1");
    expect(report.subject).toContain("L1");
    expect(report.text).toContain("Recommended action");
    expect(report.html).toContain("Peak &lt;passed&gt;");
    expect(report.html).not.toContain("Peak <passed>");
  });
});
