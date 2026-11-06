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
import { chambers, type AuditLog, type Chamber, type DailyRecord } from "@/types";

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
      { experiment_id: experiment.id, record_date: recordDate, chamber_id: chamber },
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
        selectedRecord ? `${chamber} record updated.` : `${chamber} record saved.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The record could not be saved.");
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
          <div className="chamber-tabs" role="group" aria-label="Prototype L1, L2, or L3 data selection">
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
            {error && <p className="error-text" role="alert">{error}</p>}
          </div>
        </form>
      ) : (
        <div className="daily-readonly-note">
          <ClipboardCheck size={18} />
          Daily entry is available to the Researcher role. You can review all saved records below.
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
                      {field.label}{field.unit ? ` ${field.unit}` : ""}
                    </th>
                  ))}
                  <th>Entered by</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.record_date}</td>
                    <td><Badge tone="teal">{record.chamber_id}</Badge></td>
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
                    {dateTime(entry.occurred_at)} ICT · {entry.actor_role} · {entry.changes.length} changed fields
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="daily-empty-copy">Activity appears here after the first saved record.</p>
        )}
      </section>
    </>
  );
}
