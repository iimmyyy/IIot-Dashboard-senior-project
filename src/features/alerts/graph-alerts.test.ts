import { describe, expect, it } from "vitest";
import { isGraphAlert } from "./graph-alerts";
import { demoAlerts } from "@/lib/mock/data";

describe("graph alert visibility", () => {
  it("shows only temperature peak alerts on charts", () => {
    const alerts = demoAlerts();
    const visible = alerts.filter(isGraphAlert);
    expect(visible).toHaveLength(3);
    expect(visible.every((alert) => alert.title === "Temperature peak passed")).toBe(
      true,
    );
    expect(
      alerts.find((alert) => alert.title === "Monitoring resumed") &&
        isGraphAlert(alerts.find((alert) => alert.title === "Monitoring resumed")!),
    ).toBe(false);
  });
});
