import { describe, expect, it } from "vitest";
import { demoAlerts } from "@/lib/mock/data";
import {
  appendAlertAcknowledgementAudit,
  loadBrowserAuditLog,
} from "./browser";

describe("browser audit log", () => {
  it("records the authenticated actor when an alert is acknowledged", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    appendAlertAcknowledgementAudit(
      storage,
      demoAlerts()[0],
      {
        id: "USR-RES-001",
        username: "researcher",
        displayName: "Researcher Demo",
        role: "researcher",
      },
      "2026-10-29T03:00:00Z",
    );
    const event = loadBrowserAuditLog(storage)[0];
    expect(event.action).toBe("alert.acknowledged");
    expect(event.actor_role).toBe("researcher");
    expect(event.target_type).toBe("alert");
  });
});
