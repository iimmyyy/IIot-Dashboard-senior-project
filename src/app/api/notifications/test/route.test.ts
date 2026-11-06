import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";

const mocks = vi.hoisted(() => ({
  readSession: vi.fn(),
  recordAuditEvent: vi.fn(),
  sendEmailAlert: vi.fn(),
  sendLineAlert: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ readSession: mocks.readSession }));
vi.mock("@/lib/audit", () => ({ recordAuditEvent: mocks.recordAuditEvent }));
vi.mock("@/lib/notifications/providers", () => ({
  NotificationConfigurationError: class NotificationConfigurationError extends Error {},
  sendEmailAlert: mocks.sendEmailAlert,
  sendLineAlert: mocks.sendLineAlert,
}));

import { POST } from "./route";

const user = {
  id: "USR-RES-001",
  username: "researcher",
  displayName: "Researcher Demo",
  role: "researcher" as const,
};

function request(
  body: unknown = { channel: "email" },
  headers: Record<string, string> = {},
) {
  return new Request("https://demo.example/api/notifications/test", {
    method: "POST",
    headers: {
      Origin: "https://demo.example",
      "Sec-Fetch-Site": "same-origin",
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.5",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("notification test route security", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BIODRY_DEPLOYMENT_PROFILE", "local-demo");
    vi.stubEnv(
      "AUTH_SESSION_SECRET",
      "test-session-secret-that-is-longer-than-32-characters",
    );
    vi.stubEnv("NOTIFICATION_TEST_ENABLED", "true");
    resetRateLimitsForTests();
    mocks.readSession.mockResolvedValue({
      user,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    mocks.sendEmailAlert.mockResolvedValue({
      channel: "email",
      provider: "mailersend",
      providerMessageId: "test-id",
      duplicate: false,
    });
    mocks.sendLineAlert.mockResolvedValue({
      channel: "line",
      provider: "line-messaging-api",
      providerMessageId: "test-id",
      duplicate: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("stays disabled in a public production demo even when the old flag is true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BIODRY_DEPLOYMENT_PROFILE", "public-demo");
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "demo");
    vi.stubEnv("DEMO_AUTH_PASSWORD", "a-private-public-demo-password");
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mocks.sendEmailAlert).not.toHaveBeenCalled();
  });

  it("requires an authenticated same-origin request", async () => {
    expect(
      await POST(request({}, { Origin: "https://attacker.example" })),
    ).toMatchObject({ status: 403 });
    mocks.readSession.mockResolvedValue(null);
    expect(await POST(request())).toMatchObject({ status: 401 });
  });

  it("rejects staff and browser-supplied destination fields", async () => {
    mocks.readSession.mockResolvedValue({
      user: { ...user, role: "staff" },
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    expect(await POST(request())).toMatchObject({ status: 403 });

    mocks.readSession.mockResolvedValue({
      user,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    expect(
      await POST(request({ channel: "email", to: "attacker@example.com" })),
    ).toMatchObject({ status: 400 });
  });

  it("limits each actor and client to three tests per ten minutes", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1)
      expect(await POST(request())).toMatchObject({ status: 200 });
    const blocked = await POST(request());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(mocks.sendEmailAlert).toHaveBeenCalledTimes(3);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      user,
      "notification.test_rate_limited",
      expect.any(Object),
    );
  });
});
