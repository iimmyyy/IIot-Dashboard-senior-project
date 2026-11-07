from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent


def add_audit_event(
    db: Session,
    *,
    action: str,
    target_type: str,
    target_id: str,
    actor_id: str | None,
    project_id: str | None,
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        action=action,
        target_type=target_type,
        target_id=target_id,
        actor_id=actor_id,
        project_id=project_id,
        details=details or {},
    )
    db.add(event)
    return event

