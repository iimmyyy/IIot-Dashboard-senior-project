import type { SessionUser } from "@/lib/auth/types";

export type AuditAction =
  | "auth.sign_in"
  | "auth.sign_out"
  | "daily_record.created"
  | "daily_record.updated"
  | "alert.acknowledged"
  | "batch.completed"
  | "batch.started";

export type AuditEvent = {
  id: string;
  occurredAt: string;
  action: AuditAction;
  actor: Pick<SessionUser, "id" | "username" | "displayName" | "role">;
  metadata?: Record<string, string>;
};

/**
 * Temporary audit sink. Replace this function with a database insert when the
 * backend audit store is available; callers do not need to change.
 */
export function recordAuditEvent(
  actor: SessionUser,
  action: AuditAction,
  metadata?: Record<string, string>,
) {
  const event: AuditEvent = {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    action,
    actor,
    metadata,
  };
  console.info("[audit]", JSON.stringify(event));
  return event;
}
