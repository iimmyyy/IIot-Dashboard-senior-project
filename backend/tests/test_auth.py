from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.models import AuthSession
from tests.conftest import csrf_headers, login


def test_database_login_me_and_revoked_logout(client: TestClient) -> None:
    csrf = login(client, "staff")
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["role"] == "staff"
    assert me.json()["memberships"][0]["project_code"] == "TEST"

    assert client.post("/api/v1/auth/logout", headers=csrf_headers(csrf)).status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_requires_csrf(client: TestClient) -> None:
    login(client, "researcher")
    assert client.post("/api/v1/auth/logout").status_code == 403
    assert client.get("/api/v1/auth/me").status_code == 200


def test_expired_session_is_rejected(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    login(client, "professor")
    with session_factory.begin() as db:
        session = db.scalar(select(AuthSession))
        assert session is not None
        session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_login_rate_limit_is_database_backed(client: TestClient) -> None:
    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "staff", "password": "wrong-password"},
        )
        assert response.status_code == 401
    blocked = client.post(
        "/api/v1/auth/login",
        json={"username": "staff", "password": "staff-secure-test-password"},
    )
    assert blocked.status_code == 429
    assert blocked.headers["retry-after"]


def test_mutations_require_expected_origin(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": "http://attacker.invalid"},
        json={"username": "staff", "password": "staff-secure-test-password"},
    )
    assert response.status_code == 403

