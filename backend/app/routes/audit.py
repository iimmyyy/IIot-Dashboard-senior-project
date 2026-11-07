from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, or_, select

from app.dependencies import Auth, Db, membership_for
from app.models import (
    Alert,
    AuditEvent,
    CompletionRequest,
    Experiment,
    Measurement,
    ProjectMembership,
)
from app.schemas import AuditEventOut

router = APIRouter(prefix="/audit-events", tags=["audit"])


def experiment_audit_query(db: Db, experiment: Experiment):  # type: ignore[no-untyped-def]
    measurement_ids = list(
        db.scalars(
            select(Measurement.id).where(Measurement.experiment_id == experiment.id)
        ).all()
    )
    request_ids = list(
        db.scalars(
            select(CompletionRequest.id).where(
                CompletionRequest.experiment_id == experiment.id
            )
        ).all()
    )
    alert_ids = list(
        db.scalars(select(Alert.id).where(Alert.experiment_id == experiment.id)).all()
    )
    return select(AuditEvent).where(
        AuditEvent.project_id == experiment.project_id,
        or_(
            and_(
                AuditEvent.target_type == "experiment",
                AuditEvent.target_id == experiment.id,
            ),
            and_(
                AuditEvent.target_type == "measurement",
                AuditEvent.target_id.in_(measurement_ids),
            ),
            and_(
                AuditEvent.target_type == "completion_request",
                AuditEvent.target_id.in_(request_ids),
            ),
            and_(
                AuditEvent.target_type == "alert",
                AuditEvent.target_id.in_(alert_ids),
            ),
        ),
    )


@router.get("", response_model=list[AuditEventOut])
def list_audit_events(
    db: Db,
    auth: Auth,
    project_id: str | None = Query(default=None),
    experiment_id: str | None = Query(default=None),
) -> list[AuditEvent]:
    if experiment_id:
        experiment = db.get(Experiment, experiment_id)
        if not experiment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found."
            )
        membership = membership_for(db, auth.user.id, experiment.project_id)
        if membership.role not in {"professor", "researcher"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Audit events are not available to the Staff role.",
            )
        query = experiment_audit_query(db, experiment)
    else:
        professor_projects = list(
            db.scalars(
                select(ProjectMembership.project_id).where(
                    ProjectMembership.user_id == auth.user.id,
                    ProjectMembership.role == "professor",
                )
            ).all()
        )
        if project_id:
            membership = membership_for(db, auth.user.id, project_id)
            if membership.role != "professor":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        "Researchers must select one experiment; Staff cannot read "
                        "the technical audit log."
                    ),
                )
            professor_projects = [project_id]
        if not professor_projects:
            memberships = list(
                db.scalars(
                    select(ProjectMembership.role).where(
                        ProjectMembership.user_id == auth.user.id
                    )
                ).all()
            )
            if "researcher" in memberships:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Researchers must select an experiment to view its audit events.",
                )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Audit events are not available to the Staff role.",
            )
        query = select(AuditEvent).where(
            AuditEvent.project_id.in_(professor_projects)
        )

    return list(
        db.scalars(query.order_by(AuditEvent.occurred_at.desc()).limit(200)).all()
    )
