import argparse
import getpass
import os

from sqlalchemy import select

from app.audit import add_audit_event
from app.database import SessionLocal
from app.models import (
    Experiment,
    Project,
    ProjectMembership,
    Reactor,
    User,
)
from app.security import hash_password, validate_bootstrap_password

ROLES = ("staff", "researcher", "professor")


def init_research(args: argparse.Namespace) -> None:
    with SessionLocal.begin() as db:
        project = db.scalar(select(Project).where(Project.code == args.project_code))
        if not project:
            project = Project(
                code=args.project_code,
                name=args.project_name,
                description="Local BioDry research project",
            )
            db.add(project)
            db.flush()
        reactor = db.scalar(
            select(Reactor).where(
                Reactor.project_id == project.id, Reactor.code == args.reactor_code
            )
        )
        if not reactor:
            reactor = Reactor(
                project_id=project.id,
                code=args.reactor_code,
                name=args.reactor_name,
            )
            db.add(reactor)
            db.flush()
        experiment = db.scalar(
            select(Experiment).where(
                Experiment.project_id == project.id,
                Experiment.code == args.experiment_code,
            )
        )
        if not experiment:
            experiment = Experiment(
                project_id=project.id,
                reactor_id=reactor.id,
                code=args.experiment_code,
                name=args.experiment_name,
                conditions="Local workflow validation; simulated temperature telemetry only.",
            )
            db.add(experiment)
            db.flush()
        add_audit_event(
            db,
            action="bootstrap.research_initialized",
            target_type="project",
            target_id=project.id,
            actor_id=None,
            project_id=project.id,
            details={"reactor_id": reactor.id, "experiment_id": experiment.id},
        )
    print(
        f"Research context ready: project={project.code}, "
        f"reactor={reactor.code}, experiment={experiment.code}"
    )


def create_user(args: argparse.Namespace) -> None:
    password = os.getenv("BIODRY_BOOTSTRAP_PASSWORD") or getpass.getpass(
        "Password (input hidden): "
    )
    validate_bootstrap_password(password)
    username = args.username.strip().lower()
    with SessionLocal.begin() as db:
        if db.scalar(select(User).where(User.username == username)):
            raise SystemExit("User already exists; no credentials were changed.")
        project = db.scalar(select(Project).where(Project.code == args.project_code))
        if not project:
            raise SystemExit("Project not found. Run init-research first.")
        user = User(
            username=username,
            display_name=args.display_name.strip(),
            password_hash=hash_password(password),
            role=args.role,
            is_system_admin=args.system_admin,
        )
        db.add(user)
        db.flush()
        db.add(ProjectMembership(user_id=user.id, project_id=project.id, role=args.role))
        add_audit_event(
            db,
            action="bootstrap.user_created",
            target_type="user",
            target_id=user.id,
            actor_id=None,
            project_id=project.id,
            details={"username": username, "role": args.role, "system_admin": args.system_admin},
        )
    print(f"User created: {username} ({args.role})")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="BioDry local administration")
    commands = root.add_subparsers(dest="command", required=True)
    init = commands.add_parser(
        "init-research", help="Create local project/reactor/experiment metadata"
    )
    init.add_argument("--project-code", default="BIODRY-LOCAL")
    init.add_argument("--project-name", default="BioDry Local Research")
    init.add_argument("--reactor-code", default="REACTOR-01")
    init.add_argument("--reactor-name", default="Connected Biodrying Reactor")
    init.add_argument("--experiment-code", default="EXP-LOCAL-001")
    init.add_argument("--experiment-name", default="Local Research Workflow")
    init.set_defaults(handler=init_research)

    user = commands.add_parser("create-user", help="Create one database-backed user")
    user.add_argument("--username", required=True)
    user.add_argument("--display-name", required=True)
    user.add_argument("--role", choices=ROLES, required=True)
    user.add_argument("--project-code", default="BIODRY-LOCAL")
    user.add_argument(
        "--system-admin",
        action="store_true",
        help="Grants technical administration only; scientific actions still require project role.",
    )
    user.set_defaults(handler=create_user)
    return root


def main() -> None:
    args = parser().parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()

