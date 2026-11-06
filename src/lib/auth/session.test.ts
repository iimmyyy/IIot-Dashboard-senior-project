import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession } from "@/lib/auth/session";
import type { AuthSession } from "@/lib/auth/types";

function session(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    user: {
      id: "USR-RES-001",
      username: "researcher",
      displayName: "Researcher Demo",
      role: "researcher",
    },
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe("signed auth session", () => {
  const secureEnv = {
    AUTH_SESSION_SECRET:
      "test-session-secret-that-is-longer-than-32-characters",
  };

  it("round-trips a valid session", () => {
    expect(
      decodeSession(encodeSession(session(), secureEnv), secureEnv)?.user.role,
    ).toBe("researcher");
  });

  it("rejects a modified token", () => {
    const token = encodeSession(session(), secureEnv);
    const [payload, signature] = token.split(".");
    expect(decodeSession(`${payload}x.${signature}`, secureEnv)).toBeNull();
  });

  it("rejects an expired session", () => {
    expect(
      decodeSession(
        encodeSession(session({ expiresAt: Date.now() - 1_000 }), secureEnv),
        secureEnv,
      ),
    ).toBeNull();
  });

  it("fails closed without a configured session secret", () => {
    expect(() => encodeSession(session(), {})).toThrow("AUTH_SESSION_SECRET");
    expect(decodeSession("payload.signature", {})).toBeNull();
  });

  it("rejects the former fallback and example placeholder secrets", () => {
    for (const secret of [
      "biodry-local-demo-session-secret-change-before-deployment",
      "replace-with-a-long-random-secret",
    ]) {
      expect(() =>
        encodeSession(session(), { AUTH_SESSION_SECRET: secret }),
      ).toThrow("AUTH_SESSION_SECRET");
    }
  });

  it("rejects demo sessions after switching to production with the same secret", () => {
    const publicDemoEnv = {
      NODE_ENV: "production",
      BIODRY_DEPLOYMENT_PROFILE: "public-demo",
      NEXT_PUBLIC_DATA_MODE: "demo",
      AUTH_SESSION_SECRET:
        "test-session-secret-that-is-longer-than-32-characters",
      DEMO_AUTH_PASSWORD: "a-private-public-demo-password",
    };
    const token = encodeSession(session(), publicDemoEnv);
    expect(decodeSession(token, publicDemoEnv)?.user.role).toBe("researcher");

    const productionEnv = {
      ...publicDemoEnv,
      BIODRY_DEPLOYMENT_PROFILE: "production",
    };
    expect(decodeSession(token, productionEnv)).toBeNull();
    expect(() => encodeSession(session(), productionEnv)).toThrow(
      "Prototype sessions are disabled",
    );
  });

  it("does not accept a session issued for another demo profile", () => {
    const localEnv = {
      ...secureEnv,
      NODE_ENV: "development",
      BIODRY_DEPLOYMENT_PROFILE: "local-demo",
    };
    const publicDemoEnv = {
      ...secureEnv,
      NODE_ENV: "production",
      BIODRY_DEPLOYMENT_PROFILE: "public-demo",
      NEXT_PUBLIC_DATA_MODE: "demo",
      DEMO_AUTH_PASSWORD: "a-private-public-demo-password",
    };
    const localCookie = encodeSession(session(), localEnv);
    const publicCookie = encodeSession(session(), publicDemoEnv);

    expect(decodeSession(localCookie, localEnv)).not.toBeNull();
    expect(decodeSession(publicCookie, publicDemoEnv)).not.toBeNull();
    expect(decodeSession(localCookie, publicDemoEnv)).toBeNull();
    expect(decodeSession(publicCookie, localEnv)).toBeNull();
  });

  it("does not allow demo sessions when the deployment policy is invalid", () => {
    const invalidEnv = {
      ...secureEnv,
      NODE_ENV: "production",
      BIODRY_DEPLOYMENT_PROFILE: "local-demo",
    };
    expect(decodeSession(encodeSession(session(), secureEnv), invalidEnv)).toBeNull();
    expect(() => encodeSession(session(), invalidEnv)).toThrow(
      "Prototype sessions are disabled",
    );
  });
});
