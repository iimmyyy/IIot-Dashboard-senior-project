from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.audit import add_audit_event
from app.dependencies import Auth, CsrfAuth, Db, require_project_role
from app.models import Experiment, ProjectMembership, Reactor
from app.schemas import ExperimentCreate, ExperimentOut

router = APIRouter(prefix="/experiments", tags=["experiments"])


def visible_project_ids(db: Db, user_id: str) -> list[str]:
    return list(
        db.scalars(
            select(ProjectMembership.project_id).where(ProjectMembership.user_id == user_id)
        ).all()
    )


@router.get("", response_model=list[ExperimentOut])
def list_experiments(db: Db, auth: Auth) -> list[Experiment]:
    project_ids = visible_project_ids(db, auth.user.id)
    if not project_ids:
        return []
    return list(
        db.scalars(
            select(Experiment)
            .where(Experiment.project_id.in_(project_ids))
            .order_by(Experiment.start_at.desc())
        ).all()
    )


@router.get("/{experiment_id}", response_model=ExperimentOut)
def get_experiment(experiment_id: str, db: Db, auth: Auth) -> Experiment:
    experiment = db.get(Experiment, experiment_id)
    if not experiment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found.")
    require_project_role(db, auth, experiment.project_id, {"staff", "researcher", "professor"})
    return experiment


@router.post("", response_model=ExperimentOut, status_code=status.HTTP_201_CREATED)
def create_experiment(payload: ExperimentCreate, db: Db, auth: CsrfAuth) -> Experiment:
    require_project_role(db, auth, payload.project_id, {"professor"})
    reactor = db.get(Reactor, payload.reactor_id)
    if not reactor or reactor.project_id != payload.project_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid reactor."
        )
    if db.scalar(
        select(Experiment).where(
            Experiment.project_id == payload.project_id, Experiment.code == payload.code
        )
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Experiment code exists.")
    experiment = Experiment(**payload.model_dump())
    db.add(experiment)
    db.flush()
    add_audit_event(
        db,
        action="experiment.created",
        target_type="experiment",
        target_id=experiment.id,
        actor_id=auth.user.id,
        project_id=experiment.project_id,
        details={"code": experiment.code},
    )
    db.commit()
    db.refresh(experiment)
    return experiment

