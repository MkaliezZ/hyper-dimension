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
from hyper_dimension.no_backend_model import NoBackendModel


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
    # If any MCP tool tries to use a platform model, the test fails closed.
    assessment.agent = NoBackendModel()
    server = create_teacher_mcp(
        assessment, records, tenant_id="island-1", teacher_id="teacher-1",
    )
    names = {tool.name for tool in asyncio.run(server.list_tools())}
    assert "student_profile_read" in names
    assert "assessment_assignment_create" not in names
    assert {"assessment_generation_context_read", "assessment_bundle_submit",
            "assessment_pending_attempts_read", "assessment_grading_context_read",
            "assessment_grade_submit"} <= names
    assert not any("publish" in name for name in names)

    def call(name, **arguments):
        return asyncio.run(server._tool_manager.call_tool(name, arguments))

    ref = student["student_ref"]
    context = call("assessment_generation_context_read", student_ref=ref)
    assert context["profile"]["student_id"] == ref
    assert context["policy"]["teacher_id"] == "teacher-1"
    bundle = DemoAgent().generate(context["profile"], context["policy"])
    first = call("assessment_bundle_submit", student_ref=ref,
                 idempotency_key="task-1", bundle=bundle)
    assert call("assessment_bundle_submit", student_ref=ref,
                idempotency_key="task-1", bundle=bundle) == first
    assert "answer_key" not in first
    changed = {**bundle, "answer_key": {"r1": "There"}}
    with pytest.raises(Exception):
        call("assessment_bundle_submit", student_ref=ref,
             idempotency_key="task-1", bundle=changed)
    submitted = assessment.submit(
        tenant_id="island-1", student_id=ref, bundle_id=first["bundle_id"],
        attempt_id="attempt-mcp", idempotency_key="submit-mcp",
        answers={"r1": "There", "w1": "Please join me tomorrow."},
        auto_process=False,
    )
    assert submitted["status"] == "submitted"
    queue = call("assessment_pending_attempts_read", class_ref="class-1")
    assert len(queue["attempts"]) == 1
    grading = call("assessment_grading_context_read",
                   student_ref=ref, attempt_ref="attempt-mcp")
    assert grading["writing"]["answer"] == "Please join me tomorrow."
    assert grading["objective_result"] == {"score": 0.0, "wrong_item_ids": ["r1"]}
    assert "answer_key" not in str(grading)
    critique = DemoAgent().grade_writing({}, grading["writing"]["answer"])
    critique["agent_version"] = "teacher-agent-synthetic-v1"
    narrative = DemoAgent().draft_report({})
    with pytest.raises(Exception):
        call("assessment_grade_submit", student_ref=ref, attempt_ref="attempt-mcp",
             critique={**critique, "confidence": 2}, narrative=narrative)
    result = call("assessment_grade_submit", student_ref=ref,
                  attempt_ref="attempt-mcp", critique=critique, narrative=narrative)
    assert result["status"] == "approved"
    assert result["archive"]["artifact_id"]
    assert assessment.report("island-1", ref, result["report_id"])["summary"] == "Synthetic report"
    assert call("assessment_pending_attempts_read", class_ref="class-1")["attempts"] == []
    assert call("assessment_grade_submit", student_ref=ref,
                attempt_ref="attempt-mcp", critique=critique, narrative=narrative) == result

    other_server = create_teacher_mcp(
        assessment, records, tenant_id="another-island", teacher_id="teacher-1",
    )
    with pytest.raises(Exception):
        asyncio.run(other_server._tool_manager.call_tool(
            "student_profile_read", {"student_ref": ref},
        ))
    another_teacher_records = StudentRecords(
        assessment, records.archive_root, teacher_id="teacher-2",
    )
    other_teacher_server = create_teacher_mcp(
        assessment, another_teacher_records,
        tenant_id="island-1", teacher_id="teacher-2",
    )
    with pytest.raises(Exception):
        asyncio.run(other_teacher_server._tool_manager.call_tool(
            "student_profile_read", {"student_ref": ref},
        ))
    with pytest.raises(Exception):
        asyncio.run(other_teacher_server._tool_manager.call_tool(
            "assessment_pending_attempts_read", {"class_ref": "class-1"},
        ))



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



def test_agent_native_local_api_waits_for_teacher_mcp_grading(setup):
    from fastapi.testclient import TestClient
    from hyper_dimension.local_education_api import create_local_education_app

    assessment, records, student = setup
    assessment.agent = NoBackendModel()
    token = "synthetic-teacher-token-very-long"
    client = TestClient(create_local_education_app(
        assessment, records, tenant_id="island-1", teacher_id="teacher-1",
        teacher_token=token, agent_native=True,
    ))
    ref = student["student_ref"]
    teacher_base = f"/api/v1/teacher/students/{ref}"
    headers = {"Authorization": "Bearer " + token}
    assert client.post(
        teacher_base + "/assignments", headers=headers,
        json={"idempotency_key": "api-native"},
    ).status_code == 409
    bundle = assessment.publish_agent_bundle(
        "island-1", ref, DemoAgent().generate({}, {}),
        idempotency_key="api-native",
    )
    response = client.post("/api/v1/student/attempts", json={
        "access_code": student["access_code"], "signed_name": "Lin Mei",
        "bundle_ref": bundle["bundle_id"], "attempt_ref": "api-native-attempt",
        "idempotency_key": "api-native-submit",
        "answers": {"r1": "Here", "w1": "Please come tomorrow."},
    })
    assert response.status_code == 200
    assert response.json()["status"] == "submitted"
    assert response.json()["report_id"] is None
    server = create_teacher_mcp(
        assessment, records, tenant_id="island-1", teacher_id="teacher-1",
    )
    critique = DemoAgent().grade_writing({}, "")
    critique["agent_version"] = "teacher-agent-synthetic-v1"
    result = asyncio.run(server._tool_manager.call_tool(
        "assessment_grade_submit", {
            "student_ref": ref, "attempt_ref": "api-native-attempt",
            "critique": critique, "narrative": DemoAgent().draft_report({}),
        },
    ))
    assert result["status"] == "approved"
    assert result["archive"]["artifact_id"]



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
