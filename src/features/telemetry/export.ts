import type { DataMode, Telemetry } from "@/types";
import { dateTime } from "@/lib/utils";

function csvCell(value: string | number) {
  // Quoting alone does not prevent spreadsheet applications evaluating formulas.
  const safe =
    typeof value === "string" && /^[=+@\-\t\r]/.test(value)
      ? `'${value}`
      : String(value);
  return `"${safe.replaceAll('"', '""')}"`;
}
export function telemetryCsv(frames: Telemetry[], mode: DataMode) {
  const header =
    "timestamp_utc,timestamp_bangkok,frame_timestamp_utc,experiment_id,sensor_id,position,temperature_c,quality,data_mode";
  return [
    header,
    ...frames.flatMap((frame) =>
      frame.readings.map((reading) =>
        [
          reading.timestamp ?? frame.timestamp,
          dateTime(reading.timestamp ?? frame.timestamp),
          frame.timestamp,
          frame.experiment_id,
          reading.sensor_id,
          reading.position,
          reading.temperature_c ?? "",
          reading.quality,
          mode,
        ]
          .map(csvCell)
          .join(","),
      ),
    ),
  ].join("\r\n");
}
