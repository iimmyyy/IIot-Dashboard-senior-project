"use client";
import { Fan, Info, Layers3 } from "lucide-react";
import { zoneValue } from "@/features/telemetry/calculations";
import { useMonitor } from "@/hooks/use-monitor";
import { positionLabels } from "@/lib/utils";
import { positions } from "@/types";
export function Chamber() {
  const { frame, now, system, mode } = useMonitor();
  const blower = system.isError
    ? "unknown"
    : (system.data?.blower_status ?? "unknown");
  return (
    <section className="card chamber-card">
      <div className="card-heading">
        <div>
          <h2>Inside the chamber</h2>
          <p>One chamber. Three measurement zones.</p>
        </div>
        <Layers3 size={19} className="muted" />
      </div>
      <div
        className="chamber-visual"
        role="img"
        aria-label={`One vertical biodrying chamber with Top, Middle and Bottom temperature sensors and one shared blower at the bottom. Blower status: ${blower}.`}
      >
        <div className="vessel">
          <div className="vessel-top" />
          <div className="vessel-body">
            {positions.map((p, i) => (
              <div className={`vessel-zone zone-${p}`} key={p}>
                <span className="zone-level">0{i + 1}</span>
                <div className="material-lines">
                  <i />
                  <i />
                  <i />
                </div>
                <span className="sensor-point" />
              </div>
            ))}
          </div>
          <div className="vessel-base" />
          <div className="vessel-pipe" />
          <div className="blower">
            <Fan size={22} />
            <span>Shared blower</span>
          </div>
          <div className="vessel-leg left" />
          <div className="vessel-leg right" />
        </div>
        <div className="chamber-labels">
          {positions.map((p) => {
            const value = zoneValue(frame, p, now ?? 0);
            return (
              <div className={`chamber-label label-${p}`} key={p}>
                <span>{positionLabels[p]}</span>
                <strong>
                  {value === null ? "—" : value.toFixed(1)}
                  <small> °C</small>
                </strong>
              </div>
            );
          })}
        </div>
      </div>
      <div className="chamber-note">
        <Info size={15} />
        <span>
          {blower === "unknown"
            ? "Blower status unavailable"
            : `Blower reported ${blower.toUpperCase()}${mode === "demo" ? " (simulated)" : ""}`}
          <small>Monitoring only · operated manually</small>
        </span>
      </div>
    </section>
  );
}
