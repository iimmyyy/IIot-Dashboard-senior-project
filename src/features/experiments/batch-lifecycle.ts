import type { SessionUser } from "@/lib/auth/types";
import { appendBrowserAuditLog } from "@/lib/audit/browser";
import {
  auditLogSchema,
  batchCompletionSchema,
  batchStartSchema,
  type BatchCompletion,
  type BatchStart,
  type BatchStatus,
  type Chamber,
} from "@/types";

export const BATCH_COMPLETIONS_KEY = "biodry-batch-completions-v1";
export const BATCH_STARTS_KEY = "biodry-batch-starts-v1";

export type CurrentBatchRun = {
  id: string;
  sequence: number;
  started_at: string;
};

export function alertBelongsToBatch(
  detectedAt: string,
  batchRun: CurrentBatchRun,
) {
  return Date.parse(detectedAt) >= Date.parse(batchRun.started_at);
}

export function canCompleteBatch(user: SessionUser) {
  return user.role === "researcher" || user.role === "professor";
}

export function loadBatchCompletions(
  storage: Pick<Storage, "getItem">,
): BatchCompletion[] {
  try {
    return batchCompletionSchema.array().parse(
      JSON.parse(storage.getItem(BATCH_COMPLETIONS_KEY) ?? "[]"),
    );
  } catch {
    return [];
  }
}

export function loadBatchStarts(
  storage: Pick<Storage, "getItem">,
): BatchStart[] {
  try {
    return batchStartSchema.array().parse(
      JSON.parse(storage.getItem(BATCH_STARTS_KEY) ?? "[]"),
    );
  } catch {
    return [];
  }
}

export function getCurrentBatchRun(
  starts: BatchStart[],
  experimentId: string,
  chamberId: Chamber,
  experimentStartedAt: string,
): CurrentBatchRun {
  const latest = starts
    .filter(
      (item) =>
        item.experiment_id === experimentId && item.chamber_id === chamberId,
    )
    .sort((a, b) => b.sequence - a.sequence)[0];
  return latest
    ? { id: latest.id, sequence: latest.sequence, started_at: latest.started_at }
    : { id: "initial", sequence: 1, started_at: experimentStartedAt };
}

export function getBatchStatus(
  completions: BatchCompletion[],
  experimentId: string,
  chamberId: Chamber,
  batchRunId: string,
  temperaturePeakPassed: boolean,
): BatchStatus {
  if (
    completions.some(
      (item) =>
        item.experiment_id === experimentId &&
        item.chamber_id === chamberId &&
        item.batch_run_id === batchRunId,
    )
  )
    return "completed";
  return temperaturePeakPassed ? "ready_for_review" : "running";
}

export function completeBatch(
  storage: Pick<Storage, "getItem" | "setItem">,
  experimentId: string,
  chamberId: Chamber,
  batchRunId: string,
  actor: SessionUser,
  temperaturePeakPassed: boolean,
  now = new Date().toISOString(),
) {
  if (!canCompleteBatch(actor))
    throw new Error("Only a researcher or professor can complete a batch.");
  if (!temperaturePeakPassed)
    throw new Error("The temperature peak criterion has not passed yet.");
  const current = loadBatchCompletions(storage);
  const existing = current.find(
    (item) =>
      item.experiment_id === experimentId &&
      item.chamber_id === chamberId &&
      item.batch_run_id === batchRunId,
  );
  if (existing) return { completion: existing, completions: current, audit: null };

  const completion = batchCompletionSchema.parse({
    id: `BAT-${crypto.randomUUID()}`,
    experiment_id: experimentId,
    chamber_id: chamberId,
    batch_run_id: batchRunId,
    status: "completed",
    completion_basis: "temperature_peak_passed",
    completed_at: now,
    completed_by_id: actor.id,
    completed_by_name: actor.displayName,
  });
  const completions = [completion, ...current];
  storage.setItem(BATCH_COMPLETIONS_KEY, JSON.stringify(completions));
  const audit = auditLogSchema.parse({
    id: `AUD-${crypto.randomUUID()}`,
    occurred_at: now,
    action: "batch.completed",
    actor_id: actor.id,
    actor_name: actor.displayName,
    actor_role: actor.role,
    target_type: "batch",
    target_id: completion.id,
    changes: [
      { field: "status", before: "ready_for_review", after: "completed" },
      {
        field: "completion_basis",
        before: null,
        after: "temperature_peak_passed",
      },
    ],
  });
  appendBrowserAuditLog(storage, audit);
  return { completion, completions, audit };
}

export function startNewBatch(
  storage: Pick<Storage, "getItem" | "setItem">,
  experimentId: string,
  chamberId: Chamber,
  currentRun: CurrentBatchRun,
  actor: SessionUser,
  currentStatus: BatchStatus,
  now = new Date().toISOString(),
) {
  if (!canCompleteBatch(actor))
    throw new Error("Only a researcher or professor can start a new batch.");
  if (currentStatus !== "completed")
    throw new Error("Complete the current batch before starting a new one.");
  const current = loadBatchStarts(storage);
  const existingNext = current.find(
    (item) =>
      item.experiment_id === experimentId &&
      item.chamber_id === chamberId &&
      item.sequence === currentRun.sequence + 1,
  );
  if (existingNext)
    return { batchStart: existingNext, starts: current, audit: null };

  const batchStart = batchStartSchema.parse({
    id: `RUN-${crypto.randomUUID()}`,
    experiment_id: experimentId,
    chamber_id: chamberId,
    sequence: currentRun.sequence + 1,
    started_at: now,
    started_by_id: actor.id,
    started_by_name: actor.displayName,
  });
  const starts = [batchStart, ...current];
  storage.setItem(BATCH_STARTS_KEY, JSON.stringify(starts));
  const audit = auditLogSchema.parse({
    id: `AUD-${crypto.randomUUID()}`,
    occurred_at: now,
    action: "batch.started",
    actor_id: actor.id,
    actor_name: actor.displayName,
    actor_role: actor.role,
    target_type: "batch",
    target_id: batchStart.id,
    changes: [
      { field: "batch_run_id", before: currentRun.id, after: batchStart.id },
      { field: "status", before: "completed", after: "running" },
    ],
  });
  appendBrowserAuditLog(storage, audit);
  return { batchStart, starts, audit };
}
