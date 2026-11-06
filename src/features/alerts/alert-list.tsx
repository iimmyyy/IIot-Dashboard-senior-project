"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useMonitor } from "@/hooks/use-monitor";
import { PageHeading, Badge, EmptyState } from "@/components/ui/shared";
import { AlertCard } from "./alert-card";
export function AlertList() {
  const { alerts } = useMonitor();
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [date, setDate] = useState("");
  const items =
    alerts.data
      ?.filter(
        (a) =>
          (status === "all" ||
            (status === "new"
              ? !a.acknowledged_at && !a.resolved_at
              : status === "acknowledged"
                ? !!a.acknowledged_at
                : !!a.resolved_at)) &&
          (severity === "all" || a.severity === severity) &&
          (!date ||
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Bangkok",
            }).format(new Date(a.detected_at)) === date),
      )
      .sort((a, b) => Date.parse(b.detected_at) - Date.parse(a.detected_at)) ??
    [];
  const count =
    alerts.data?.filter((a) => !a.acknowledged_at && !a.resolved_at).length ??
    0;
  const active = alerts.data?.filter((a) => !a.resolved_at).length ?? 0;
  return (
    <>
      <PageHeading
        title="Alerts"
      >
        <Badge tone={alerts.isError || count ? "warning" : "good"}>
          <Bell size={13} />
          {alerts.isError
            ? "Alert Status Unavailable"
            : alerts.isPending
              ? "Checking Alerts…"
              : count
                ? `${count} Awaiting Review`
                : active
                  ? "All Alerts Reviewed"
                  : "No Active Alerts"}
        </Badge>
      </PageHeading>
      <div className="card alert-filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label>
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="all">All Levels</option>
            <option value="info">Information</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label>
          Detection Date (Bangkok)
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <div className="alerts-list">
        {alerts.isError ? (
          <EmptyState
            title="Alert history unavailable"
            message="Check the connection and try again. An empty list during a connection problem does not confirm normal operation."
            retry={() => {
              void alerts.refetch();
            }}
          />
        ) : alerts.isPending ? (
          <div className="card loading-state">Loading alerts…</div>
        ) : !items.length ? (
          <div className="card">
            <EmptyState
              title="No matching alerts"
              message="There are no alerts for these filters. Change the selection to see other records."
            />
          </div>
        ) : (
          items.map((a) => <AlertCard alert={a} key={a.id} />)
        )}
      </div>
    </>
  );
}
