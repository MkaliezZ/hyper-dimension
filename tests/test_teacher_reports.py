"""Teacher report views stay private and show only approved results."""
from fastapi.testclient import TestClient

from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.local_education_api import create_local_education_app
from hyper_dimension.no_backend_model import NoBackendModel
from hyper_dimension.student_records import StudentRecords


def test_teacher_pending_attempts_and_approved_reports(tmp_path):
    assessment = AssessmentService(tmp_path / "synthetic.sqlite3", NoBackendModel())
    records = StudentRecords(assessment, tmp_path / "archive", teacher_id="teacher-a")
    weights = {
        "reading": 0.5, "content": 0.125, "communication": 0.125,
        "organisation": 0.125, "language": 0.125,
    }
    assessment.authorize_policy(
        tenant_id="island-a", class_id="class-a", teacher_id="teacher-a",
        policy_id="policy-a", weights=weights,
    )
    assessment.authorize_policy(
        tenant_id="island-a", class_id="class-other", teacher_id="teacher-b",
        policy_id="policy-b", weights=weights,
    )
    student = records.create_student(
        tenant_id="island-a", class_id="class-a",
        display_name="Synthetic A", public_alias="Alias A", age=12, grade=7,
        book_id="demo", school_progress="Unit 1",
        guardian_consent_ref="synthetic-consent",
    )
    other = records.create_student(
        tenant_id="island-a", class_id="class-other",
        display_name="Synthetic B", public_alias="Alias B", age=12, grade=7,
        book_id="demo", school_progress="Unit 1",
        guardian_consent_ref="synthetic-consent",
    )
    bundle = assessment.publish_agent_bundle(
        "island-a", student["student_ref"], {
            "agent_version": "synthetic-agent-v1",
            "questions": [
                {"id": "r1", "kind": "mcq", "prompt": "Choose the place.",
                 "options": ["library", "park"]},
                {"id": "w1", "kind": "writing", "prompt": "Invite a friend."},
            ],
            "answer_key": {"r1": "library"},
            "rubric": {
                "content": "Relevant", "communication": "Clear",
                "organisation": "Ordered", "language": "Understandable",
            },
        },
        idempotency_key="bundle-a",
    )
    assessment.submit(
        tenant_id="island-a", student_id=student["student_ref"],
        bundle_id=bundle["bundle_id"], attempt_id="attempt-a",
        idempotency_key="submit-a",
        answers={"r1": "library", "w1": "Please meet me at the library."},
        auto_process=False,
    )
    client = TestClient(create_local_education_app(
        assessment, records, tenant_id="island-a", teacher_id="teacher-a",
        teacher_token="synthetic-teacher-token-32-characters",
        agent_native=True,
    ))
    headers = {"Authorization": "Bearer synthetic-teacher-token-32-characters"}
    # A token for teacher A must not expose tenant-local records of teacher B.
    other_path = "/api/v1/teacher/students/" + other["student_ref"]
    assert client.get("/api/v1/teacher/classes/class-other/students",
                      headers=headers).status_code == 422
    assert client.get(other_path, headers=headers).status_code == 422
    assert client.get(other_path + "/archive", headers=headers).status_code == 422
    assert client.put(other_path, headers=headers, json={
        "expected_version": 1, "display_name": "Synthetic B",
        "public_alias": "Alias B", "teacher_notes": "must stay private",
        "learning_goals": "None",
    }).status_code == 422
    assert client.post(other_path + "/notes", headers=headers, json={
        "evidence_ref": "synthetic-evidence", "title": "Private",
        "note": "Must be rejected",
    }).status_code == 422
    assert client.get(
        "/api/v1/teacher/students/" + student["student_ref"], headers=headers,
    ).status_code == 200
    pending_path = "/api/v1/teacher/classes/class-a/pending-attempts"
    reports_path = "/api/v1/teacher/students/" + student["student_ref"] + "/reports"
    assert client.get(pending_path).status_code == 401
    assert client.get(reports_path).status_code == 401
    pending = client.get(pending_path, headers=headers).json()["attempts"]
    assert len(pending) == 1
    assert pending[0]["attempt_id"] == "attempt-a"
    assert client.get(
        "/api/v1/teacher/classes/class-other/pending-attempts", headers=headers,
    ).status_code == 422
    assert client.get(reports_path, headers=headers).json()["reports"] == []
    assert client.get(
        "/api/v1/teacher/students/" + other["student_ref"] + "/reports",
        headers=headers,
    ).status_code == 422

    completed = assessment.process_attempt(
        "island-a", student["student_ref"], "attempt-a",
        agent_supplied=True,
        critique={
            "scores": {key: 80 for key in (
                "content", "communication", "organisation", "language",
            )},
            "confidence": 0.95, "evidence": "Clear invitation.",
            "agent_version": "synthetic-agent-v1",
        },
        narrative={
            "summary": "Synthetic writing diagnosis.",
            "strengths": ["Purpose"], "needs_work": ["Detail"],
            "next_steps": ["Try a second invitation"],
        },
    )
    assert completed["status"] == "approved"
    assert client.get(pending_path, headers=headers).json()["attempts"] == []
    summaries = client.get(reports_path, headers=headers).json()["reports"]
    assert len(summaries) == 1
    assert summaries[0]["report_ref"] == completed["report_id"]
    assert summaries[0]["summary"] == "Synthetic writing diagnosis."
    assert "Please meet me" not in str(summaries)
    detail_path = reports_path + "/" + completed["report_id"]
    assert client.get(detail_path).status_code == 401
    detail = client.get(detail_path, headers=headers).json()
    assert detail["summary"] == "Synthetic writing diagnosis."
    assert detail["breakdown"]["communication"] == 80
    assert client.get(
        "/api/v1/teacher/students/" + other["student_ref"]
        + "/reports/" + completed["report_id"], headers=headers,
    ).status_code == 422
