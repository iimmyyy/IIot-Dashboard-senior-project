import { describe, expect, it } from "vitest";
import { authenticateDemoAccount } from "@/lib/auth/accounts";

describe("demo role accounts", () => {
  const localDemoEnv = {
    NODE_ENV: "test",
    BIODRY_DEPLOYMENT_PROFILE: "local-demo",
    AUTH_SESSION_SECRET:
      "test-session-secret-that-is-longer-than-32-characters",
  };

  it.each([
    ["professor", "professor"],
    ["researcher", "researcher"],
    ["staff", "staff"],
  ] as const)("maps %s to the %s role", (username, role) => {
    expect(
      authenticateDemoAccount(username, "demo2026", localDemoEnv)?.role,
    ).toBe(role);
  });

  it("rejects an incorrect password", () => {
    expect(
      authenticateDemoAccount("researcher", "incorrect", localDemoEnv),
    ).toBeNull();
  });

  it("rejects all source-defined demo accounts in production", () => {
    expect(
      authenticateDemoAccount("researcher", "demo2026", {
        NODE_ENV: "production",
        BIODRY_DEPLOYMENT_PROFILE: "production",
        AUTH_SESSION_SECRET:
          "production-session-secret-that-is-longer-than-32-characters",
      }),
    ).toBeNull();
  });

  it("requires a strong deployment-provided password for a public demo", () => {
    const publicDemoEnv = {
      NODE_ENV: "production",
      BIODRY_DEPLOYMENT_PROFILE: "public-demo",
      NEXT_PUBLIC_DATA_MODE: "demo",
      AUTH_SESSION_SECRET:
        "public-demo-session-secret-that-is-longer-than-32-characters",
      DEMO_AUTH_PASSWORD: "a-private-public-demo-password",
    };
    expect(
      authenticateDemoAccount("professor", "demo2026", publicDemoEnv),
    ).toBeNull();
    expect(
      authenticateDemoAccount(
        "professor",
        "a-private-public-demo-password",
        publicDemoEnv,
      )?.role,
    ).toBe("professor");
  });
});
