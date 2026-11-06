from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.audit import add_audit_event
from app.dependencies import Auth, CsrfAuth, Db, require_project_role
from app.models import CompletionRequest, Experiment, Measurement, ProjectMembership
from app.schemas import (
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
        details={"comment": payload.comment},
    )
    db.commit()
    db.refresh(request)
    return request


@router.get("/actions/mine", response_model=list[ActionItemOut])
def my_actions(db: Db, auth: Auth) -> list[ActionItemOut]:
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

