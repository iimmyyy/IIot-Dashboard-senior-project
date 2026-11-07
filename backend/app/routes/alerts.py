from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.audit import add_audit_event
from app.dependencies import Auth, CsrfAuth, Db, require_project_role
from app.models import Alert, AlertAcknowledgement, ProjectMembership
from app.presenters import alert_out
from app.schemas import AlertOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(db: Db, auth: Auth) -> list[AlertOut]:
    project_ids = list(
        db.scalars(
            select(ProjectMembership.project_id).where(ProjectMembership.user_id == auth.user.id)
        ).all()
    )
    if not project_ids:
        return []
    alerts = db.scalars(
        select(Alert).where(Alert.project_id.in_(project_ids)).order_by(Alert.detected_at.desc())
    ).all()
    return [alert_out(db, alert) for alert in alerts]


@router.post("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(alert_id: str, db: Db, auth: CsrfAuth) -> AlertOut:
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found.")
    require_project_role(db, auth, alert.project_id, {"staff", "researcher", "professor"})
    acknowledgement = db.scalar(
        select(AlertAcknowledgement).where(
            AlertAcknowledgement.alert_id == alert.id,
            AlertAcknowledgement.user_id == auth.user.id,
        )
    )
    if not acknowledgement:
        acknowledgement = AlertAcknowledgement(alert_id=alert.id, user_id=auth.user.id)
        db.add(acknowledgement)
        db.flush()
        add_audit_event(
            db,
            action="alert.acknowledged",
            target_type="alert",
            target_id=alert.id,
            actor_id=auth.user.id,
            project_id=alert.project_id,
        )
        db.commit()
    return alert_out(db, alert)

