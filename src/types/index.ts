import { z } from "zod";

export const positions = ["top", "middle", "bottom"] as const;
export type Position = (typeof positions)[number];
const iso = z.iso.datetime({ offset: true });
export const readingSchema = z.object({
  sensor_id: z.string().min(1),
  position: z.enum(positions),
  temperature_c: z.number().finite().min(-50).max(200).nullable(),
  quality: z.enum(["good", "error", "missing"]),
  timestamp: iso.optional(),
});
export const telemetrySchema = z
  .object({
    experiment_id: z.string(),
    chamber_id: z.string(),
    timestamp: iso,
    readings: z.array(readingSchema),
  })
  .superRefine((value, context) => {
    const ids = value.readings.map((reading) => reading.sensor_id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        message: "Duplicate sensor identifiers",
      });
  });
export const experimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  start_date: iso,
  end_date: iso.nullable(),
  status: z.enum(["running", "completed"]),
  sensor_positions: z.array(z.enum(positions)),
  conditions: z.string(),
});
export const alertSchema = z.object({
  id: z.string(),
  experiment_id: z.string(),
  title: z.string(),
  description: z.string(),
  action: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  detected_at: iso,
  supporting_values: z.array(
    z.object({ label: z.string(), value: z.string() }),
  ),
  acknowledged_at: iso.nullable(),
  acknowledged_by: z.string().nullable(),
  resolved_at: iso.nullable(),
});
export const systemSchema = z.object({
  api_connected: z.boolean(),
  last_sync: iso.nullable(),
  blower_status: z.enum(["on", "off", "unknown"]).default("unknown"),
});
export type Reading = z.infer<typeof readingSchema>;
export type Telemetry = z.infer<typeof telemetrySchema>;
export type Experiment = z.infer<typeof experimentSchema>;
export type ResearchAlert = z.infer<typeof alertSchema>;
export type SystemStatus = z.infer<typeof systemSchema>;
export type DataMode = "demo" | "live";
export type Scenario =
  "normal" | "stale" | "missing" | "disconnected" | "waiting";
export type Connection =
  "connecting" | "connected" | "reconnecting" | "disconnected";
