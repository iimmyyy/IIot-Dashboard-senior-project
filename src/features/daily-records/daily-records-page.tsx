"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ClipboardCheck, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeading } from "@/components/ui/shared";
import { useCurrentUser } from "@/features/auth/auth-context";
import {
  canEditDailyRecords,
  dailyFieldDefinitions,
  loadAuditLog,
  loadDailyRecords,
  parseDailyRecordForm,
  saveDailyRecord,
  type DailyNumericField,
} from "@/features/daily-records/model";
import { useMonitor } from "@/hooks/use-monitor";
import { bangkokDate, dateTime } from "@/lib/utils";
import {
  chambers,
  type AuditLog,
  type Chamber,
  type DailyRecord,
} from "@/types";
import {
  researchApi,
  researchApiEnabled,
  type ActionHistory,
  type MeasurementRecord,
  type MeasurementValues,
  type PersistentAudit,
  type ResearchExperiment,
} from "@/lib/api/research";
import {
  canEnterMeasurements,
  canReviewAudit,
  roleForProject,
} from "@/lib/auth/project-permissions";

function emptyValues() {
  return Object.fromEntries(
    dailyFieldDefinitions.map(({ key }) => [key, ""]),
  ) as Record<DailyNumericField, string>;
}

function valuesFromRecord(record?: DailyRecord) {
  if (!record) return emptyValues();
  return Object.fromEntries(
    dailyFieldDefinitions.map(({ key }) => [key, String(record[key])]),
  ) as Record<DailyNumericField, string>;
}

const groups = ["Temperature", "Process", "Gas"] as const;

export function DailyRecordsPage() {
  return researchApiEnabled ? (
    <PersistentDailyRecordsPage />
  ) : (
    <DemoDailyRecordsPage />
  );
}

function DemoDailyRecordsPage() {
  const user = useCurrentUser();
  const { currentExperiment, experiments, mode } = useMonitor();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLog[]>([]);
  const [recordDate, setRecordDate] = useState(() => bangkokDate());
  const [chamber, setChamber] = useState<Chamber>("L1");
  const [values, setValues] = useState(emptyValues);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const editable = canEditDailyRecords(user);
  const experiment = currentExperiment ?? experiments.data?.[0];

  const selectedRecord = useMemo(
    () =>
      records.find(
        (record) =>
          record.experiment_id === experiment?.id &&
          record.record_date === recordDate &&
          record.chamber_id === chamber,
      ),
    [chamber, experiment?.id, recordDate, records],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storedRecords = loadDailyRecords(localStorage);
      setRecords(storedRecords);
      setAuditLog(loadAuditLog(localStorage));
      setValues(
        valuesFromRecord(
          storedRecords.find(
            (record) =>
              record.experiment_id === experiment?.id &&
              record.record_date === recordDate &&
              record.chamber_id === chamber,
          ),
        ),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [chamber, experiment?.id, recordDate]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");
    if (!experiment) {
      setError("No experiment is available for this record.");
      return;
    }
    if (mode !== "demo") {
      setError("Live daily-record storage is not connected yet.");
      return;
    }
    const parsed = parseDailyRecordForm(
      {
        experiment_id: experiment.id,
        record_date: recordDate,
        chamber_id: chamber,
      },
      values,
    );
    if (!parsed.success) {
      setError("Complete every field with a valid numeric value.");
      return;
    }
    try {
      const result = saveDailyRecord(localStorage, parsed.data, user);
      setRecords(result.records);
      setAuditLog(result.auditLog);
      setFeedback(
        selectedRecord
          ? `${chamber} record updated.`
          : `${chamber} record saved.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The record could not be saved.",
      );
    }
  }

  return (
    <>
      <PageHeading title="Daily Records">
        <Badge tone={editable ? "teal" : "neutral"}>
          {editable ? "Researcher entry" : "Read only"}
        </Badge>
      </PageHeading>

      <section className="daily-context card">
        <label>
          Record date
          <input
            type="date"
            value={recordDate}
            max={bangkokDate()}
            onChange={(event) => {
              setRecordDate(event.target.value);
              setFeedback("");
            }}
          />
        </label>
        <div>
          <span className="daily-label">Prototype selection</span>
          <div
            className="chamber-tabs"
            role="group"
            aria-label="Prototype L1, L2, or L3 data selection"
          >
            {chambers.map((item) => (
              <button
                key={item}
                type="button"
                className={chamber === item ? "selected" : ""}
                onClick={() => {
                  setChamber(item);
                  setFeedback("");
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="daily-experiment">
          <span>Experiment</span>
          <strong>{experiment?.name ?? "No experiment"}</strong>
          <small>{experiment?.id ?? "—"}</small>
        </div>
      </section>

      {editable ? (
        <form className="daily-entry-form" onSubmit={submit}>
          {groups.map((group) => (
            <section className="daily-field-section card" key={group}>
              <div className="daily-section-heading">
                <h2>{group}</h2>
                {group === "Temperature" && selectedRecord && (
                  <Badge tone="neutral">
                    <Pencil size={12} /> Editing saved record
                  </Badge>
                )}
              </div>
              <div className="daily-field-grid">
                {dailyFieldDefinitions
                  .filter((field) => field.group === group)
                  .map((field) => (
                    <label key={field.key}>
                      <span>
                        {field.label}
                        {field.unit && <small>{field.unit}</small>}
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        value={values[field.key]}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
              </div>
            </section>
          ))}
          <div className="daily-form-actions">
            <Button type="submit">
              <Save size={15} />
              {selectedRecord ? "Update record" : "Save record"}
            </Button>
            {feedback && <p className="inline-feedback">{feedback}</p>}
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </div>
        </form>
      ) : (
        <div className="daily-readonly-note">
          <ClipboardCheck size={18} />
          Daily entry is available to the Researcher role. You can review all
          saved records below.
        </div>
      )}

      <section className="daily-history card">
        <div className="daily-section-heading">
          <h2>Saved records</h2>
          <span>{records.length} records</span>
        </div>
        {records.length ? (
          <div className="daily-table-wrap">
            <table className="daily-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Prototype selection</th>
                  {dailyFieldDefinitions.map((field) => (
                    <th key={field.key}>
                      {field.label}
                      {field.unit ? ` ${field.unit}` : ""}
                    </th>
                  ))}
                  <th>Entered by</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.record_date}</td>
                    <td>
                      <Badge tone="teal">{record.chamber_id}</Badge>
                    </td>
                    {dailyFieldDefinitions.map((field) => (
                      <td key={field.key}>{record[field.key]}</td>
                    ))}
                    <td>{record.entered_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No daily records yet"
            message="A researcher can add the first record using the form above."
          />
        )}
      </section>

      <section className="daily-audit card">
        <div className="daily-section-heading">
          <h2>Activity log</h2>
          <span>Latest {Math.min(auditLog.length, 12)}</span>
        </div>
        {auditLog.length ? (
          <ol className="audit-list">
            {auditLog.slice(0, 12).map((entry) => (
              <li key={entry.id}>
                <span className="audit-dot" />
                <div>
                  <strong>{entry.actor_name}</strong>
                  <span>
                    {entry.action === "daily_record.created"
                      ? "created a daily record"
                      : entry.action === "daily_record.updated"
                        ? "updated a daily record"
                        : entry.action === "alert.acknowledged"
                          ? "acknowledged an alert"
                          : entry.action === "batch.completed"
                            ? "completed a batch"
                            : "started a new batch"}
                  </span>
                  <small>
                    {dateTime(entry.occurred_at)} ICT · {entry.actor_role} ·{" "}
                    {entry.changes.length} changed fields
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="daily-empty-copy">
            Activity appears here after the first saved record.
          </p>
        )}
      </section>
    </>
  );
}

function persistentValuesFromRecord(record?: MeasurementRecord) {
  return Object.fromEntries(
    dailyFieldDefinitions.map(({ key }) => [
      key,
      record?.values[key] == null ? "" : String(record.values[key]),
    ]),
  ) as Record<DailyNumericField, string>;
}

function statusTone(status: MeasurementRecord["status"]) {
  if (status === "certified") return "good" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "submitted" || status === "validated")
    return "warning" as const;
  return "neutral" as const;
}

function PersistentDailyRecordsPage() {
  const user = useCurrentUser();
  const [experiments, setExperiments] = useState<ResearchExperiment[]>([]);
  const [experimentId, setExperimentId] = useState("");
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [audit, setAudit] = useState<PersistentAudit[]>([]);
  const [actionHistory, setActionHistory] = useState<ActionHistory[]>([]);
  const [actionCount, setActionCount] = useState(0);
  const [recordDate, setRecordDate] = useState(() => bangkokDate());
  const [historicalLabel, setHistoricalLabel] = useState("current");
  const [values, setValues] = useState(emptyValues);
  const [revisionReason, setRevisionReason] = useState("Daily field entry");
  const [reviewComment, setReviewComment] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedRecord = useMemo(
    () =>
      records.find(
        (record) =>
          record.experiment_id === experimentId &&
          record.record_date === recordDate &&
          record.historical_label === historicalLabel,
      ),
    [experimentId, historicalLabel, recordDate, records],
  );
  const selectedExperiment = experiments.find(
    (experiment) => experiment.id === experimentId,
  );
  const selectedProjectRole = roleForProject(
    user,
    selectedExperiment?.project_id,
  );

  async function reload() {
    setLoading(true);
    try {
      const [nextExperiments, nextRecords, nextHistory, actions] =
        await Promise.all([
          researchApi.experiments(),
          researchApi.records(),
          researchApi.actionHistory(),
          researchApi.pendingActions(),
        ]);
      setExperiments(nextExperiments);
      setRecords(nextRecords);
      setActionHistory(nextHistory);
      setActionCount(actions.length);
      setExperimentId((current) => current || nextExperiments[0]?.id || "");
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The research service could not load the records.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => void reload());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (
      !selectedExperiment ||
      !canReviewAudit(user, selectedExperiment.project_id)
    ) {
      return;
    }
    let active = true;
    void researchApi
      .audit({
        projectId: selectedExperiment.project_id,
        experimentId: selectedExperiment.id,
      })
      .then((entries) => {
        if (active) setAudit(entries);
      })
      .catch((reason: unknown) => {
        if (active) {
          setAudit([]);
          setError(
            reason instanceof Error
              ? reason.message
              : "The experiment audit could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [selectedExperiment, user]);

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setValues(persistentValuesFromRecord(selectedRecord)),
    );
    return () => cancelAnimationFrame(frame);
  }, [selectedRecord]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");
    const parsedValues = Object.fromEntries(
      dailyFieldDefinitions.map(({ key }) => [
        key,
        values[key].trim() === "" ? null : Number(values[key]),
      ]),
    ) as MeasurementValues;
    if (!Object.values(parsedValues).some((value) => value !== null)) {
      setError("Enter at least one collected measurement.");
      return;
    }
    try {
      if (selectedRecord) {
        await researchApi.updateRecord(selectedRecord.id, {
          values: parsedValues,
          revision_reason: revisionReason,
        });
        setFeedback("Draft record updated and revision history preserved.");
      } else {
        await researchApi.createRecord({
          experiment_id: experimentId,
          record_date: recordDate,
          historical_label: historicalLabel,
          values: parsedValues,
          revision_reason: revisionReason,
        });
        setFeedback("Draft record saved to the shared database.");
      }
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The record could not be saved.",
      );
    }
  }

  async function transition(
    record: MeasurementRecord,
    action: "submit" | "validate" | "certify" | "reject",
  ) {
    setError("");
    setFeedback("");
    if (action === "reject" && reviewComment.trim().length < 3) {
      setError("Enter a clear review comment before rejecting a record.");
      return;
    }
    try {
      await researchApi.transition(
        record.id,
        action,
        reviewComment || undefined,
      );
      const resultLabels = {
        submit: "submitted",
        validate: "validated",
        certify: "certified",
        reject: "returned for correction",
      } as const;
      setFeedback(`Record ${resultLabels[action]} successfully.`);
      setReviewComment("");
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The workflow action failed.",
      );
    }
  }

  const canEnter = canEnterMeasurements(user, selectedExperiment?.project_id);
  const ownsSelectedRecord =
    !selectedRecord || selectedRecord.created_by_id === user.id;
  const editableRecord =
    ownsSelectedRecord &&
    (!selectedRecord || ["draft", "rejected"].includes(selectedRecord.status));

  return (
    <>
      <PageHeading title="Daily Records">
        <Badge tone={actionCount ? "warning" : "neutral"}>
          {actionCount
            ? `${actionCount} actions require attention`
            : "Shared database"}
        </Badge>
      </PageHeading>

      <section className="daily-context card">
        <label>
          Experiment
          <select
            value={experimentId}
            onChange={(event) => setExperimentId(event.target.value)}
          >
            {experiments.map((experiment) => (
              <option key={experiment.id} value={experiment.id}>
                {experiment.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Record date
          <input
            type="date"
            value={recordDate}
            max={bangkokDate()}
            onChange={(event) => setRecordDate(event.target.value)}
          />
        </label>
        <label>
          Provenance label
          <input
            value={historicalLabel}
            maxLength={120}
            onChange={(event) => setHistoricalLabel(event.target.value)}
            aria-describedby="provenance-help"
          />
          <small id="provenance-help">
            Use “current” unless an approved historical label applies.
          </small>
        </label>
      </section>

      {loading && (
        <p className="daily-empty-copy">Loading shared research records…</p>
      )}
      {canEnter && editableRecord && experimentId ? (
        <form className="daily-entry-form" onSubmit={save}>
          {groups.map((group) => (
            <section className="daily-field-section card" key={group}>
              <div className="daily-section-heading">
                <h2>{group}</h2>
                {selectedRecord && (
                  <Badge tone={statusTone(selectedRecord.status)}>
                    Revision {selectedRecord.revision}
                  </Badge>
                )}
              </div>
              <div className="daily-field-grid">
                {dailyFieldDefinitions
                  .filter((field) => field.group === group)
                  .map((field) => (
                    <label key={field.key}>
                      <span>
                        {field.label}
                        {field.unit && <small>{field.unit}</small>}
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={values[field.key]}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
              </div>
            </section>
          ))}
          <div className="daily-form-actions">
            <label className="daily-revision-reason">
              Revision reason
              <input
                value={revisionReason}
                minLength={3}
                maxLength={500}
                onChange={(event) => setRevisionReason(event.target.value)}
                required
              />
            </label>
            <Button type="submit">
              <Save size={15} />
              {selectedRecord ? "Update draft" : "Save draft"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="daily-readonly-note">
          <ClipboardCheck size={18} />
          {canEnter && !ownsSelectedRecord
            ? "Only the person who entered this record can revise or submit it."
            : canEnter
              ? "Submitted records are locked while they are under review."
              : "You do not have a role in this experiment's project."}
        </div>
      )}

      {(selectedProjectRole === "researcher" ||
        selectedProjectRole === "professor") && (
        <section className="card daily-review-note">
          <label>
            Review comment
            <input
              value={reviewComment}
              maxLength={1000}
              placeholder="Required when returning a record for correction"
              onChange={(event) => setReviewComment(event.target.value)}
            />
          </label>
        </section>
      )}

      {feedback && <p className="inline-feedback">{feedback}</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <section className="daily-history card">
        <div className="daily-section-heading">
          <h2>Shared records</h2>
          <span>{records.length} records</span>
        </div>
        {records.length ? (
          <div className="daily-table-wrap">
            <table className="daily-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Provenance</th>
                  <th>Status</th>
                  <th>Revision</th>
                  {dailyFieldDefinitions.map((field) => (
                    <th key={field.key}>{field.label}</th>
                  ))}
                  <th>Entered by</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.record_date}</td>
                    <td>{record.historical_label}</td>
                    <td>
                      <Badge tone={statusTone(record.status)}>
                        {record.status}
                      </Badge>
                    </td>
                    <td>{record.revision}</td>
                    {dailyFieldDefinitions.map((field) => (
                      <td key={field.key}>{record.values[field.key] ?? "—"}</td>
                    ))}
                    <td>{record.created_by_name}</td>
                    <td>
                      <div className="daily-workflow-actions">
                        {record.created_by_id === user.id &&
                          record.status === "draft" && (
                            <Button
                              size="sm"
                              onClick={() => void transition(record, "submit")}
                            >
                              Submit
                            </Button>
                          )}
                        {roleForProject(user, record.project_id) ===
                          "researcher" &&
                          record.status === "submitted" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  void transition(record, "validate")
                                }
                              >
                                Validate
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void transition(record, "reject")
                                }
                              >
                                Return
                              </Button>
                            </>
                          )}
                        {roleForProject(user, record.project_id) ===
                          "professor" &&
                          record.status === "validated" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  void transition(record, "certify")
                                }
                              >
                                Certify
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void transition(record, "reject")
                                }
                              >
                                Return
                              </Button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No shared records yet"
            message="Project members can save the first database-backed record above."
          />
        )}
      </section>

      <section className="daily-audit card">
        <div className="daily-section-heading">
          <h2>My activity</h2>
          <span>Latest {Math.min(actionHistory.length, 12)}</span>
        </div>
        <ol className="audit-list">
          {actionHistory.slice(0, 12).map((entry) => (
            <li key={entry.id}>
              <span className="audit-dot" />
              <div>
                <strong>{entry.title}</strong>
                <span>
                  Current status: {entry.status}
                  {entry.reviewer_name
                    ? ` · Reviewed by ${entry.reviewer_name}`
                    : ""}
                </span>
                <small>
                  {dateTime(entry.occurred_at)} ICT · {entry.actor_name}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {canReviewAudit(user, selectedExperiment?.project_id) && (
        <section className="daily-audit card">
          <div className="daily-section-heading">
            <h2>Experiment audit</h2>
            <span>Latest {Math.min(audit.length, 12)}</span>
          </div>
          <ol className="audit-list">
            {audit.slice(0, 12).map((entry) => (
              <li key={entry.id}>
                <span className="audit-dot" />
                <div>
                  <strong>{entry.action.replaceAll(".", " ")}</strong>
                  <span>{entry.target_type}</span>
                  <small>
                    {dateTime(entry.occurred_at)} ICT · append-only database
                    event
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
