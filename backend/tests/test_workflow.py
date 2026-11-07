from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.models import AuditEvent, Experiment, Measurement
from tests.conftest import csrf_headers, login

VALUES = {
    "temperature_top_c": 58.1,
    "temperature_middle_c": 60.2,
    "temperature_bottom_c": 55.4,
    "temperature_core_c": None,
    "temperature_air_c": None,
    "below_peak_c": None,
    "bottom_slope_c_per_day": None,
    "drying_rate_kg_per_day": None,
    "eta": None,
    "nl_kg": None,
    "total_weight_kg": None,
    "leachate_kg": None,
    "height_m": None,
    "ar_m3_per_kg_per_day": None,
    "oxygen_core_percent": None,
    "carbon_dioxide_core_percent": None,
}


def create_record(client: TestClient, csrf: str, experiment_id: str) -> dict[str, object]:
    response = client.post(
        "/api/v1/daily-records",
        headers=csrf_headers(csrf),
        json={
            "experiment_id": experiment_id,
            "record_date": "2026-11-06",
            "historical_label": "current",
            "values": VALUES,
            "revision_reason": "Initial field entry",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_staff_researcher_professor_happy_path(
    client: TestClient, seeded: dict[str, str], session_factory: sessionmaker[Session]
) -> None:
    staff_csrf = login(client, "staff")
    record = create_record(client, staff_csrf, seeded["experiment_id"])
    assert record["status"] == "draft"
    record_id = str(record["id"])
    assert (
        client.post(
            f"/api/v1/measurements/{record_id}/submit",
            headers=csrf_headers(staff_csrf),
            json={"comment": "Field entry complete"},
        ).json()["status"]
        == "submitted"
    )

    researcher_csrf = login(client, "researcher")
    assert (
        client.post(
            f"/api/v1/measurements/{record_id}/validate",
            headers=csrf_headers(researcher_csrf),
            json={"comment": "Values reviewed"},
        ).json()["status"]
        == "validated"
    )

    professor_csrf = login(client, "professor")
    assert (
        client.post(
            f"/api/v1/measurements/{record_id}/certify",
            headers=csrf_headers(professor_csrf),
            json={"comment": "Research record certified"},
        ).json()["status"]
        == "certified"
    )

    researcher_csrf = login(client, "researcher")
    completion = client.post(
        f"/api/v1/experiments/{seeded['experiment_id']}/completion-requests",
        headers=csrf_headers(researcher_csrf),
        json={"rationale": "Certified measurements support completion review."},
    )
    assert completion.status_code == 201, completion.text

    professor_csrf = login(client, "professor")
    approved = client.post(
        f"/api/v1/approvals/{completion.json()['id']}/approve",
        headers=csrf_headers(professor_csrf),
        json={"comment": "Approved after reviewing the certified record."},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    with session_factory() as db:
        record = db.scalar(select(Measurement).where(Measurement.id == record_id))
        assert record is not None
        assert record.status == "certified"
        assert db.get(Experiment, seeded["experiment_id"]).status == "completed"
        actions = list(db.scalars(select(AuditEvent.action)).all())
        assert "measurement.created" in actions
        assert "measurement.submitted" in actions
        assert "measurement.validated" in actions
        assert "measurement.certified" in actions
        assert "experiment.completion_approved" in actions


def test_unauthenticated_is_401_and_wrong_role_is_403(
    client: TestClient, seeded: dict[str, str]
) -> None:
    client.cookies.clear()
    assert client.get("/api/v1/daily-records").status_code == 401

    staff_csrf = login(client, "staff")
    record = create_record(client, staff_csrf, seeded["experiment_id"])
    client.post(
        f"/api/v1/measurements/{record['id']}/submit",
        headers=csrf_headers(staff_csrf),
        json={"comment": "Ready for review"},
    )
    response = client.post(
        f"/api/v1/measurements/{record['id']}/validate",
        headers=csrf_headers(staff_csrf),
        json={"comment": "Staff cannot validate"},
    )
    assert response.status_code == 403


def test_completion_request_requires_certified_record(
    client: TestClient, seeded: dict[str, str]
) -> None:
    researcher_csrf = login(client, "researcher")
    response = client.post(
        f"/api/v1/experiments/{seeded['experiment_id']}/completion-requests",
        headers=csrf_headers(researcher_csrf),
        json={"rationale": "All approved research observations have been reviewed."},
    )
    assert response.status_code == 409


def test_audit_event_is_immutable(
    client: TestClient, seeded: dict[str, str], session_factory: sessionmaker[Session]
) -> None:
    csrf = login(client, "staff")
    create_record(client, csrf, seeded["experiment_id"])
    with session_factory() as db:
        event = db.scalar(select(AuditEvent).where(AuditEvent.action == "measurement.created"))
        assert event is not None
        event.action = "tampered"
        try:
            db.commit()
        except ValueError as error:
            assert "append-only" in str(error)
            db.rollback()
        else:
            raise AssertionError("Audit event update unexpectedly succeeded")

