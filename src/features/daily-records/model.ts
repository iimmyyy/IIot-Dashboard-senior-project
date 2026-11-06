import type { SessionUser } from "@/lib/auth/types";
import {
  appendBrowserAuditLog,
  AUDIT_LOG_KEY,
  loadBrowserAuditLog,
} from "@/lib/audit/browser";
import {
  auditLogSchema,
  dailyRecordInputSchema,
  dailyRecordSchema,
  type AuditChange,
  type AuditLog,
  type DailyRecord,
  type DailyRecordInput,
} from "@/types";

export const DAILY_RECORDS_KEY = "biodry-daily-records-v1";
export { AUDIT_LOG_KEY };

export const dailyFieldDefinitions = [
  { key: "temperature_top_c", label: "T Top", unit: "°C", group: "Temperature" },
  { key: "temperature_middle_c", label: "T Middle", unit: "°C", group: "Temperature" },
  { key: "temperature_bottom_c", label: "T Bottom", unit: "°C", group: "Temperature" },
  { key: "temperature_core_c", label: "T Core", unit: "°C", group: "Temperature" },
  { key: "temperature_air_c", label: "T Air", unit: "°C", group: "Temperature" },
  { key: "below_peak_c", label: "Below Peak", unit: "°C", group: "Temperature" },
  { key: "bottom_slope_c_per_day", label: "Bottom Slope", unit: "°C/d", group: "Temperature" },
  { key: "drying_rate_kg_per_day", label: "Drying Rate", unit: "kg/d", group: "Process" },
  { key: "eta", label: "η", unit: "", group: "Process" },
  { key: "nl_kg", label: "NL", unit: "kg", group: "Process" },
  { key: "total_weight_kg", label: "Total Weight", unit: "kg", group: "Process" },
  { key: "leachate_kg", label: "Leachate", unit: "kg", group: "Process" },
  { key: "height_m", label: "Height", unit: "m", group: "Process" },
  { key: "ar_m3_per_kg_per_day", label: "AR", unit: "m³/kg/d", group: "Process" },
  { key: "oxygen_core_percent", label: "Core O₂", unit: "%", group: "Gas" },
  { key: "carbon_dioxide_core_percent", label: "Core CO₂", unit: "%", group: "Gas" },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<DailyRecordInput, "experiment_id" | "record_date" | "chamber_id">;
  label: string;
  unit: string;
  group: "Temperature" | "Process" | "Gas";
}>;

export type DailyNumericField = (typeof dailyFieldDefinitions)[number]["key"];

export function canEditDailyRecords(user: SessionUser) {
  return user.role === "researcher";
}

export function parseDailyRecordForm(
  base: Pick<DailyRecordInput, "experiment_id" | "record_date" | "chamber_id">,
  values: Record<DailyNumericField, string>,
) {
  return dailyRecordInputSchema.safeParse({
    ...base,
    ...Object.fromEntries(
      dailyFieldDefinitions.map(({ key }) => [key, Number(values[key])]),
    ),
  });
}

function recordKey(record: Pick<DailyRecordInput, "experiment_id" | "record_date" | "chamber_id">) {
  return `${record.experiment_id}:${record.record_date}:${record.chamber_id}`;
}

function changesBetween(
  previous: DailyRecord | undefined,
  next: DailyRecordInput,
): AuditChange[] {
  const keys = [
    "experiment_id",
    "record_date",
    "chamber_id",
    ...dailyFieldDefinitions.map(({ key }) => key),
  ] as const;
  return keys.flatMap((field) => {
    const before = previous ? String(previous[field]) : null;
    const after = String(next[field]);
    return before === after ? [] : [{ field, before, after }];
  });
}

export function upsertDailyRecord(
  existing: DailyRecord[],
  input: DailyRecordInput,
  actor: SessionUser,
  now = new Date().toISOString(),
): { records: DailyRecord[]; audit: AuditLog; record: DailyRecord } {
  if (!canEditDailyRecords(actor))
    throw new Error("Only researchers can add or edit daily records.");
  const parsed = dailyRecordInputSchema.parse(input);
  const previous = existing.find((item) => recordKey(item) === recordKey(parsed));
  const record = dailyRecordSchema.parse({
    ...parsed,
    id: previous?.id ?? `DR-${crypto.randomUUID()}`,
    created_at: previous?.created_at ?? now,
    updated_at: now,
    entered_by_id: actor.id,
    entered_by_name: actor.displayName,
  });
  const records = [
    ...existing.filter((item) => recordKey(item) !== recordKey(parsed)),
    record,
  ].sort((a, b) =>
    `${b.record_date}:${b.chamber_id}`.localeCompare(
      `${a.record_date}:${a.chamber_id}`,
    ),
  );
  const audit = auditLogSchema.parse({
    id: `AUD-${crypto.randomUUID()}`,
    occurred_at: now,
    action: previous ? "daily_record.updated" : "daily_record.created",
    actor_id: actor.id,
    actor_name: actor.displayName,
    actor_role: actor.role,
    target_type: "daily_record",
    target_id: record.id,
    changes: changesBetween(previous, parsed),
  });
  return { records, audit, record };
}

export function loadDailyRecords(storage: Pick<Storage, "getItem">): DailyRecord[] {
  try {
    return dailyRecordSchema.array().parse(
      JSON.parse(storage.getItem(DAILY_RECORDS_KEY) ?? "[]"),
    );
  } catch {
    return [];
  }
}

export function loadAuditLog(storage: Pick<Storage, "getItem">): AuditLog[] {
  return loadBrowserAuditLog(storage);
}

export function saveDailyRecord(
  storage: Pick<Storage, "getItem" | "setItem">,
  input: DailyRecordInput,
  actor: SessionUser,
  now?: string,
) {
  const result = upsertDailyRecord(loadDailyRecords(storage), input, actor, now);
  storage.setItem(DAILY_RECORDS_KEY, JSON.stringify(result.records));
  const audit = appendBrowserAuditLog(storage, result.audit);
  return { ...result, auditLog: audit };
}
