"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, FlaskConical, Search } from "lucide-react";
import { useMonitor } from "@/hooks/use-monitor";
import { dateTime, duration, positionLabels } from "@/lib/utils";
import { Badge, EmptyState, PageHeading } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
export function ExperimentList() {
  const { experiments, now } = useMonitor();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const items =
    experiments.data?.filter(
      (e) =>
        `${e.name} ${e.id}`.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" || e.status === filter),
    ) ?? [];
  return (
    <>
      <PageHeading
        title="Experiment History"
      >
        <Badge tone="teal">
          <FlaskConical size={13} />
          {experiments.data?.length ?? 0} Experiments
        </Badge>
      </PageHeading>
      <div className="card history-card">
        <div className="list-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search experiments"
              placeholder="Search by experiment name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="inline-select">
            Status
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Experiments</option>
              <option value="running">Current Run</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
        {experiments.isError ? (
          <EmptyState
            title="Experiments unavailable"
            message="We could not load the experiment list. Check the connection and try again."
            retry={() => {
              void experiments.refetch();
            }}
          />
        ) : experiments.isPending ? (
          <div className="loading-state">Loading experiments…</div>
        ) : !items.length ? (
          <EmptyState
            title="No experiments found"
            message="Try another name or change the status filter."
          />
        ) : (
          <div className="experiment-list">
            {items.map((exp) => (
              <article className="experiment-row" key={exp.id}>
                <span className="experiment-row-icon">
                  <FlaskConical size={23} />
                </span>
                <div className="experiment-row-body">
                  <div className="experiment-row-heading">
                    <span className="overline">{exp.id}</span>
                    <Badge tone={exp.status === "running" ? "good" : "neutral"}>
                      {exp.status === "running" ? (
                        <span className="dot good-dot" />
                      ) : (
                        <Check size={12} />
                      )}
                      {exp.status === "running" ? "Current Run" : "Completed"}
                    </Badge>
                  </div>
                  <h2>{exp.name}</h2>
                  <p>{exp.conditions}</p>
                  <div className="experiment-facts">
                    <div>
                      <span>Start Date</span>
                      <strong>{dateTime(exp.start_date)} ICT</strong>
                    </div>
                    <div>
                      <span>End Date</span>
                      <strong>
                        {exp.end_date
                          ? `${dateTime(exp.end_date)} ICT`
                          : "In progress"}
                      </strong>
                    </div>
                    <div>
                      <span>Duration</span>
                      <strong>
                        {exp.end_date || now
                          ? duration(exp.start_date, exp.end_date ?? now!)
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Sensor Zones</span>
                      <strong>
                        {exp.sensor_positions
                          .map((p) => positionLabels[p])
                          .join(" · ") || "Not specified"}
                      </strong>
                    </div>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/trends?experiment=${encodeURIComponent(exp.id)}`}
                  >
                    View Results <ArrowUpRight size={15} />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
