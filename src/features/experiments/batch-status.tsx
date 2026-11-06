"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  Flag,
  Play,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/shared";
import { useCurrentUser } from "@/features/auth/auth-context";
import {
  alertBelongsToBatch,
  canCompleteBatch,
  completeBatch,
  getBatchStatus,
  getCurrentBatchRun,
  loadBatchCompletions,
  loadBatchStarts,
  startNewBatch,
} from "@/features/experiments/batch-lifecycle";
import { useMonitor } from "@/hooks/use-monitor";
import { dateTime } from "@/lib/utils";
import type { BatchCompletion, BatchStart } from "@/types";
import { BATCH_CHANGED_EVENT } from "@/features/experiments/use-current-batch-run";

type BatchDialog = "complete" | "start" | null;

export function BatchStatusCard() {
  const user = useCurrentUser();
  const { alerts, currentExperiment, mode, selectedChamber } = useMonitor();
  const [completions, setCompletions] = useState<BatchCompletion[]>([]);
  const [starts, setStarts] = useState<BatchStart[]>([]);
  const [dialog, setDialog] = useState<BatchDialog>(null);
  const [error, setError] = useState("");
  const experimentId = currentExperiment?.id ?? "";
  const currentRun = useMemo(
    () =>
      getCurrentBatchRun(
        starts,
        experimentId,
        selectedChamber,
        currentExperiment?.start_date ?? new Date(0).toISOString(),
      ),
    [currentExperiment?.start_date, experimentId, selectedChamber, starts],
  );
  const peakAlert = alerts.data?.find(
    (alert) =>
      alert.kind === "temperature_peak" &&
      alert.experiment_id === experimentId &&
      alert.chamber_id === selectedChamber &&
      alertBelongsToBatch(alert.detected_at, currentRun),
  );
  const peakPassed = !!peakAlert;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCompletions(loadBatchCompletions(localStorage));
      setStarts(loadBatchStarts(localStorage));
    });
    return () => cancelAnimationFrame(frame);
  }, [experimentId, selectedChamber]);

  useEffect(() => {
    if (!dialog) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [dialog]);

  const status = useMemo(
    () =>
      getBatchStatus(
        completions,
        experimentId,
        selectedChamber,
        currentRun.id,
        peakPassed,
      ),
    [
      completions,
      currentRun.id,
      experimentId,
      peakPassed,
      selectedChamber,
    ],
  );
  const completion = completions.find(
    (item) =>
      item.experiment_id === experimentId &&
      item.chamber_id === selectedChamber &&
      item.batch_run_id === currentRun.id,
  );
  const Icon =
    status === "completed"
      ? CheckCircle2
      : status === "ready_for_review"
        ? Flag
        : CircleDot;
  const label =
    status === "completed"
      ? "Completed"
      : status === "ready_for_review"
        ? "Ready for review"
        : "Running";

  function finish() {
    setError("");
    if (!currentExperiment) return;
    if (mode !== "demo") {
      setError("Live batch completion is not connected yet.");
      setDialog(null);
      return;
    }
    try {
      const result = completeBatch(
        localStorage,
        currentExperiment.id,
        selectedChamber,
        currentRun.id,
        user,
        peakPassed,
      );
      setCompletions(result.completions);
      setDialog(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The batch could not be completed.",
      );
      setDialog(null);
    }
  }

  function beginNewBatch() {
    setError("");
    if (!currentExperiment) return;
    if (mode !== "demo") {
      setError("Live batch creation is not connected yet.");
      setDialog(null);
      return;
    }
    try {
      const result = startNewBatch(
        localStorage,
        currentExperiment.id,
        selectedChamber,
        currentRun,
        user,
        status,
      );
      setStarts(result.starts);
      window.dispatchEvent(new Event(BATCH_CHANGED_EVENT));
      setDialog(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "A new batch could not be started.",
      );
      setDialog(null);
    }
  }

  if (!currentExperiment) return null;
  return (
    <>
      <section className={`batch-status-card batch-${status}`}>
        <div className="batch-status-icon"><Icon size={19} /></div>
        <div className="batch-status-copy">
          <span>Batch {currentRun.sequence} · {selectedChamber}</span>
          <div>
            <strong>{label}</strong>
            <Badge
              tone={
                status === "completed"
                  ? "good"
                  : status === "ready_for_review"
                    ? "warning"
                    : "neutral"
              }
            >
              {label}
            </Badge>
          </div>
          <p>
            {status === "running"
              ? `Started ${dateTime(currentRun.started_at)} ICT · monitoring the polynomial peak criterion.`
              : status === "ready_for_review"
                ? "Temperature peak passed. Review the measurements before completion."
                : `Completed by ${completion?.completed_by_name ?? "Researcher"} · ${completion ? `${dateTime(completion.completed_at)} ICT` : ""}`}
          </p>
          {error && <p className="error-text" role="alert">{error}</p>}
        </div>
        {status === "ready_for_review" && canCompleteBatch(user) && (
          <Button size="sm" onClick={() => setDialog("complete")}>
            Complete batch
          </Button>
        )}
        {status === "completed" && canCompleteBatch(user) && (
          <Button size="sm" onClick={() => setDialog("start")}>
            <Play size={14} /> Start new batch
          </Button>
        )}
      </section>

      {dialog && (
        <div
          className="batch-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
        >
          <section
            className="batch-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-modal-title"
          >
            <div className="batch-modal-heading">
              <div className="batch-modal-icon">
                {dialog === "complete" ? <Flag size={20} /> : <Play size={20} />}
              </div>
              <div>
                <span>{selectedChamber} · Batch {currentRun.sequence}</span>
                <h2 id="batch-modal-title">
                  {dialog === "complete" ? "Complete this batch?" : "Start a new batch?"}
                </h2>
              </div>
              <button
                type="button"
                className="batch-modal-close"
                aria-label="Close"
                onClick={() => setDialog(null)}
              >
                <X size={18} />
              </button>
            </div>

            {dialog === "complete" ? (
              <>
                <p>
                  The polynomial temperature peak criterion has passed. Confirm
                  only after reviewing the measurements for this machine.
                </p>
                <dl className="batch-modal-summary">
                  <div><dt>Machine</dt><dd>{selectedChamber}</dd></div>
                  <div><dt>Criterion</dt><dd>Temperature peak passed</dd></div>
                  <div><dt>Confirmed by</dt><dd>{user.displayName}</dd></div>
                </dl>
                <p className="batch-modal-note">
                  Completion is recorded in the audit log. It does not control
                  physical equipment.
                </p>
              </>
            ) : (
              <>
                <p>
                  A new monitoring cycle will begin for {selectedChamber}. Peak
                  alerts from Batch {currentRun.sequence} will not carry over.
                </p>
                <dl className="batch-modal-summary">
                  <div><dt>New batch</dt><dd>Batch {currentRun.sequence + 1}</dd></div>
                  <div><dt>Machine</dt><dd>{selectedChamber}</dd></div>
                  <div><dt>Started by</dt><dd>{user.displayName}</dd></div>
                </dl>
              </>
            )}

            <div className="batch-modal-actions">
              <Button variant="ghost" onClick={() => setDialog(null)} autoFocus>
                Cancel
              </Button>
              <Button
                onClick={dialog === "complete" ? finish : beginNewBatch}
              >
                {dialog === "complete" ? "Confirm completion" : "Start batch"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
