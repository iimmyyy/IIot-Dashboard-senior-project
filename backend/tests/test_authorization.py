from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session, sessionmaker

from app.models import Measurement
from tests.conftest import csrf_headers, login
from tests.test_workflow import VALUES


def create_record(
    client: TestClient,
    csrf: str,
    experiment_id: str,
    *,
    label: str,
) -> dict[str, object]:
    response = client.post(
        "/api/v1/daily-records",
        headers=csrf_headers(csrf),
        json={
            "experiment_id": experiment_id,
            "record_date": "2026-11-07",
            "historical_label": label,
            "values": VALUES,
            "revision_reason": "Authorization regression test",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_staff_cannot_change_or_submit_another_staff_members_record(
    client: TestClient, seeded: dict[str, str]
) -> None:
    owner_csrf = login(client, "staff")
    record = create_record(
        client, owner_csrf, seeded["experiment_id"], label="staff-owned"
    )

    coworker_csrf = login(client, "staff2")
    update_response = client.put(
        f"/api/v1/daily-records/{record['id']}",
        headers=csrf_headers(coworker_csrf),
        json={
            "values": VALUES,
            "revision_reason": "Attempted coworker revision",
        },
    )
    submit_response = client.post(
        f"/api/v1/measurements/{record['id']}/submit",
        headers=csrf_headers(coworker_csrf),
        json={"comment": "Attempted coworker submission"},
    )

    assert update_response.status_code == 403
    assert submit_response.status_code == 403


def test_staff_edit_window_blocks_late_revision_and_submission(
    client: TestClient,
    seeded: dict[str, str],
    session_factory: sessionmaker[Session],
) -> None:
    csrf = login(client, "staff")
    record = create_record(
        client, csrf, seeded["experiment_id"], label="expired-window"
    )
    expired_at = datetime.now(UTC) - timedelta(hours=25)
    with session_factory.begin() as db:
        db.execute(
            update(Measurement)
            .where(Measurement.id == record["id"])
            .values(created_at=expired_at)
        )

    revision = client.put(
        f"/api/v1/daily-records/{record['id']}",
        headers=csrf_headers(csrf),
        json={"values": VALUES, "revision_reason": "Late correction"},
    )
    submission = client.post(
        f"/api/v1/measurements/{record['id']}/submit",
        headers=csrf_headers(csrf),
        json={"comment": "Late submission"},
    )

    assert revision.status_code == 403
    assert submission.status_code == 403
    assert "editing window has closed" in revision.json()["detail"]


def test_every_project_role_can_enter_measurements(
    client: TestClient, seeded: dict[str, str]
) -> None:
    for role in ("staff", "researcher", "professor"):
        csrf = login(client, role)
        record = create_record(
            client, csrf, seeded["experiment_id"], label=f"entry-{role}"
        )
        assert record["created_by_id"] == seeded[f"{role}_id"]


def test_audit_permissions_follow_project_membership_and_experiment_scope(
    client: TestClient, seeded: dict[str, str]
) -> None:
    staff_csrf = login(client, "staff")
    create_record(client, staff_csrf, seeded["experiment_id"], label="audit-event")
    assert client.get("/api/v1/audit-events").status_code == 403
    assert (
        client.get(
            "/api/v1/audit-events",
            params={"experiment_id": seeded["experiment_id"]},
        ).status_code
        == 403
    )

    login(client, "researcher")
    assert client.get("/api/v1/audit-events").status_code == 400
    scoped = client.get(
        "/api/v1/audit-events",
        params={"experiment_id": seeded["experiment_id"]},
    )
    assert scoped.status_code == 200
    assert scoped.json()
    assert {event["project_id"] for event in scoped.json()} == {
        seeded["project_id"]
    }
    assert (
        client.get(
            "/api/v1/audit-events",
            params={"experiment_id": seeded["second_experiment_id"]},
        ).status_code
        == 403
    )

    login(client, "professor")
    professor_view = client.get(
        "/api/v1/audit-events", params={"project_id": seeded["project_id"]}
    )
    assert professor_view.status_code == 200
    assert professor_view.json()


def test_selected_project_role_controls_validation(
    client: TestClient, seeded: dict[str, str]
) -> None:
    researcher_csrf = login(client, "researcher")
    record = create_record(
        client,
        researcher_csrf,
        seeded["second_experiment_id"],
        label="staff-membership",
    )
    submitted = client.post(
        f"/api/v1/measurements/{record['id']}/submit",
        headers=csrf_headers(researcher_csrf),
        json={"comment": "Entered while assigned as Staff"},
    )
    assert submitted.status_code == 200
    validation = client.post(
        f"/api/v1/measurements/{record['id']}/validate",
        headers=csrf_headers(researcher_csrf),
        json={"comment": "Global role must not grant project access"},
    )
    assert validation.status_code == 403


def test_pending_queue_and_personal_history_are_separate_across_accounts(
    client: TestClient, seeded: dict[str, str]
) -> None:
    staff_csrf = login(client, "staff")
    record = create_record(
        client, staff_csrf, seeded["experiment_id"], label="timeline"
    )
    client.post(
        f"/api/v1/measurements/{record['id']}/submit",
        headers=csrf_headers(staff_csrf),
        json={"comment": "Ready for review"},
    )
    staff_history = client.get("/api/v1/actions/mine")
    assert staff_history.status_code == 200
    assert {item["action"] for item in staff_history.json()} >= {
        "measurement.created",
        "measurement.submitted",
    }
    assert client.get("/api/v1/actions/pending").json() == []

    researcher_csrf = login(client, "researcher")
    pending = client.get("/api/v1/actions/pending").json()
    assert [item["kind"] for item in pending] == ["measurement_validation"]
    client.post(
        f"/api/v1/measurements/{record['id']}/validate",
        headers=csrf_headers(researcher_csrf),
        json={"comment": "Reviewed values"},
    )
    researcher_history = client.get("/api/v1/actions/mine").json()
    assert [item["action"] for item in researcher_history] == [
        "measurement.validated"
    ]

    professor_csrf = login(client, "professor")
    pending = client.get("/api/v1/actions/pending").json()
    assert [item["kind"] for item in pending] == ["measurement_certification"]
    client.post(
        f"/api/v1/measurements/{record['id']}/certify",
        headers=csrf_headers(professor_csrf),
        json={"comment": "Certified research record"},
    )
    professor_history = client.get("/api/v1/actions/mine").json()
    assert [item["action"] for item in professor_history] == [
        "measurement.certified"
    ]

    login(client, "staff")
    final_history = client.get("/api/v1/actions/mine").json()
    assert all(item["actor_id"] == seeded["staff_id"] for item in final_history)
    assert {item["status"] for item in final_history} == {"certified"}
    assert {item["reviewer_name"] for item in final_history} == {
        "Professor Test"
    }
