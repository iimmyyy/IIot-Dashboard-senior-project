import { z } from "zod";
import {
  alertSchema,
  experimentSchema,
  systemSchema,
  telemetrySchema,
  type DataMode,
  type Chamber,
  type ResearchAlert,
  type Scenario,
} from "@/types";
import {
  demoAlerts,
  demoExperiments,
  demoHistory,
  demoLatest,
} from "@/lib/mock/data";

export const mode: DataMode =
  process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "demo";
export const endpoints = {
  status: "/api/v1/system/status",
  experiments: "/api/v1/experiments",
  latest: "/api/v1/telemetry/latest",
  history: "/api/v1/telemetry/history",
  alerts: "/api/v1/alerts",
};
async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
) {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base)
    throw new Error(
      "The data service address is missing. Ask the system administrator to configure the connection.",
    );
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok)
    throw new Error(
      `The data service could not complete this request (${response.status}). Try again or contact the system administrator.`,
    );
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error(
      "The data service returned an unexpected response. Ask the system administrator to check the connection.",
    );
  return parsed.data;
}
function loadAcknowledgements(): Record<string, { at: string; by: string }> {
  if (typeof window === "undefined") return {};
  try {
    return z
      .record(z.string(), z.object({ at: z.iso.datetime(), by: z.string() }))
      .parse(JSON.parse(localStorage.getItem("biodry-ack-v1") ?? "{}"));
  } catch {
    return {};
  }
}
export const api = {
  experiments: () =>
    mode === "demo"
      ? Promise.resolve(demoExperiments)
      : request(endpoints.experiments, z.array(experimentSchema)),
  experiment: (id: string) =>
    mode === "demo"
      ? Promise.resolve(demoExperiments.find((e) => e.id === id) ?? null)
      : request(
          `${endpoints.experiments}/${encodeURIComponent(id)}`,
          experimentSchema.nullable(),
        ),
  latest: (scenario: Scenario, chamberId: Chamber = "L1") =>
    mode === "demo"
      ? Promise.resolve(demoLatest(scenario, chamberId))
      : request(
          `${endpoints.latest}?${new URLSearchParams({ chamber_id: chamberId })}`,
          telemetrySchema.nullable(),
        ),
  history: (
    id: string,
    start: number,
    end: number,
    chamberId: Chamber = "L1",
  ) =>
    mode === "demo"
      ? Promise.resolve(demoHistory(id, start, end, chamberId))
      : request(
          `${endpoints.history}?${new URLSearchParams({ experiment_id: id, chamber_id: chamberId, start: new Date(start).toISOString(), end: new Date(end).toISOString() })}`,
          z.array(telemetrySchema),
        ).then((frames) =>
          frames
            .filter(
              (f) =>
                f.experiment_id === id &&
                f.chamber_id === chamberId &&
                Date.parse(f.timestamp) >= start &&
                Date.parse(f.timestamp) <= end,
            )
            .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
        ),
  status: () =>
    mode === "demo"
      ? Promise.resolve({
          api_connected: true,
          last_sync: new Date().toISOString(),
          blower_status: "unknown" as const,
        })
      : request(endpoints.status, systemSchema),
  alerts: () => {
    if (mode === "live") return request(endpoints.alerts, z.array(alertSchema));
    const saved = loadAcknowledgements();
    return Promise.resolve(
      demoAlerts().map((a) =>
        saved[a.id]
          ? {
              ...a,
              acknowledged_at: saved[a.id].at,
              acknowledged_by: saved[a.id].by,
            }
          : a,
      ),
    );
  },
  acknowledge: async (alert: ResearchAlert, name: string) => {
    if (mode === "live")
      return request(
        `${endpoints.alerts}/${encodeURIComponent(alert.id)}/acknowledge`,
        alertSchema,
        { method: "POST", body: JSON.stringify({ acknowledged_by: name }) },
      );
    const at = new Date().toISOString();
    const saved = loadAcknowledgements();
    saved[alert.id] = { at, by: name };
    localStorage.setItem("biodry-ack-v1", JSON.stringify(saved));
    return { ...alert, acknowledged_at: at, acknowledged_by: name };
  },
};
