import type { ResearchAlert } from "@/types";

export function isGraphAlert(alert: ResearchAlert) {
  return alert.kind === "temperature_peak";
}
