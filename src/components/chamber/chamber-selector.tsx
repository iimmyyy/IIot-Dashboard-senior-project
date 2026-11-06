"use client";

import { useMonitor } from "@/hooks/use-monitor";
import { chambers } from "@/types";

export function ChamberSelector() {
  const { selectedChamber, setSelectedChamber } = useMonitor();
  return (
    <div
      className="overview-chamber-switch"
      role="group"
      aria-label="Prototype L1, L2, or L3 data selection"
    >
      {chambers.map((chamber) => (
        <button
          key={chamber}
          type="button"
          className={selectedChamber === chamber ? "selected" : ""}
          aria-pressed={selectedChamber === chamber}
          onClick={() => setSelectedChamber(chamber)}
        >
          {chamber}
        </button>
      ))}
    </div>
  );
}
