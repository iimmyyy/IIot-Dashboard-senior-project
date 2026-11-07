from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.audit import add_audit_event
from app.dependencies import (
    Auth,
    CsrfAuth,
    Db,
    SettingsDep,
    aware,
    require_project_role,
)
from app.models import (
    AuditEvent,
    Experiment,
    Measurement,
    MeasurementRevision,
    ProjectMembership,
)
from app.presenters import measurement_out
from app.schemas import (
    MeasurementCreate,
    MeasurementOut,
    MeasurementUpdate,
    TransitionInput,
)

router = APIRouter(tags=["measurements"])


def get_measurement(db: Db, measurement_id: str) -> Measurement:
    measurement = db.scalar(
        select(Measurement)
        .options(selectinload(Measurement.created_by))
        .where(Measurement.id == measurement_id)
    )
    if not measurement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Measurement not found.")
    return measurement


def add_revision(
    db: Db, measurement: Measurement, actor_id: str, reason: str
) -> MeasurementRevision:
    revision = MeasurementRevision(
        measurement_id=measurement.id,
        revision=measurement.revision,
        values=measurement.values,
        reason=reason,
        created_by_id=actor_id,
    )
    db.add(revision)
    return revision


def require_entry_owner(
    db: Db,
    auth: CsrfAuth,
    measurement: Measurement,
    settings: SettingsDep,
) -> ProjectMembership:
    membership = require_project_role(
        db, auth, measurement.project_id, {"staff", "researcher", "professor"}
    )
    if measurement.created_by_id != auth.user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the person who entered this record can change or submit it.",
        )
    if membership.role == "staff":
        window_started_at = measurement.created_at
        if measurement.status == "rejected":
            rejected_at = db.scalar(
                select(AuditEvent.occurred_at)
                .where(
                    AuditEvent.action == "measurement.rejected",
                    AuditEvent.target_type == "measurement",
                    AuditEvent.target_id == measurement.id,
                )
                .order_by(AuditEvent.occurred_at.desc())
                .limit(1)
            )
            if rejected_at:
                window_started_at = rejected_at
        deadline = aware(window_started_at) + timedelta(
            hours=settings.staff_edit_window_hours
        )
        if datetime.now(UTC) > deadline:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "The Staff editing window has closed. Ask a Researcher to review "
                    "the record before any correction is made."
                ),
            )
    return membership


@router.get("/daily-records", response_model=list[MeasurementOut])
def list_daily_records(
    db: Db,
    auth: Auth,
    experiment_id: str | None = Query(default=None),
) -> list[MeasurementOut]:
    project_ids = list(
        db.scalars(
            select(ProjectMembership.project_id).where(ProjectMembership.user_id == auth.user.id)
        ).all()
    )
    if not project_ids:
        return []
    query = (
        select(Measurement)
        .options(selectinload(Measurement.created_by))
        .where(Measurement.project_id.in_(project_ids))
        .order_by(Measurement.record_date.desc(), Measurement.created_at.desc())
    )
    if experiment_id:
        query = query.where(Measurement.experiment_id == experiment_id)
    return [measurement_out(item) for item in db.scalars(query).all()]


@router.post("/daily-records", response_model=MeasurementOut, status_code=status.HTTP_201_CREATED)
def create_daily_record(payload: MeasurementCreate, db: Db, auth: CsrfAuth) -> MeasurementOut:
    experiment = db.get(Experiment, payload.experiment_id)
    if not experiment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found.")
    require_project_role(db, auth, experiment.project_id, {"staff", "researcher", "professor"})
    existing = db.scalar(
        select(Measurement).where(
            Measurement.experiment_id == experiment.id,
            Measurement.record_date == payload.record_date,
            Measurement.historical_label == payload.historical_label,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A record already exists for this date and provenance label.",
        )
    measurement = Measurement(
        project_id=experiment.project_id,
        reactor_id=experiment.reactor_id,
        experiment_id=experiment.id,
        record_date=payload.record_date,
        historical_label=payload.historical_label,
        values=payload.values.model_dump(),
        created_by_id=auth.user.id,
    )
    db.add(measurement)
    db.flush()
    add_revision(db, measurement, auth.user.id, payload.revision_reason)
    add_audit_event(
        db,
        action="measurement.created",
        target_type="measurement",
        target_id=measurement.id,
        actor_id=auth.user.id,
        project_id=measurement.project_id,
        details={
            "experiment_id": experiment.id,
            "revision": 1,
            "status": "draft",
        },
    )
    db.commit()
    return measurement_out(get_measurement(db, measurement.id))


@router.put("/daily-records/{measurement_id}", response_model=MeasurementOut)
def update_daily_record(
    measurement_id: str,
    payload: MeasurementUpdate,
    db: Db,
    auth: CsrfAuth,
    settings: SettingsDep,
) -> MeasurementOut:
    measurement = get_measurement(db, measurement_id)
    require_entry_owner(db, auth, measurement, settings)
    if measurement.status not in {"draft", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft or rejected records can be edited.",
        )
    measurement.revision += 1
    measurement.values = payload.values.model_dump()
    measurement.status = "draft"
    measurement.rejection_reason = None
    add_revision(db, measurement, auth.user.id, payload.revision_reason)
    add_audit_event(
        db,
        action="measurement.revised",
        target_type="measurement",
        target_id=measurement.id,
        actor_id=auth.user.id,
        project_id=measurement.project_id,
        details={
            "experiment_id": measurement.experiment_id,
            "revision": measurement.revision,
        },
    )
    db.commit()
    return measurement_out(get_measurement(db, measurement.id))


def transition(
    db: Db,
    auth: CsrfAuth,
    measurement_id: str,
    *,
    from_status: str,
    to_status: str,
    role: str,
    action: str,
    actor_field: str,
    timestamp_field: str,
    comment: str | None,
    settings: SettingsDep | None = None,
    owner_required: bool = False,
) -> MeasurementOut:
    measurement = get_measurement(db, measurement_id)
    if owner_required:
        if settings is None:
            raise RuntimeError("Entry-owner transitions require application settings.")
        require_entry_owner(db, auth, measurement, settings)
    else:
        require_project_role(db, auth, measurement.project_id, {role})
    if measurement.status != from_status:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Record must be {from_status} before it can become {to_status}.",
        )
    measurement.status = to_status
    setattr(measurement, actor_field, auth.user.id)
    setattr(measurement, timestamp_field, datetime.now(UTC))
    add_audit_event(
        db,
        action=action,
        target_type="measurement",
        target_id=measurement.id,
        actor_id=auth.user.id,
        project_id=measurement.project_id,
        details={
            "experiment_id": measurement.experiment_id,
            "from": from_status,
            "to": to_status,
            "comment": comment,
        },
    )
    db.commit()
    return measurement_out(get_measurement(db, measurement.id))


@router.post("/measurements/{measurement_id}/submit", response_model=MeasurementOut)
def submit_measurement(
    measurement_id: str,
    payload: TransitionInput,
    db: Db,
    auth: CsrfAuth,
    settings: SettingsDep,
) -> MeasurementOut:
    return transition(
        db,
        auth,
        measurement_id,
        from_status="draft",
        to_status="submitted",
        role="staff",
        action="measurement.submitted",
        actor_field="submitted_by_id",
        timestamp_field="submitted_at",
        comment=payload.comment,
        settings=settings,
        owner_required=True,
    )


@router.post("/measurements/{measurement_id}/validate", response_model=MeasurementOut)
def validate_measurement(
    measurement_id: str, payload: TransitionInput, db: Db, auth: CsrfAuth
) -> MeasurementOut:
    return transition(
        db,
        auth,
        measurement_id,
        from_status="submitted",
        to_status="validated",
        role="researcher",
        action="measurement.validated",
        actor_field="validated_by_id",
        timestamp_field="validated_at",
        comment=payload.comment,
    )


@router.post("/measurements/{measurement_id}/certify", response_model=MeasurementOut)
def certify_measurement(
    measurement_id: str, payload: TransitionInput, db: Db, auth: CsrfAuth
) -> MeasurementOut:
    return transition(
        db,
        auth,
        measurement_id,
        from_status="validated",
        to_status="certified",
        role="professor",
        action="measurement.certified",
        actor_field="certified_by_id",
        timestamp_field="certified_at",
        comment=payload.comment,
    )


@router.post("/measurements/{measurement_id}/reject", response_model=MeasurementOut)
def reject_measurement(
    measurement_id: str, payload: TransitionInput, db: Db, auth: CsrfAuth
) -> MeasurementOut:
    measurement = get_measurement(db, measurement_id)
    if not payload.comment:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A rejection reason is required.",
        )
    allowed = {"submitted": "researcher", "validated": "professor"}
    role = allowed.get(measurement.status)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only submitted or validated records can be rejected.",
        )
    require_project_role(db, auth, measurement.project_id, {role})
    previous = measurement.status
    measurement.status = "rejected"
    measurement.rejection_reason = payload.comment
    add_audit_event(
        db,
        action="measurement.rejected",
        target_type="measurement",
        target_id=measurement.id,
        actor_id=auth.user.id,
        project_id=measurement.project_id,
        details={
            "experiment_id": measurement.experiment_id,
            "from": previous,
            "reason": payload.comment,
        },
    )
    db.commit()
    return measurement_out(get_measurement(db, measurement.id))

