import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/types";
import type { DailyRecordInput } from "@/types";
import {
  AUDIT_LOG_KEY,
  DAILY_RECORDS_KEY,
  loadAuditLog,
  loadDailyRecords,
  saveDailyRecord,
  upsertDailyRecord,
} from "./model";

const researcher: SessionUser = {
  id: "USR-RES-001",
  username: "researcher",
  displayName: "Researcher Demo",
  role: "researcher",
};
const professor: SessionUser = { ...researcher, id: "USR-PROF-001", role: "professor" };
const input: DailyRecordInput = {
  experiment_id: "BD-2026-008",
  record_date: "2026-10-29",
  chamber_id: "L1",
  temperature_top_c: 54,
  temperature_middle_c: 56,
  temperature_bottom_c: 52,
  temperature_core_c: 58,
  temperature_air_c: 31,
  below_peak_c: 4,
  bottom_slope_c_per_day: -0.8,
  drying_rate_kg_per_day: 12,
  eta: 0.72,
  nl_kg: 4.3,
  total_weight_kg: 420,
  leachate_kg: 3.2,
  height_m: 1.8,
  ar_m3_per_kg_per_day: 0.45,
  oxygen_core_percent: 16.2,
  carbon_dioxide_core_percent: 4.8,
};

describe("daily record service", () => {
  it("allows researchers to create one chamber record and writes an audit event", () => {
    const result = upsertDailyRecord([], input, researcher, "2026-10-29T02:00:00Z");
    expect(result.records).toHaveLength(1);
    expect(result.audit.action).toBe("daily_record.created");
    expect(result.audit.actor_role).toBe("researcher");
    expect(result.audit.changes.length).toBeGreaterThan(10);
  });

  it("updates the same experiment, date and chamber without creating a duplicate", () => {
    const created = upsertDailyRecord([], input, researcher);
    const updated = upsertDailyRecord(
      created.records,
      { ...input, total_weight_kg: 410 },
      researcher,
    );
    expect(updated.records).toHaveLength(1);
    expect(updated.record.id).toBe(created.record.id);
    expect(updated.audit.action).toBe("daily_record.updated");
    expect(updated.audit.changes).toEqual([
      { field: "total_weight_kg", before: "420", after: "410" },
    ]);
  });

  it("prevents professor and staff roles from writing", () => {
    expect(() => upsertDailyRecord([], input, professor)).toThrow(
      "Only researchers",
    );
    expect(() =>
      upsertDailyRecord([], input, { ...professor, role: "staff" }),
    ).toThrow("Only researchers");
  });

  it("persists records and audit events together", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    saveDailyRecord(storage, input, researcher);
    expect(values.has(DAILY_RECORDS_KEY)).toBe(true);
    expect(values.has(AUDIT_LOG_KEY)).toBe(true);
    expect(loadDailyRecords(storage)[0].chamber_id).toBe("L1");
    expect(loadAuditLog(storage)[0].target_type).toBe("daily_record");
  });
});
