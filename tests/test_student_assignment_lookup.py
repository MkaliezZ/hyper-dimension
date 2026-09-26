"""Student lookup returns only its own published questions and audits the open."""
from fastapi.testclient import TestClient

from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.local_education_api import create_local_education_app
from hyper_dimension.no_backend_model import NoBackendModel
from hyper_dimension.student_records import StudentRecords


def _bundle():
    return {
        "agent_version": "synthetic-teacher-v1",
        "questions": [
            {"id": "r1", "kind": "mcq", "prompt": "Where is the book?",
             "options": ["At school", "At home"]},
            {"id": "w1", "kind": "writing",
             "prompt": "Tell a friend where to meet."},
        ],
        "answer_key": {"r1": "At school"},
        "rubric": {
            "content": "Relevant", "communication": "Clear",
            "organisation": "Ordered", "language": "Understandable",
        },
    }


def test_student_lookup_is_private_answer_free_and_audited(tmp_path):
    assessment = AssessmentService(tmp_path / "synthetic.sqlite3", NoBackendModel())
    records = StudentRecords(assessment, tmp_path / "archive", teacher_id="teacher")
    assessment.authorize_policy(
        tenant_id="island", class_id="class-a", teacher_id="teacher",
        policy_id="policy", weights={
            "reading": 0.5, "content": 0.125, "communication": 0.125,
            "organisation": 0.125, "language": 0.125,
        },
    )
    first = records.create_student(
        tenant_id="island", class_id="class-a",
        display_name="Synthetic Alice", public_alias="Alice A",
        age=12, grade=7, book_id="demo", school_progress="Unit 1",
        guardian_consent_ref="synthetic-consent",
    )
    second = records.create_student(
        tenant_id="island", class_id="class-a",
        display_name="Synthetic Bob", public_alias="Bob B",
        age=12, grade=7, book_id="demo", school_progress="Unit 1",
        guardian_consent_ref="synthetic-consent",
    )
    first_bundle = assessment.publish_agent_bundle(
        "island", first["student_ref"], _bundle(),
        idempotency_key="assignment-a",
    )
    second_bundle = assessment.publish_agent_bundle(
        "island", second["student_ref"], _bundle(),
        idempotency_key="assignment-b",
    )
    client = TestClient(create_local_education_app(
        assessment, records, tenant_id="island", teacher_id="teacher",
        teacher_token="synthetic-teacher-token-32-characters",
        agent_native=True,
    ))
    path = "/api/v1/student/assignments/lookup"
    request = {
        "access_code": first["access_code"],
        "signed_name": "Synthetic Alice",
        "bundle_ref": first_bundle["bundle_id"],
    }
    response = client.post(path, json=request)
    assert response.status_code == 200
    body = response.json()
    assert body["bundle_id"] == first_bundle["bundle_id"]
    assert body["questions"][0]["options"] == ["At school", "At home"]
    assert "answer_key" not in str(body)
    assert "rubric" not in str(body)
    assert "At school" not in str(body.get("answer_key", ""))
    assert body["audit_event_id"].startswith("evt_")
    with assessment._db() as db:
        event = db.execute(
            "SELECT event_type,student_id,object_ref FROM audit_events WHERE event_id=?",
            (body["audit_event_id"],),
        ).fetchone()
    assert tuple(event) == (
        "bundle.opened", first["student_ref"], first_bundle["bundle_id"],
    )

    assert client.post(
        path, json={**request, "signed_name": "Synthetic Bob"},
    ).status_code == 422
    assert client.post(
        path, json={**request, "bundle_ref": second_bundle["bundle_id"]},
    ).status_code == 422

    submitted = client.post("/api/v1/student/attempts", json={
        **request, "attempt_ref": "synthetic-attempt-1",
        "idempotency_key": "synthetic-submit-1",
        "answers": {"r1": "At school", "w1": "Meet me at school."},
    })
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"
    assessment.revoke_consent(
        "island", first["student_ref"], "synthetic-guardian",
    )
    assert client.post(path, json=request).status_code == 422
