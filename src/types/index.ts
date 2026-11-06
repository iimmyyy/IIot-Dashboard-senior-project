import { z } from "zod";

export const positions = ["top", "middle", "bottom"] as const;
export type Position = (typeof positions)[number];
export const chambers = ["L1", "L2", "L3"] as const;
export type Chamber = (typeof chambers)[number];
const iso = z.iso.datetime({ offset: true });
const finite = z.number().finite();
const temperature = finite.min(-50).max(200);
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
  chamber_id: z.enum(chambers).optional(),
  kind: z.enum(["temperature_peak", "connection", "system"]).optional(),
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
export const dailyRecordInputSchema = z.object({
  experiment_id: z.string().min(1),
  record_date: z.iso.date(),
  chamber_id: z.enum(chambers),
  temperature_top_c: temperature,
  temperature_middle_c: temperature,
  temperature_bottom_c: temperature,
  temperature_core_c: temperature,
  temperature_air_c: temperature,
  below_peak_c: finite,
  bottom_slope_c_per_day: finite,
  drying_rate_kg_per_day: finite,
  eta: finite,
  nl_kg: finite,
  total_weight_kg: finite.min(0),
  leachate_kg: finite.min(0),
  height_m: finite.min(0),
  ar_m3_per_kg_per_day: finite.min(0),
  oxygen_core_percent: finite.min(0).max(100),
  carbon_dioxide_core_percent: finite.min(0).max(100),
});
export const dailyRecordSchema = dailyRecordInputSchema.extend({
  id: z.string().min(1),
  created_at: iso,
  updated_at: iso,
  entered_by_id: z.string().min(1),
  entered_by_name: z.string().min(1),
});
export const auditChangeSchema = z.object({
  field: z.string(),
  before: z.string().nullable(),
  after: z.string().nullable(),
});
export const auditLogSchema = z.object({
  id: z.string().min(1),
  occurred_at: iso,
  action: z.enum([
    "daily_record.created",
    "daily_record.updated",
    "alert.acknowledged",
    "batch.completed",
    "batch.started",
  ]),
  actor_id: z.string().min(1),
  actor_name: z.string().min(1),
  actor_role: z.enum(["professor", "researcher", "staff"]),
  target_type: z.enum(["daily_record", "alert", "batch"]),
  target_id: z.string().min(1),
  changes: z.array(auditChangeSchema),
});
export const notificationJobSchema = z.object({
  id: z.string().min(1),
  alert_id: z.string().min(1),
  channel: z.enum(["email", "line"]),
  status: z.enum(["pending", "sent", "failed"]),
  idempotency_key: z.string().min(1),
  created_at: iso,
  sent_at: iso.nullable(),
  attempts: z.number().int().min(0),
  last_error: z.string().nullable(),
});
export const batchCompletionSchema = z.object({
  id: z.string().min(1),
  experiment_id: z.string().min(1),
  chamber_id: z.enum(chambers),
  batch_run_id: z.string().min(1).default("initial"),
  status: z.literal("completed"),
  completion_basis: z.literal("temperature_peak_passed"),
  completed_at: iso,
  completed_by_id: z.string().min(1),
  completed_by_name: z.string().min(1),
});
export const batchStartSchema = z.object({
  id: z.string().min(1),
  experiment_id: z.string().min(1),
  chamber_id: z.enum(chambers),
  sequence: z.number().int().positive(),
  started_at: iso,
  started_by_id: z.string().min(1),
  started_by_name: z.string().min(1),
});
export type Reading = z.infer<typeof readingSchema>;
export type Telemetry = z.infer<typeof telemetrySchema>;
export type Experiment = z.infer<typeof experimentSchema>;
export type ResearchAlert = z.infer<typeof alertSchema>;
export type SystemStatus = z.infer<typeof systemSchema>;
export type DailyRecordInput = z.infer<typeof dailyRecordInputSchema>;
export type DailyRecord = z.infer<typeof dailyRecordSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type AuditChange = z.infer<typeof auditChangeSchema>;
export type NotificationJob = z.infer<typeof notificationJobSchema>;
export type BatchCompletion = z.infer<typeof batchCompletionSchema>;
export type BatchStart = z.infer<typeof batchStartSchema>;
export type BatchStatus = "running" | "ready_for_review" | "completed";
export type DataMode = "demo" | "live";
export type Scenario =
  "normal" | "stale" | "missing" | "disconnected" | "waiting";
export type Connection =
  "connecting" | "connected" | "reconnecting" | "disconnected";
