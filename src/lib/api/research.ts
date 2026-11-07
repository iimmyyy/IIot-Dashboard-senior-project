import { z } from "zod";
import { CSRF_COOKIE } from "@/lib/auth/constants";

const iso = z.iso.datetime({ offset: true });
const nullableNumber = z.number().finite().nullable();

export const measurementFieldKeys = [
  "temperature_top_c",
  "temperature_middle_c",
  "temperature_bottom_c",
  "temperature_core_c",
  "temperature_air_c",
  "below_peak_c",
  "bottom_slope_c_per_day",
  "drying_rate_kg_per_day",
  "eta",
  "nl_kg",
  "total_weight_kg",
  "leachate_kg",
  "height_m",
  "ar_m3_per_kg_per_day",
  "oxygen_core_percent",
  "carbon_dioxide_core_percent",
] as const;

export const measurementValuesSchema = z.object(
  Object.fromEntries(
    measurementFieldKeys.map((key) => [key, nullableNumber]),
  ) as Record<(typeof measurementFieldKeys)[number], typeof nullableNumber>,
);

export const researchExperimentSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  reactor_id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.enum(["running", "completed"]),
  start_at: iso,
  end_at: iso.nullable(),
  conditions: z.string(),
  historical_label: z.string().nullable(),
});

export const measurementRecordSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  reactor_id: z.string(),
  experiment_id: z.string(),
  record_date: z.iso.date(),
  historical_label: z.string(),
  values: measurementValuesSchema,
  status: z.enum(["draft", "submitted", "validated", "certified", "rejected"]),
  revision: z.number().int().positive(),
  created_by_id: z.string(),
  created_by_name: z.string(),
  created_at: iso,
  updated_at: iso,
  submitted_at: iso.nullable(),
  validated_at: iso.nullable(),
  certified_at: iso.nullable(),
  rejection_reason: z.string().nullable(),
});

export const actionItemSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "measurement_validation",
    "measurement_certification",
    "completion_approval",
  ]),
  title: z.string(),
  status: z.string(),
  project_id: z.string(),
  target_id: z.string(),
  occurred_at: iso,
});

export const actionHistorySchema = z.object({
  id: z.string(),
  action: z.string(),
  title: z.string(),
  status: z.string(),
  project_id: z.string(),
  experiment_id: z.string().nullable(),
  target_id: z.string(),
  occurred_at: iso,
  actor_id: z.string(),
  actor_name: z.string(),
  reviewer_name: z.string().nullable(),
});

export const persistentAuditSchema = z.object({
  id: z.string(),
  project_id: z.string().nullable(),
  actor_id: z.string().nullable(),
  action: z.string(),
  target_type: z.string(),
  target_id: z.string(),
  occurred_at: iso,
  details: z.record(z.string(), z.unknown()),
});

export const completionRequestSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  experiment_id: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  rationale: z.string(),
  requested_by_id: z.string(),
  requested_at: iso,
  reviewed_by_id: z.string().nullable(),
  reviewed_at: iso.nullable(),
  review_comment: z.string().nullable(),
});

export type MeasurementValues = z.infer<typeof measurementValuesSchema>;
export type ResearchExperiment = z.infer<typeof researchExperimentSchema>;
export type MeasurementRecord = z.infer<typeof measurementRecordSchema>;
export type ActionItem = z.infer<typeof actionItemSchema>;
export type ActionHistory = z.infer<typeof actionHistorySchema>;
export type PersistentAudit = z.infer<typeof persistentAuditSchema>;
export type CompletionRequest = z.infer<typeof completionRequestSchema>;

export const researchApiEnabled =
  process.env.NEXT_PUBLIC_RESEARCH_API_MODE === "backend";

function cookie(name: string) {
  if (typeof document === "undefined") return "";
  const prefix = `${encodeURIComponent(name)}=`;
  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) ?? ""
  );
}

async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(mutation
        ? { "X-CSRF-Token": decodeURIComponent(cookie(CSRF_COOKIE)) }
        : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(
      body?.detail ?? `The research service returned ${response.status}.`,
    );
  }
  return schema.parse(await response.json());
}

export const researchApi = {
  experiments: () =>
    apiRequest("/experiments", researchExperimentSchema.array()),
  records: (experimentId?: string) =>
    apiRequest(
      `/daily-records${experimentId ? `?${new URLSearchParams({ experiment_id: experimentId })}` : ""}`,
      measurementRecordSchema.array(),
    ),
  createRecord: (input: {
    experiment_id: string;
    record_date: string;
    historical_label: string;
    values: MeasurementValues;
    revision_reason: string;
  }) =>
    apiRequest("/daily-records", measurementRecordSchema, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateRecord: (
    id: string,
    input: { values: MeasurementValues; revision_reason: string },
  ) =>
    apiRequest(
      `/daily-records/${encodeURIComponent(id)}`,
      measurementRecordSchema,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    ),
  transition: (
    id: string,
    action: "submit" | "validate" | "certify" | "reject",
    comment?: string,
  ) =>
    apiRequest(
      `/measurements/${encodeURIComponent(id)}/${action}`,
      measurementRecordSchema,
      { method: "POST", body: JSON.stringify({ comment: comment || null }) },
    ),
  pendingActions: () =>
    apiRequest("/actions/pending", actionItemSchema.array()),
  actionHistory: () => apiRequest("/actions/mine", actionHistorySchema.array()),
  audit: (input?: { projectId?: string; experimentId?: string }) => {
    const query = new URLSearchParams();
    if (input?.projectId) query.set("project_id", input.projectId);
    if (input?.experimentId) query.set("experiment_id", input.experimentId);
    return apiRequest(
      `/audit-events${query.size ? `?${query}` : ""}`,
      persistentAuditSchema.array(),
    );
  },
  requestCompletion: (experimentId: string, rationale: string) =>
    apiRequest(
      `/experiments/${encodeURIComponent(experimentId)}/completion-requests`,
      completionRequestSchema,
      { method: "POST", body: JSON.stringify({ rationale }) },
    ),
  approvals: () => apiRequest("/approvals", completionRequestSchema.array()),
  reviewCompletion: (
    id: string,
    decision: "approve" | "reject",
    comment: string,
  ) =>
    apiRequest(
      `/approvals/${encodeURIComponent(id)}/${decision}`,
      completionRequestSchema,
      {
        method: "POST",
        body: JSON.stringify({ comment }),
      },
    ),
};
