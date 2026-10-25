import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "live");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://research.example");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("live service contract", () => {
  it("does not fall back to demo data when a request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })),
    );
    const { api, mode } = await import("./client");
    expect(mode).toBe("live");
    await expect(api.latest("normal")).rejects.toThrow("503");
  });
  it("rejects malformed service responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ temperature: "not the contract" })),
    );
    const { api } = await import("./client");
    await expect(api.latest("normal")).rejects.toThrow("unexpected response");
  });
  it("requires a configured service address", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { api } = await import("./client");
    await expect(api.experiments()).rejects.toThrow("address is missing");
  });
  it("sends acknowledgements only to the central proposed endpoint", async () => {
    const { demoAlerts } = await import("@/lib/mock/data");
    const alert = demoAlerts()[0];
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ...alert,
        acknowledged_by: "Researcher A",
        acknowledged_at: new Date().toISOString(),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./client");
    const result = await api.acknowledge(alert, "Researcher A");
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://research.example/api/v1/alerts/${alert.id}/acknowledge`,
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(result.resolved_at).toBeNull();
  });
});
