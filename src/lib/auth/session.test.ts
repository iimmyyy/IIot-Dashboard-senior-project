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
  it("round-trips a valid session", () => {
    expect(decodeSession(encodeSession(session()))?.user.role).toBe(
      "researcher",
    );
  });

  it("rejects a modified token", () => {
    const token = encodeSession(session());
    const [payload, signature] = token.split(".");
    expect(decodeSession(`${payload}x.${signature}`)).toBeNull();
  });

  it("rejects an expired session", () => {
    expect(
      decodeSession(
        encodeSession(session({ expiresAt: Date.now() - 1_000 })),
      ),
    ).toBeNull();
  });
});
