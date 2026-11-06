"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCurrentBatchRun,
  loadBatchStarts,
} from "@/features/experiments/batch-lifecycle";
import { useMonitor } from "@/hooks/use-monitor";
import type { BatchStart } from "@/types";

export const BATCH_CHANGED_EVENT = "biodry:batch-changed";

export function useCurrentBatchRun() {
  const { currentExperiment, selectedChamber } = useMonitor();
  const [starts, setStarts] = useState<BatchStart[]>([]);

  useEffect(() => {
    const load = () => setStarts(loadBatchStarts(localStorage));
    const frame = requestAnimationFrame(load);
    window.addEventListener(BATCH_CHANGED_EVENT, load);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(BATCH_CHANGED_EVENT, load);
    };
  }, []);

  return useMemo(
    () =>
      getCurrentBatchRun(
        starts,
        currentExperiment?.id ?? "",
        selectedChamber,
        currentExperiment?.start_date ?? new Date(0).toISOString(),
      ),
    [currentExperiment?.id, currentExperiment?.start_date, selectedChamber, starts],
  );
}
