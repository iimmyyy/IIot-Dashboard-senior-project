import { describe, expect, it } from "vitest";
import {
  demoPasswordForEnvironment,
  getDeploymentPolicy,
  validSessionSecret,
} from "./deployment";

const secret = "test-session-secret-that-is-longer-than-32-characters";

describe("deployment security policy", () => {
  it("defaults production builds to fail-closed production authentication", () => {
    const policy = getDeploymentPolicy({ NODE_ENV: "production" });
    expect(policy.profile).toBe("production");
    expect(policy.demoAuthEnabled).toBe(false);
    expect(policy.notificationTestsEnabled).toBe(false);
  });

  it("allows local demo convenience only outside production", () => {
    const env = { NODE_ENV: "development", AUTH_SESSION_SECRET: secret };
    const policy = getDeploymentPolicy(env);
    expect(policy.demoAuthEnabled).toBe(true);
    expect(policy.showLocalDemoCredentials).toBe(true);
    expect(demoPasswordForEnvironment(env)).toBe("demo2026");
  });

  it("rejects documented placeholders as session secrets", () => {
    expect(
      validSessionSecret(
        "generate-a-unique-random-secret-of-at-least-32-characters",
      ),
    ).toBe(false);
    expect(validSessionSecret("replace-with-a-long-random-secret")).toBe(
      false,
    );
  });

  it("refuses local-demo when NODE_ENV is production", () => {
    const policy = getDeploymentPolicy({
      NODE_ENV: "production",
      BIODRY_DEPLOYMENT_PROFILE: "local-demo",
      AUTH_SESSION_SECRET: secret,
    });
    expect(policy.demoAuthEnabled).toBe(false);
    expect(policy.configurationErrors).toContain(
      "The local-demo profile cannot run with NODE_ENV=production.",
    );
  });

  it("requires demo-only data and a non-default password for public demos", () => {
    const base = {
      NODE_ENV: "production",
      BIODRY_DEPLOYMENT_PROFILE: "public-demo",
      AUTH_SESSION_SECRET: secret,
    };
    expect(
      getDeploymentPolicy({ ...base, DEMO_AUTH_PASSWORD: "demo2026" })
        .demoAuthEnabled,
    ).toBe(false);
    expect(
      getDeploymentPolicy({
        ...base,
        NEXT_PUBLIC_DATA_MODE: "live",
        DEMO_AUTH_PASSWORD: "a-private-public-demo-password",
      }).demoAuthEnabled,
    ).toBe(false);
    expect(
      getDeploymentPolicy({
        ...base,
        NEXT_PUBLIC_DATA_MODE: "demo",
        DEMO_AUTH_PASSWORD: "a-private-public-demo-password",
      }).demoAuthEnabled,
    ).toBe(true);
  });

  it("never enables provider tests in public-demo or production", () => {
    for (const profile of ["public-demo", "production"] as const) {
      const policy = getDeploymentPolicy({
        NODE_ENV: "production",
        BIODRY_DEPLOYMENT_PROFILE: profile,
        NEXT_PUBLIC_DATA_MODE: "demo",
        AUTH_SESSION_SECRET: secret,
        DEMO_AUTH_PASSWORD: "a-private-public-demo-password",
        NOTIFICATION_TEST_ENABLED: "true",
      });
      expect(policy.notificationTestsEnabled).toBe(false);
    }
  });
});
