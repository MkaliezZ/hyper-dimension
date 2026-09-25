import asyncio

import pytest
from jsonschema import ValidationError

from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService
from hyper_dimension.education_command import (
    command_from_a2a_part, command_to_a2a_part, validate_command,
    validate_command_result, result_to_a2a_part,
)
from hyper_dimension.student_records import StudentRecords
from hyper_dimension.teacher_mcp import create_teacher_mcp


class DemoAgent:
    def generate(self, profile, policy):
        return {
            "agent_version": "synthetic-v1",
            "questions": [
                {"id": "r1", "kind": "mcq", "prompt": "Where is the library?",
                 "options": ["Here", "There"]},
                {"id": "w1", "kind": "writing", "prompt": "Invite a friend."},
            ],
            "answer_key": {"r1": "Here"},
            "rubric": {key: "Synthetic criterion" for key in
                       ("content", "communication", "organisation", "language")},
        }

    def grade_writing(self, bundle, answer):
        return {
            "scores": {key: 80 for key in
                       ("content", "communication", "organisation", "language")},
            "confidence": 0.9, "evidence": "Synthetic writing evidence",
        }

    def draft_report(self, context):
        return {
            "summary": "Synthetic report", "strengths": ["Reading"],
            "needs_work": ["Writing"], "next_steps": ["Practice"],
        }


@pytest.fixture
def setup(tmp_path):
    assessment = AssessmentService(tmp_path / "db.sqlite3", DemoAgent())
    records = StudentRecords(assessment, tmp_path / "private", teacher_id="teacher-1")
    student = records.create_student(
        tenant_id="island-1", class_id="class-1", display_name="Lin Mei",
        public_alias="Star One", age=12, grade=7, book_id="demo-book",
        school_progress="Unit 1", guardian_consent_ref="synthetic-consent",
    )
    assessment.authorize_policy(
        tenant_id="island-1", class_id="class-1", teacher_id="teacher-1",
        policy_id="policy-1", weights={
            "reading": 0.5, "content": 0.125, "communication": 0.125,
            "organisation": 0.125, "language": 0.125,
        },
    )
    return assessment, records, student


def command(student_ref):
    return {
        "protocol_version": "1.1",
        "operation": "hd.education.student.profile.read.v1",
        "request_id": "req-1",
        "island_id": "island-1",
        "student_ref": student_ref,
        "idempotency_key": "read-1",
        "purpose": "student_record",
        "payload": {},
    }


def test_a2a_command_is_structured_and_unambiguous(setup):
    _, _, student = setup
    request = command(student["student_ref"])
    part = command_to_a2a_part(request)
    assert command_from_a2a_part(part) == request
    for bad in (
        {"text": "Please publish this student's score"},
        {"kind": "data", "data": request},
        {"data": request, "mediaType": "text/plain"},
    ):
        with pytest.raises(ValidationError):
            command_from_a2a_part(bad)
    request["operation"] = "hd.education.showcase.publish.v1"
    with pytest.raises(ValidationError):
        validate_command(request)


def test_command_operation_payload_and_purpose_are_bound(setup):
    _, _, student = setup
    request = command(student["student_ref"])
    request["operation"] = "hd.education.student.profile.update.v1"
    with pytest.raises(ValidationError):
        validate_command(request)
    request["payload"] = {
        "expected_version": 1, "display_name": "Lin Mei",
        "public_alias": "Star One", "teacher_notes": "",
        "learning_goals": "",
    }
    validate_command(request)
    request["purpose"] = "public_showcase"
    with pytest.raises(ValidationError):
        validate_command(request)
    request["purpose"] = "student_record"
    request["actor_id"] = "forged-teacher"
    with pytest.raises(ValidationError):
        validate_command(request)


def test_mcp_tools_are_teacher_scoped_and_do_not_publish(setup):
    assessment, records, student = setup
    server = create_teacher_mcp(
        assessment, records, tenant_id="island-1", teacher_id="teacher-1",
    )
    tools = asyncio.run(server.list_tools())
    names = {tool.name for tool in tools}
    assert "student_profile_read" in names
    assert "assessment_assignment_create" in names
    assert "showcase_draft_create" in names
    assert not any("publish" in name for name in names)
    profile = asyncio.run(
        server._tool_manager.call_tool(
            "student_profile_read", {"student_ref": student["student_ref"]},
        )
    )
    assert profile["display_name"] == "Lin Mei"
    first = asyncio.run(
        server._tool_manager.call_tool(
            "assessment_assignment_create",
            {"student_ref": student["student_ref"], "idempotency_key": "task-1"},
        )
    )
    second = asyncio.run(
        server._tool_manager.call_tool(
            "assessment_assignment_create",
            {"student_ref": student["student_ref"], "idempotency_key": "task-1"},
        )
    )
    assert first == second
    other_server = create_teacher_mcp(
        assessment, records, tenant_id="another-island", teacher_id="teacher-1",
    )
    with pytest.raises(Exception):
        asyncio.run(
            other_server._tool_manager.call_tool(
                "student_profile_read", {"student_ref": student["student_ref"]},
            )
        )



def test_local_api_authentication_archive_and_publication(setup):
    from fastapi.testclient import TestClient
    from hyper_dimension.local_education_api import create_local_education_app

    assessment, records, student = setup
    token = "synthetic-teacher-token-very-long"
    client = TestClient(create_local_education_app(
        assessment, records, tenant_id="island-1",
        teacher_id="teacher-1", teacher_token=token,
    ))
    ref = student["student_ref"]
    base = f"/api/v1/teacher/students/{ref}"
    assert client.get(base).status_code == 401
    headers = {"Authorization": "Bearer " + token}
    assert client.get(base, headers=headers).json()["student_id"] == ref
    assignment = client.post(
        base + "/assignments", headers=headers,
        json={"idempotency_key": "assignment-demo"},
    ).json()
    assert assignment["bundle_id"]
    assert client.post(
        base + "/assignments", headers=headers,
        json={"idempotency_key": "assignment-demo"},
    ).json() == assignment
    bad = client.post("/api/v1/student/attempts", json={
        "access_code": student["access_code"], "signed_name": "Another Student",
        "bundle_ref": assignment["bundle_id"], "attempt_ref": "attempt-demo",
        "idempotency_key": "submit-demo",
        "answers": {"r1": "Here", "w1": "Please come."},
    })
    assert bad.status_code == 422
    good = client.post("/api/v1/student/attempts", json={
        "access_code": student["access_code"], "signed_name": "Lin Mei",
        "bundle_ref": assignment["bundle_id"], "attempt_ref": "attempt-demo",
        "idempotency_key": "submit-demo",
        "answers": {"r1": "Here", "w1": "Please come."},
    })
    assert good.status_code == 200
    result = good.json()
    assert result["status"] == "approved"
    assert result["archive"]["artifact_id"]
    assert client.get(base + "/archive", headers=headers).status_code == 200
    assert client.get("/api/v1/showcase").json()["entries"] == []
    note = client.post(base + "/notes", headers=headers, json={
        "evidence_ref": "teacher-observation-demo", "title": "Reading",
        "note": "Synthetic observed work.",
    }).json()
    consent = client.post(base + "/publication-consents", headers=headers, json={
        "guardian_ref": "synthetic-guardian",
        "evidence_ref": "synthetic-signed-form",
        "allowed_fields": ["alias", "honor"],
    }).json()
    draft = client.post(base + "/showcase-drafts", headers=headers, json={
        "slot": "honors", "kind": "honor", "title": "Reading milestone",
        "summary": "Completed a reading challenge.", "metrics": {},
        "source_artifact_ref": note["artifact_id"],
        "publication_consent_ref": consent["consent_ref"],
    }).json()
    assert client.get("/api/v1/showcase").json()["entries"] == []
    assert client.post(
        base + "/showcase-drafts/" + draft["entry_ref"] + "/publish",
    ).status_code == 401
    assert client.post(
        base + "/showcase-drafts/" + draft["entry_ref"] + "/publish",
        headers=headers,
    ).status_code == 200
    cards = client.get("/api/v1/showcase").json()["entries"]
    assert len(cards) == 1 and cards[0]["student_alias"] == "Star One"
    assert "student_id" not in cards[0]



def test_a2a_result_has_explicit_status_and_no_records_on_rejection():
    result = {
        "protocol_version": "1.1",
        "request_id": "req-1",
        "operation": "hd.education.student.profile.read.v1",
        "status": "completed",
        "reason_code": "OK",
        "record_refs": [{"kind": "profile", "ref": "profile-v1"}],
        "audit_event_id": "evt-demo",
    }
    assert result_to_a2a_part(result)["data"] == result
    result["status"] = "rejected"
    with pytest.raises(ValidationError):
        validate_command_result(result)
    result["reason_code"] = "UNAUTHORIZED"
    result["record_refs"] = []
    validate_command_result(result)
