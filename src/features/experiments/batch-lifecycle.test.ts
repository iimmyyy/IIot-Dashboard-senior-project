import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/types";
import {
  alertBelongsToBatch,
  completeBatch,
  getBatchStatus,
  getCurrentBatchRun,
  loadBatchCompletions,
  loadBatchStarts,
  startNewBatch,
} from "./batch-lifecycle";

const researcher: SessionUser = {
  id: "USR-RES-001",
  username: "researcher",
  displayName: "Researcher Demo",
  role: "researcher",
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("machine batch lifecycle", () => {
  it("moves from running to ready when the current run passes the peak criterion", () => {
    expect(getBatchStatus([], "EXP-1", "L1", "initial", false)).toBe(
      "running",
    );
    expect(getBatchStatus([], "EXP-1", "L1", "initial", true)).toBe(
      "ready_for_review",
    );
  });

  it("allows a researcher to complete a ready batch and writes an audit event", () => {
    const storage = memoryStorage();
    const result = completeBatch(
      storage,
      "EXP-1",
      "L2",
      "initial",
      researcher,
      true,
      "2026-10-29T08:00:00Z",
    );
    expect(result.completion.status).toBe("completed");
    expect(result.audit?.action).toBe("batch.completed");
    expect(
      getBatchStatus(
        loadBatchCompletions(storage),
        "EXP-1",
        "L2",
        "initial",
        true,
      ),
    ).toBe("completed");
  });

  it("rejects completion before the peak criterion passes or by staff", () => {
    const storage = memoryStorage();
    expect(() =>
      completeBatch(storage, "EXP-1", "L1", "initial", researcher, false),
    ).toThrow("has not passed");
    expect(() =>
      completeBatch(
        storage,
        "EXP-1",
        "L1",
        "initial",
        { ...researcher, role: "staff" },
        true,
      ),
    ).toThrow("Only a researcher or professor");
  });

  it("starts a fresh running batch after completion and ignores the prior run", () => {
    const storage = memoryStorage();
    completeBatch(storage, "EXP-1", "L3", "initial", researcher, true);
    const initial = getCurrentBatchRun(
      [],
      "EXP-1",
      "L3",
      "2026-10-20T00:00:00Z",
    );
    const started = startNewBatch(
      storage,
      "EXP-1",
      "L3",
      initial,
      researcher,
      "completed",
      "2026-10-29T09:00:00Z",
    );
    const current = getCurrentBatchRun(
      started.starts,
      "EXP-1",
      "L3",
      initial.started_at,
    );
    expect(current.sequence).toBe(2);
    expect(current.started_at).toBe("2026-10-29T09:00:00Z");
    expect(
      getBatchStatus(
        loadBatchCompletions(storage),
        "EXP-1",
        "L3",
        current.id,
        false,
      ),
    ).toBe("running");
    expect(started.audit?.action).toBe("batch.started");
    expect(alertBelongsToBatch("2026-10-28T09:00:00Z", current)).toBe(false);
    expect(alertBelongsToBatch("2026-10-29T09:00:00Z", current)).toBe(true);
  });

  it("is idempotent for repeated complete and start requests", () => {
    const storage = memoryStorage();
    const first = completeBatch(
      storage,
      "EXP-1",
      "L3",
      "initial",
      researcher,
      true,
    );
    const second = completeBatch(
      storage,
      "EXP-1",
      "L3",
      "initial",
      researcher,
      true,
    );
    expect(second.completion.id).toBe(first.completion.id);
    expect(second.audit).toBeNull();

    const initial = getCurrentBatchRun(
      [],
      "EXP-1",
      "L3",
      "2026-10-20T00:00:00Z",
    );
    const firstStart = startNewBatch(
      storage,
      "EXP-1",
      "L3",
      initial,
      researcher,
      "completed",
    );
    const secondStart = startNewBatch(
      storage,
      "EXP-1",
      "L3",
      initial,
      researcher,
      "completed",
    );
    expect(secondStart.batchStart.id).toBe(firstStart.batchStart.id);
    expect(secondStart.audit).toBeNull();
    expect(loadBatchStarts(storage)).toHaveLength(1);
  });
});
