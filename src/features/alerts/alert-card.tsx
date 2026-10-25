"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Info } from "lucide-react";
import { api } from "@/lib/api/client";
import { dateTime } from "@/lib/utils";
import type { ResearchAlert } from "@/types";
import { Badge, Details } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";

export function AlertCard({
  alert,
  compact = false,
}: {
  alert: ResearchAlert;
  compact?: boolean;
}) {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.acknowledge(alert, name.trim()),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["alerts"] });
      setConfirming(false);
    },
  });
  const Icon = alert.severity === "info" ? Info : AlertTriangle;
  return (
    <article
      className={`alert-card severity-${alert.severity} ${compact ? "compact-alert" : ""}`}
    >
      <div className="alert-icon">
        <Icon size={20} />
      </div>
      <div className="alert-body">
        <div className="alert-title-row">
          <h3>{alert.title}</h3>
          <Badge
            tone={
              alert.severity === "critical"
                ? "danger"
                : alert.severity === "warning"
                  ? "warning"
                  : "neutral"
            }
          >
            {alert.severity === "critical"
              ? "Urgent Review"
              : alert.severity === "warning"
                ? "Review Recommended"
                : "Information"}
          </Badge>
        </div>
        <p>{alert.description}</p>
        <div className="alert-action">
          <strong>Next step</strong>
          <span>{alert.action}</span>
        </div>
        <div className="alert-meta">
          <span>{dateTime(alert.detected_at)} ICT</span>
          <span>{alert.experiment_id}</span>
          {alert.resolved_at && (
            <Badge tone="good">
              <Check size={12} />
              Resolved
            </Badge>
          )}
        </div>
        <Details title="View Details" open={compact ? undefined : false}>
          <div className="supporting-values">
            {alert.supporting_values.map((v) => (
              <div key={v.label}>
                <span>{v.label}</span>
                <strong>{v.value}</strong>
              </div>
            ))}
          </div>
          <p>
            Meeting Criterion T alone does not mean that the full stopping
            criteria have been satisfied. Drying rate and air utilization also
            need to be assessed by the research team.
          </p>
          {alert.resolved_at && (
            <p>Resolved: {dateTime(alert.resolved_at)} ICT</p>
          )}
        </Details>
        {alert.acknowledged_at ? (
          <p className="acknowledged">
            <Check size={14} />
            Acknowledged by {alert.acknowledged_by ?? "Researcher"} ·{" "}
            {dateTime(alert.acknowledged_at)} ICT
          </p>
        ) : confirming ? (
          <form
            className="ack-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) mutation.mutate();
            }}
          >
            <p>
              Acknowledging records that you have read this alert. It does not
              resolve the underlying issue.
            </p>
            <label>
              Your name
              <input
                value={name}
                maxLength={100}
                required
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoFocus
              />
            </label>
            <div className="button-row">
              <Button
                type="submit"
                size="sm"
                disabled={mutation.isPending || !name.trim()}
              >
                {mutation.isPending ? "Saving…" : "Confirm Acknowledgement"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
            {mutation.isError && (
              <p role="alert" className="error-text">
                Acknowledgement could not be saved. Check your connection and
                try again.
              </p>
            )}
          </form>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirming(true)}
          >
            <Check size={14} />
            Acknowledge
          </Button>
        )}
      </div>
    </article>
  );
}
