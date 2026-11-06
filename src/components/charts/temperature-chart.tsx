"use client";
import { useEffect, useMemo, useRef } from "react";
import { init, use as registerECharts } from "echarts/core";
import { LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { dateTime, positionLabels, sensorColors, timeOnly } from "@/lib/utils";
import { zoneValue } from "@/features/telemetry/calculations";
import { isGraphAlert } from "@/features/alerts/graph-alerts";
import {
  positions,
  type Position,
  type ResearchAlert,
  type Telemetry,
} from "@/types";
registerECharts([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
  CanvasRenderer,
]);

export default function TemperatureChart({
  history,
  alerts = [],
  large = false,
  visible = [...positions],
}: {
  history: Telemetry[];
  alerts?: ResearchAlert[];
  large?: boolean;
  visible?: Position[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartInput = useMemo(
    () => ({ alerts, history, large }),
    [alerts, history, large],
  );
  useEffect(() => {
    if (!ref.current) return;
    const { alerts, history, large } = chartInput;
    const chart = init(ref.current, undefined, { renderer: "canvas" });
    // Explicit null points keep interrupted sampling visible, including absent frames.
    const deltas = history
      .slice(1)
      .map((f, i) => Date.parse(f.timestamp) - Date.parse(history[i].timestamp))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    const cadence = deltas.length
      ? Math.min(deltas[Math.floor(deltas.length / 2)], 3600000)
      : 3600000;
    const display: (
      | Telemetry
      | {
          timestamp: string;
          readings: [];
          experiment_id: string;
          chamber_id: string;
        }
    )[] = [];
    history.forEach((frame, i) => {
      if (
        i &&
        Date.parse(frame.timestamp) - Date.parse(history[i - 1].timestamp) >
          cadence * 1.5
      )
        display.push({
          ...frame,
          timestamp: new Date(
            Date.parse(history[i - 1].timestamp) + cadence,
          ).toISOString(),
          readings: [],
        });
      display.push(frame);
    });
    const alertColors: Record<ResearchAlert["severity"], string> = {
      info: "#5f8fa2",
      warning: "#c18a32",
      critical: "#c45e5e",
    };
    const alertPoints = alerts
      .filter(isGraphAlert)
      .flatMap((alert) => {
      const detectedAt = Date.parse(alert.detected_at);
      if (!Number.isFinite(detectedAt) || !history.length) return [];
      const closest = history.reduce((best, frame) =>
        Math.abs(Date.parse(frame.timestamp) - detectedAt) <
        Math.abs(Date.parse(best.timestamp) - detectedAt)
          ? frame
          : best,
      );
      const temperatures = positions
        .map((position) => zoneValue(closest, position, 0, true))
        .filter((value): value is number => value !== null);
      if (!temperatures.length) return [];
      return [
        {
          value: [
            detectedAt,
            temperatures.reduce((sum, value) => sum + value, 0) /
              temperatures.length,
          ],
          alert,
          itemStyle: {
            color: alertColors[alert.severity],
            borderColor: "#fff",
            borderWidth: 2,
          },
        },
      ];
      });
    chart.setOption({
      animation: false,
      color: positions.map((p) => sensorColors[p]),
      aria: {
        enabled: true,
        label: {
          description:
            "Temperature history for the top, middle and bottom of the selected machine in degrees Celsius. Times are in Bangkok. Gaps indicate missing measurements. Use the legend to show or hide a zone.",
        },
      },
      textStyle: { fontFamily: "Arial, sans-serif", color: "#74818b" },
      grid: { top: 30, right: 18, bottom: 67, left: 48 },
      legend: { show: false },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#fff",
        borderColor: "#e3e9eb",
        padding: 12,
        textStyle: { color: "#23353d", fontSize: 12 },
        axisPointer: { lineStyle: { color: "#a7bdc2", type: "dashed" } },
        formatter: (input: unknown) => {
          const rows = input as {
            seriesName: string;
            value: [number, number | null];
            color: string;
          }[];
          if (!rows.length) return "No measurements";
          return `<strong>${dateTime(rows[0].value[0])} ICT</strong><br/>${rows.map((row) => `<span style="color:${row.color}">●</span> ${row.seriesName}: ${row.value[1] == null ? "Unavailable" : `${Number(row.value[1]).toFixed(1)} °C`}`).join("<br/>")}`;
        },
      },
      xAxis: {
        type: "time",
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#e8edef" } },
        axisTick: { show: false },
        splitNumber: 5,
        axisLabel: {
          color: "#7b8992",
          margin: 16,
          hideOverlap: true,
          formatter: (value: number) =>
            history.length &&
            Date.parse(history.at(-1)!.timestamp) -
              Date.parse(history[0].timestamp) >
              2 * 86400000
              ? dateTime(value, {
                  year: undefined,
                  hour: undefined,
                  minute: undefined,
                })
              : timeOnly(value),
        },
        axisPointer: {
          label: {
            formatter: (data: { value: number }) =>
              `${dateTime(data.value)} ICT`,
          },
        },
      },
      yAxis: {
        type: "value",
        name: "°C",
        nameTextStyle: { color: "#839097", align: "right" },
        min: (v: { min: number }) => Math.floor((v.min - 5) / 10) * 10,
        max: (v: { max: number }) => Math.ceil((v.max + 5) / 10) * 10,
        splitLine: { lineStyle: { color: "#edf1f2", type: "dashed" } },
        axisLabel: { color: "#7b8992" },
      },
      dataZoom: [
        { type: "inside", filterMode: "none" },
        {
          type: "slider",
          height: 12,
          bottom: 31,
          borderColor: "transparent",
          backgroundColor: "#f2f6f6",
          fillerColor: "#dce9e9",
          handleStyle: { color: "#8caeaf" },
          showDetail: false,
          brushSelect: false,
        },
      ],
      series: [
        ...visible.map((p) => ({
          name: positionLabels[p],
          type: "line",
          showSymbol: false,
          connectNulls: false,
          smooth: false,
          itemStyle: { color: sensorColors[p] },
          lineStyle: { width: 2.5, color: sensorColors[p] },
          emphasis: { focus: "series" },
          data: display.map((f) => [
            Date.parse(f.timestamp),
            zoneValue(f, p, 0, true),
          ]),
        })),
        ...(alertPoints.length
          ? [
              {
                name: "Alerts",
                type: "scatter",
                symbol: "diamond",
                symbolSize: large ? 15 : 13,
                z: 20,
                data: alertPoints,
                emphasis: { scale: 1.35 },
                tooltip: {
                  trigger: "item",
                  formatter: (input: unknown) => {
                    const point = input as {
                      data: { alert: ResearchAlert };
                    };
                    const alert = point.data.alert;
                    return `<strong>${alert.title}</strong><br/><span style="color:${alertColors[alert.severity]}">●</span> ${alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)} · ${dateTime(alert.detected_at)} ICT`;
                  },
                },
              },
            ]
          : []),
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [chartInput, visible]);
  return (
    <div
      ref={ref}
      className={`temperature-chart ${large ? "chart-large" : ""}`}
      role="img"
      aria-label={`Temperature history in Celsius with ${alerts.length} alert marker${alerts.length === 1 ? "" : "s"}. Use the labeled sensor toggles to show or hide zones. Missing readings appear as gaps.`}
    />
  );
}
