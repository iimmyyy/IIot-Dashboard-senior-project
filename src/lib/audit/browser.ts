import type { SessionUser } from "@/lib/auth/types";
import {
  auditLogSchema,
  type AuditLog,
  type ResearchAlert,
} from "@/types";

export const AUDIT_LOG_KEY = "biodry-audit-log-v1";

export function loadBrowserAuditLog(
  storage: Pick<Storage, "getItem">,
): AuditLog[] {
  try {
    return auditLogSchema.array().parse(
      JSON.parse(storage.getItem(AUDIT_LOG_KEY) ?? "[]"),
    );
  } catch {
    return [];
  }
}

export function appendBrowserAuditLog(
  storage: Pick<Storage, "getItem" | "setItem">,
  event: AuditLog,
) {
  const audit = [event, ...loadBrowserAuditLog(storage)].slice(0, 500);
  storage.setItem(AUDIT_LOG_KEY, JSON.stringify(audit));
  return audit;
}

export function appendAlertAcknowledgementAudit(
  storage: Pick<Storage, "getItem" | "setItem">,
  alert: ResearchAlert,
  actor: SessionUser,
  occurredAt = new Date().toISOString(),
) {
  const event = auditLogSchema.parse({
    id: `AUD-${crypto.randomUUID()}`,
    occurred_at: occurredAt,
    action: "alert.acknowledged",
    actor_id: actor.id,
    actor_name: actor.displayName,
    actor_role: actor.role,
    target_type: "alert",
    target_id: alert.id,
    changes: [
      { field: "acknowledged_at", before: null, after: occurredAt },
      { field: "acknowledged_by", before: null, after: actor.displayName },
    ],
  });
  return appendBrowserAuditLog(storage, event);
}
