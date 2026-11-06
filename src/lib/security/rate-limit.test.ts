import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRateLimit,
  clientAddress,
  isSameOriginRequest,
  resetRateLimitsForTests,
  takeRateLimit,
} from "./rate-limit";

describe("prototype abuse controls", () => {
  beforeEach(resetRateLimitsForTests);

  it("blocks attempts over the fixed-window limit", () => {
    expect(
      takeRateLimit("test", { limit: 2, windowMs: 60_000 }, 0).allowed,
    ).toBe(true);
    expect(
      takeRateLimit("test", { limit: 2, windowMs: 60_000 }, 1).allowed,
    ).toBe(true);
    expect(
      takeRateLimit("test", { limit: 2, windowMs: 60_000 }, 2),
    ).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("resets a successful login key", () => {
    takeRateLimit("login", { limit: 1, windowMs: 60_000 }, 0);
    clearRateLimit("login");
    expect(
      takeRateLimit("login", { limit: 1, windowMs: 60_000 }, 1).allowed,
    ).toBe(true);
  });

  it("uses the first forwarded client address", () => {
    expect(
      clientAddress(
        new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }),
      ),
    ).toBe("203.0.113.1");
  });

  it("requires an explicit same-origin browser request", () => {
    expect(
      isSameOriginRequest(
        new Request("https://demo.example/api/test", {
          headers: {
            Origin: "https://demo.example",
            "Sec-Fetch-Site": "same-origin",
          },
        }),
      ),
    ).toBe(true);
    expect(
      isSameOriginRequest(
        new Request("https://demo.example/api/test", {
          headers: { Origin: "https://attacker.example" },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOriginRequest(new Request("https://demo.example/api/test")),
    ).toBe(false);
  });
});
