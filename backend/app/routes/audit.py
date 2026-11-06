from fastapi import APIRouter
from sqlalchemy import select

from app.dependencies import Auth, Db
from app.models import AuditEvent, ProjectMembership
from app.schemas import AuditEventOut

router = APIRouter(prefix="/audit-events", tags=["audit"])


@router.get("", response_model=list[AuditEventOut])
def list_audit_events(db: Db, auth: Auth) -> list[AuditEvent]:
    project_ids = list(
        db.scalars(
            select(ProjectMembership.project_id).where(ProjectMembership.user_id == auth.user.id)
        ).all()
    )
    if not project_ids:
        return []
    return list(
        db.scalars(
            select(AuditEvent)
            .where(AuditEvent.project_id.in_(project_ids))
            .order_by(AuditEvent.occurred_at.desc())
            .limit(200)
        ).all()
    )

