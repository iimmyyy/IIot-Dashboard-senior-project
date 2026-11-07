from sqlalchemy.orm import Session

from app.models import Alert, AlertAcknowledgement, Measurement, User
from app.schemas import AlertOut, MeasurementOut, MeasurementValues, MembershipOut, UserOut


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        is_system_admin=user.is_system_admin,
        memberships=[
            MembershipOut(
                project_id=item.project_id,
                project_code=item.project.code,
                project_name=item.project.name,
                role=item.role,
            )
            for item in user.memberships
        ],
    )


def measurement_out(measurement: Measurement) -> MeasurementOut:
    return MeasurementOut(
        id=measurement.id,
        project_id=measurement.project_id,
        reactor_id=measurement.reactor_id,
        experiment_id=measurement.experiment_id,
        record_date=measurement.record_date,
        historical_label=measurement.historical_label,
        values=MeasurementValues.model_validate(measurement.values),
        status=measurement.status,
        revision=measurement.revision,
        created_by_id=measurement.created_by_id,
        created_by_name=measurement.created_by.display_name,
        created_at=measurement.created_at,
        updated_at=measurement.updated_at,
        submitted_at=measurement.submitted_at,
        validated_at=measurement.validated_at,
        certified_at=measurement.certified_at,
        rejection_reason=measurement.rejection_reason,
    )


def alert_out(db: Session, alert: Alert) -> AlertOut:
    acknowledgement = db.query(AlertAcknowledgement).filter_by(alert_id=alert.id).first()
    acknowledged_by = None
    if acknowledgement:
        user = db.get(User, acknowledgement.user_id)
        acknowledged_by = user.display_name if user else "Unknown user"
    return AlertOut(
        id=alert.id,
        experiment_id=alert.experiment_id,
        kind=alert.kind,
        title=alert.title,
        description=alert.description,
        action=alert.action,
        severity=alert.severity,
        detected_at=alert.detected_at,
        supporting_values=alert.supporting_values,
        acknowledged_at=acknowledgement.acknowledged_at if acknowledgement else None,
        acknowledged_by=acknowledged_by,
        resolved_at=alert.resolved_at,
    )

