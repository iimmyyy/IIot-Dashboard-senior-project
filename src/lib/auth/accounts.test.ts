import { describe, expect, it } from "vitest";
import { authenticateDemoAccount } from "@/lib/auth/accounts";

describe("demo role accounts", () => {
  it.each([
    ["professor", "professor"],
    ["researcher", "researcher"],
    ["staff", "staff"],
  ] as const)("maps %s to the %s role", (username, role) => {
    expect(authenticateDemoAccount(username, "demo2026")?.role).toBe(role);
  });

  it("rejects an incorrect password", () => {
    expect(authenticateDemoAccount("researcher", "incorrect")).toBeNull();
  });
});
