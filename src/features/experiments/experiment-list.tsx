"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, FlaskConical, Search } from "lucide-react";
import { useMonitor } from "@/hooks/use-monitor";
import { dateTime, duration, positionLabels } from "@/lib/utils";
import { Badge, EmptyState, PageHeading } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/auth-context";
import {
  researchApi,
  researchApiEnabled,
  type CompletionRequest,
  type ResearchExperiment,
} from "@/lib/api/research";
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
      <PageHeading title="Experiment History">
        <Badge tone="teal">
          <FlaskConical size={13} />
          {experiments.data?.length ?? 0} Experiments
        </Badge>
      </PageHeading>
      {researchApiEnabled && <DatabaseExperimentWorkflow />}
      <div className="card history-card">
        {researchApiEnabled && (
          <div className="daily-readonly-note">
            <FlaskConical size={18} />
            Temperature charts below remain simulated. Database workflow status
            is shown above.
          </div>
        )}
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

function DatabaseExperimentWorkflow() {
  const user = useCurrentUser();
  const [experiments, setExperiments] = useState<ResearchExperiment[]>([]);
  const [approvals, setApprovals] = useState<CompletionRequest[]>([]);
  const [rationale, setRationale] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const reload = useCallback(async () => {
    try {
      const [nextExperiments, nextApprovals] = await Promise.all([
        researchApi.experiments(),
        user.role === "professor"
          ? researchApi.approvals()
          : Promise.resolve([]),
      ]);
      setExperiments(nextExperiments);
      setApprovals(nextApprovals);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Research workflow unavailable.",
      );
    }
  }, [user.role]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void reload());
    return () => cancelAnimationFrame(frame);
  }, [reload]);

  async function requestCompletion(experiment: ResearchExperiment) {
    if (rationale.trim().length < 10) {
      setError("Explain the research basis before requesting completion.");
      return;
    }
    try {
      await researchApi.requestCompletion(experiment.id, rationale);
      setFeedback(
        "Completion request sent to the Professor. No equipment action was taken.",
      );
      setRationale("");
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request failed.");
    }
  }

  async function review(
    request: CompletionRequest,
    decision: "approve" | "reject",
  ) {
    if (comment.trim().length < 3) {
      setError("Enter a review comment before deciding.");
      return;
    }
    try {
      await researchApi.reviewCompletion(request.id, decision, comment);
      setFeedback(
        decision === "approve"
          ? "Experiment completion approved. This did not control the blower."
          : "Completion request returned to the Researcher.",
      );
      setComment("");
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Review failed.");
    }
  }

  return (
    <section className="card research-workflow-card">
      <div className="card-heading">
        <div>
          <h2>Research Workflow</h2>
          <p>
            Persistent experiment status and human approvals from PostgreSQL.
          </p>
        </div>
        <Badge tone="teal">{experiments.length} database runs</Badge>
      </div>
      <div className="experiment-list">
        {experiments.map((experiment) => (
          <article className="experiment-row" key={experiment.id}>
            <span className="experiment-row-icon">
              <FlaskConical size={23} />
            </span>
            <div className="experiment-row-body">
              <div className="experiment-row-heading">
                <span className="overline">{experiment.code}</span>
                <Badge
                  tone={experiment.status === "running" ? "good" : "neutral"}
                >
                  {experiment.status === "running" ? "Running" : "Completed"}
                </Badge>
              </div>
              <h2>{experiment.name}</h2>
              <p>
                {experiment.conditions ||
                  "No experimental conditions recorded."}
              </p>
              {user.role === "researcher" &&
                experiment.status === "running" && (
                  <div className="research-workflow-action">
                    <input
                      value={rationale}
                      placeholder="Research basis for requesting completion"
                      maxLength={4000}
                      onChange={(event) => setRationale(event.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={() => void requestCompletion(experiment)}
                    >
                      Request Completion
                    </Button>
                  </div>
                )}
            </div>
          </article>
        ))}
      </div>
      {user.role === "professor" && approvals.length > 0 && (
        <div className="research-approvals">
          <label>
            Professor review comment
            <input
              value={comment}
              maxLength={2000}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          {approvals.map((approval) => (
            <div key={approval.id} className="research-approval-row">
              <span>{approval.rationale}</span>
              <Button
                size="sm"
                onClick={() => void review(approval, "approve")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void review(approval, "reject")}
              >
                Return
              </Button>
            </div>
          ))}
        </div>
      )}
      {feedback && <p className="inline-feedback">{feedback}</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
