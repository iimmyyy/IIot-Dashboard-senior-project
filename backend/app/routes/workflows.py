from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.audit import add_audit_event
from app.dependencies import Auth, CsrfAuth, Db, require_project_role
from app.models import (
    AuditEvent,
    CompletionRequest,
    Experiment,
    Measurement,
    ProjectMembership,
    User,
)
from app.schemas import (
    ActionHistoryOut,
    ActionItemOut,
    CompletionRequestCreate,
    CompletionRequestOut,
    CompletionReview,
)

router = APIRouter(tags=["research workflow"])


def project_ids(db: Db, user_id: str, role: str | None = None) -> list[str]:
    query = select(ProjectMembership.project_id).where(ProjectMembership.user_id == user_id)
    if role:
        query = query.where(ProjectMembership.role == role)
    return list(db.scalars(query).all())


@router.post(
    "/experiments/{experiment_id}/completion-requests",
    response_model=CompletionRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def request_completion(
    experiment_id: str,
    payload: CompletionRequestCreate,
    db: Db,
    auth: CsrfAuth,
) -> CompletionRequest:
    experiment = db.get(Experiment, experiment_id)
    if not experiment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found.")
    require_project_role(db, auth, experiment.project_id, {"researcher"})
    if experiment.status != "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Experiment is not running."
        )
    if not db.scalar(
        select(Measurement.id).where(
            Measurement.experiment_id == experiment.id, Measurement.status == "certified"
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="At least one certified measurement is required before requesting completion.",
        )
    if db.scalar(
        select(CompletionRequest.id).where(
            CompletionRequest.experiment_id == experiment.id,
            CompletionRequest.status == "pending",
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="A request is already pending."
        )
    request = CompletionRequest(
        project_id=experiment.project_id,
        experiment_id=experiment.id,
        rationale=payload.rationale,
        requested_by_id=auth.user.id,
    )
    db.add(request)
    db.flush()
    add_audit_event(
        db,
        action="experiment.completion_requested",
        target_type="completion_request",
        target_id=request.id,
        actor_id=auth.user.id,
        project_id=request.project_id,
        details={"experiment_id": experiment.id},
    )
    db.commit()
    db.refresh(request)
    return request


def get_pending_request(db: Db, request_id: str) -> CompletionRequest:
    request = db.get(CompletionRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval not found.")
    if request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Approval is already resolved."
        )
    return request


@router.post("/approvals/{request_id}/approve", response_model=CompletionRequestOut)
def approve_completion(
    request_id: str,
    payload: CompletionReview,
    db: Db,
    auth: CsrfAuth,
) -> CompletionRequest:
    request = get_pending_request(db, request_id)
    require_project_role(db, auth, request.project_id, {"professor"})
    experiment = db.get(Experiment, request.experiment_id)
    if not experiment or experiment.status != "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Experiment is not running."
        )
    now = datetime.now(UTC)
    request.status = "approved"
    request.reviewed_by_id = auth.user.id
    request.reviewed_at = now
    request.review_comment = payload.comment
    experiment.status = "completed"
    experiment.end_at = now
    add_audit_event(
        db,
        action="experiment.completion_approved",
        target_type="completion_request",
        target_id=request.id,
        actor_id=auth.user.id,
        project_id=request.project_id,
        details={"experiment_id": experiment.id, "comment": payload.comment},
    )
    db.commit()
    db.refresh(request)
    return request


@router.post("/approvals/{request_id}/reject", response_model=CompletionRequestOut)
def reject_completion(
    request_id: str,
    payload: CompletionReview,
    db: Db,
    auth: CsrfAuth,
) -> CompletionRequest:
    request = get_pending_request(db, request_id)
    require_project_role(db, auth, request.project_id, {"professor"})
    request.status = "rejected"
    request.reviewed_by_id = auth.user.id
    request.reviewed_at = datetime.now(UTC)
    request.review_comment = payload.comment
    add_audit_event(
        db,
        action="experiment.completion_rejected",
        target_type="completion_request",
        target_id=request.id,
        actor_id=auth.user.id,
        project_id=request.project_id,
        details={
            "experiment_id": request.experiment_id,
            "comment": payload.comment,
        },
    )
    db.commit()
    db.refresh(request)
    return request


@router.get("/actions/pending", response_model=list[ActionItemOut])
def pending_actions(db: Db, auth: Auth) -> list[ActionItemOut]:
    items: list[ActionItemOut] = []
    researcher_projects = project_ids(db, auth.user.id, "researcher")
    if researcher_projects:
        for measurement in db.scalars(
            select(Measurement).where(
                Measurement.project_id.in_(researcher_projects),
                Measurement.status == "submitted",
            )
        ):
            items.append(
                ActionItemOut(
                    id=f"validate:{measurement.id}",
                    kind="measurement_validation",
                    title=f"Validate measurement for {measurement.record_date.isoformat()}",
                    status=measurement.status,
                    project_id=measurement.project_id,
                    target_id=measurement.id,
                    occurred_at=measurement.updated_at,
                )
            )
    professor_projects = project_ids(db, auth.user.id, "professor")
    if professor_projects:
        for measurement in db.scalars(
            select(Measurement).where(
                Measurement.project_id.in_(professor_projects),
                Measurement.status == "validated",
            )
        ):
            items.append(
                ActionItemOut(
                    id=f"certify:{measurement.id}",
                    kind="measurement_certification",
                    title=f"Certify measurement for {measurement.record_date.isoformat()}",
                    status=measurement.status,
                    project_id=measurement.project_id,
                    target_id=measurement.id,
                    occurred_at=measurement.updated_at,
                )
            )
        for request in db.scalars(
            select(CompletionRequest).where(
                CompletionRequest.project_id.in_(professor_projects),
                CompletionRequest.status == "pending",
            )
        ):
            items.append(
                ActionItemOut(
                    id=f"completion:{request.id}",
                    kind="completion_approval",
                    title="Review experiment completion request",
                    status=request.status,
                    project_id=request.project_id,
                    target_id=request.id,
                    occurred_at=request.requested_at,
                )
            )
    return sorted(items, key=lambda item: item.occurred_at, reverse=True)


ACTION_TITLES = {
    "measurement.created": "Created a measurement draft",
    "measurement.revised": "Revised a measurement draft",
    "measurement.submitted": "Submitted a measurement for review",
    "measurement.validated": "Validated a submitted measurement",
    "measurement.certified": "Certified a validated measurement",
    "measurement.rejected": "Returned a measurement for correction",
    "experiment.completion_requested": "Requested experiment completion",
    "experiment.completion_approved": "Approved experiment completion",
    "experiment.completion_rejected": "Returned an experiment completion request",
}


def user_name(db: Db, user_id: str | None) -> str | None:
    user = db.get(User, user_id) if user_id else None
    return user.display_name if user else None


def history_item(db: Db, event: AuditEvent, actor_name: str) -> ActionHistoryOut | None:
    title = ACTION_TITLES.get(event.action)
    if not title or not event.project_id or not event.actor_id:
        return None
    experiment_id = event.details.get("experiment_id")
    current_status = str(event.details.get("to") or event.details.get("status") or "recorded")
    reviewer_name = None
    if event.target_type == "measurement":
        measurement = db.get(Measurement, event.target_id)
        if measurement:
            experiment_id = measurement.experiment_id
            current_status = measurement.status
            reviewer_name = user_name(
                db, measurement.certified_by_id or measurement.validated_by_id
            )
    elif event.target_type == "completion_request":
        request = db.get(CompletionRequest, event.target_id)
        if request:
            experiment_id = request.experiment_id
            current_status = request.status
            reviewer_name = user_name(db, request.reviewed_by_id)
    return ActionHistoryOut(
        id=event.id,
        action=event.action,
        title=title,
        status=current_status,
        project_id=event.project_id,
        experiment_id=str(experiment_id) if experiment_id else None,
        target_id=event.target_id,
        occurred_at=event.occurred_at,
        actor_id=event.actor_id,
        actor_name=actor_name,
        reviewer_name=reviewer_name,
    )


@router.get("/actions/mine", response_model=list[ActionHistoryOut])
def my_action_history(db: Db, auth: Auth) -> list[ActionHistoryOut]:
    allowed_projects = project_ids(db, auth.user.id)
    if not allowed_projects:
        return []
    events = list(
        db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.actor_id == auth.user.id,
                AuditEvent.project_id.in_(allowed_projects),
                AuditEvent.action.in_(ACTION_TITLES),
            )
            .order_by(AuditEvent.occurred_at.desc())
            .limit(100)
        ).all()
    )
    return [
        item
        for event in events
        if (item := history_item(db, event, auth.user.display_name)) is not None
    ]


@router.get("/approvals", response_model=list[CompletionRequestOut])
def approvals(db: Db, auth: Auth) -> list[CompletionRequest]:
    ids = project_ids(db, auth.user.id, "professor")
    if not ids:
        return []
    return list(
        db.scalars(
            select(CompletionRequest)
            .where(
                CompletionRequest.project_id.in_(ids), CompletionRequest.status == "pending"
            )
            .order_by(CompletionRequest.requested_at)
        ).all()
    )

