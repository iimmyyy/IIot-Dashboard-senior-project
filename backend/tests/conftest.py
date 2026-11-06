# ruff: noqa: E402, I001

import os
from collections.abc import Generator

os.environ["BIODRY_FRONTEND_ORIGIN"] = "http://testserver"
os.environ["BIODRY_ENVIRONMENT"] = "test"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Experiment, Project, ProjectMembership, Reactor, User
from app.security import hash_password


@pytest.fixture
def session_factory() -> Generator[sessionmaker[Session], None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def seeded(session_factory: sessionmaker[Session]) -> dict[str, str]:
    with session_factory.begin() as db:
        project = Project(code="TEST", name="Test Project")
        db.add(project)
        db.flush()
        reactor = Reactor(project_id=project.id, code="R-01", name="Test Reactor")
        db.add(reactor)
        db.flush()
        experiment = Experiment(
            project_id=project.id,
            reactor_id=reactor.id,
            code="EXP-TEST",
            name="Test Experiment",
        )
        db.add(experiment)
        users: dict[str, User] = {}
        for role in ("staff", "researcher", "professor"):
            user = User(
                username=role,
                display_name=f"{role.title()} Test",
                role=role,
                password_hash=hash_password(f"{role}-secure-test-password"),
            )
            db.add(user)
            db.flush()
            db.add(ProjectMembership(user_id=user.id, project_id=project.id, role=role))
            users[role] = user
    return {
        "project_id": project.id,
        "reactor_id": reactor.id,
        "experiment_id": experiment.id,
        **{f"{role}_id": user.id for role, user in users.items()},
    }


@pytest.fixture
def client(
    session_factory: sessionmaker[Session], seeded: dict[str, str]
) -> Generator[TestClient, None, None]:
    def override_db() -> Generator[Session, None, None]:
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    with TestClient(
        app,
        base_url="http://testserver",
        headers={"Origin": "http://testserver"},
    ) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def login(client: TestClient, role: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": role, "password": f"{role}-secure-test-password"},
    )
    assert response.status_code == 200, response.text
    return response.json()["csrf_token"]


def csrf_headers(token: str) -> dict[str, str]:
    return {"X-CSRF-Token": token, "Origin": "http://testserver"}

