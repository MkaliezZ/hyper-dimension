"""Real SDK JSON-RPC integration tests for the loopback A2A read slice."""
import json

import pytest
from starlette.testclient import TestClient

from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.education_profile import validate_profile_result
from hyper_dimension.local_a2a import (
    CONTENT_SCHEMA, PROFILE_READ, SHOWCASE_READ, create_local_a2a_app,
)
from hyper_dimension.student_records import StudentRecords


class NoModel:
    def generate(self, *args):
        raise AssertionError("A2A read path must not call model")

    def grade_writing(self, *args):
        raise AssertionError("A2A read path must not call model")

    def draft_report(self, *args):
        raise AssertionError("A2A read path must not call model")


@pytest.fixture
def setup(tmp_path):
    assessment = AssessmentService(tmp_path / "synthetic.sqlite3", NoModel())
    records = StudentRecords(
        assessment, tmp_path / "archive", teacher_id="teacher-demo")
    student = records.create_student(
        tenant_id="island-demo", class_id="class-demo",
        display_name="Lin Mei", public_alias="Learning Star",
        age=12, grade=7, book_id="demo-book", school_progress="Unit 1",
        guardian_consent_ref="synthetic-consent",
    )
    app = create_local_a2a_app(
        records, tenant_id="island-demo", teacher_id="teacher-demo",
        teacher_token="synthetic-secret-token-32-characters",
    )
    return assessment, records, student, TestClient(app)


def command(operation, student_ref=None, island_id="island-demo", payload=None):
    purpose = "student_record" if operation == PROFILE_READ else "public_showcase"
    value = {
        "protocol_version": "1.2", "operation": operation,
        "request_id": "req-demo-1", "island_id": island_id,
        "idempotency_key": "read-demo-1", "purpose": purpose,
        "payload": payload or {},
    }
    if student_ref:
        value["student_ref"] = student_ref
    return value


def rpc(body):
    return {
        "jsonrpc": "2.0", "id": "rpc-1", "method": "SendMessage",
        "params": {"message": {
            "messageId": "message-1", "role": "ROLE_USER",
            "parts": [{"data": body, "mediaType": "application/json"}],
        }},
    }


AUTH = {
    "Authorization": "Bearer synthetic-secret-token-32-characters",
    "A2A-Version": "1.0",
}


def send(client, body, headers=AUTH):
    response = client.post("/a2a", json=rpc(body), headers=headers)
    assert response.status_code == 200
    assert "result" in response.json(), response.text
    return response.json()["result"]["task"]


def parts(task):
    return [p["data"] for p in task["artifacts"][0]["parts"]]


def audit_rows(assessment):
    with assessment._db() as db:
        return [dict(row) for row in db.execute(
            "SELECT * FROM a2a_read_events ORDER BY occurred_at")]


def test_card_only_claims_implemented_skills_and_requires_bearer(setup):
    _, _, _, client = setup
    response = client.get("/.well-known/agent-card.json")
    assert response.status_code == 200
    card = response.json()
    assert card["supportedInterfaces"][0]["protocolVersion"] == "1.0"
    assert {skill["id"] for skill in card["skills"]} == {
        PROFILE_READ, SHOWCASE_READ}
    assert card["securitySchemes"]["teacherBearer"]["httpAuthSecurityScheme"]["scheme"] == "bearer"
    assert card["capabilities"]["streaming"] is False


def test_all_jsonrpc_methods_require_teacher_token_including_get_task(setup):
    _, _, student, client = setup
    body = command(PROFILE_READ, student["student_ref"])
    assert client.post("/a2a", json=rpc(body)).status_code == 401
    assert client.post("/a2a", json=rpc(body), headers={
        "Authorization": "Bearer wrong", "A2A-Version": "1.0"}).status_code == 401
    task = send(client, body)
    task_id = task["id"]
    get_task = {
        "jsonrpc": "2.0", "id": "rpc-2", "method": "GetTask",
        "params": {"id": task_id},
    }
    assert client.post("/a2a", json=get_task).status_code == 401
    assert client.post("/a2a", json=get_task, headers=AUTH).status_code == 200


def test_private_profile_read_is_real_scoped_and_audited(setup):
    assessment, records, student, client = setup
    records.edit_profile(
        "island-demo", student["student_ref"], expected_version=1,
        display_name="Lin Mei", public_alias="Learning Star",
        teacher_notes="Practice invitations.", learning_goals="Clear English.",
    )
    body = command(PROFILE_READ, student["student_ref"])
    task = send(client, body)
    assert task["status"]["state"] == "TASK_STATE_COMPLETED"
    result, content = parts(task)
    validate_profile_result(result, body)
    assert result["record_refs"] == [{
        "kind": "profile", "ref": student["student_ref"]}]
    assert content["payload"]["profile"]["teacher_notes"] == "Practice invitations."
    assert content["payload"]["profile"]["version"] == 2
    rows = audit_rows(assessment)
    assert len(rows) == 1
    assert rows[0]["event_id"] == result["audit_event_id"]
    assert rows[0]["student_ref"] == student["student_ref"]
    assert rows[0]["task_id"] == task["id"]
    assert rows[0]["context_id"] == task["contextId"]
    assert "synthetic-secret-token" not in json.dumps(rows)


def test_cross_island_and_unimplemented_mutation_are_rejected_and_audited(setup):
    assessment, _, student, client = setup
    wrong_island = command(
        PROFILE_READ, student["student_ref"], island_id="other-island")
    task = send(client, wrong_island)
    assert task["status"]["state"] == "TASK_STATE_REJECTED"
    assert parts(task)[0]["reason_code"] == "NOT_FOUND"
    assert len(parts(task)) == 1

    mutation = command("hd.education.evidence.submit.v1",
                       student["student_ref"],
                       payload={
                           "assignment_ref": "assignment-1",
                           "attempt_ref": "attempt-1",
                           "response_ref": "response-1"})
    mutation["purpose"] = "learning"
    task = send(client, mutation)
    assert task["status"]["state"] == "TASK_STATE_REJECTED"
    assert parts(task)[0]["reason_code"] == "POLICY_BLOCKED"
    assert len(audit_rows(assessment)) == 2


def test_invalid_legacy_or_claimed_actor_never_enters_business_audit(setup):
    assessment, _, _, client = setup
    body = command(SHOWCASE_READ)
    body["actor_id"] = "forged-teacher"
    task = send(client, body)
    assert task["status"]["state"] == "TASK_STATE_REJECTED"
    assert "artifacts" not in task or not task["artifacts"]
    assert audit_rows(assessment) == []
    body.pop("actor_id")
    body["protocol_version"] = "1.1"
    task = send(client, body)
    assert task["status"]["state"] == "TASK_STATE_REJECTED"
    assert audit_rows(assessment) == []


def test_public_cards_are_current_and_withdrawal_stops_read(setup):
    assessment, records, student, client = setup
    student_ref = student["student_ref"]
    source = records.archive_teacher_note(
        "island-demo", student_ref, teacher_id="teacher-demo",
        evidence_ref="classroom-demo", title="Reading challenge",
        note="Observed classroom reading.",
    )["artifact_id"]
    consent = records.record_showcase_consent(
        tenant_id="island-demo", student_id=student_ref,
        guardian_ref="synthetic-guardian", evidence_ref="synthetic-form",
        allowed_fields=["alias", "honor"],
    )
    entry = records.create_showcase_draft(
        tenant_id="island-demo", student_id=student_ref,
        slot="honors", kind="honor", title="Reading milestone",
        summary="Completed a reading challenge.", metrics={},
        consent_id=consent, source_artifact_id=source,
    )
    records.publish_showcase("island-demo", student_ref, entry)
    body = command(SHOWCASE_READ, payload={"slot": "honors"})
    task = send(client, body)
    result, content = parts(task)
    assert result["record_refs"] == [{"kind": "showcase_entry", "ref": entry}]
    assert content["payload"]["entries"][0]["student_alias"] == "Learning Star"
    assert "student_ref" not in json.dumps(content)
    records.withdraw_showcase_consent(
        "island-demo", student_ref, consent, "synthetic-guardian")
    task = send(client, body)
    result, content = parts(task)
    assert result["record_refs"] == []
    assert content["payload"]["entries"] == []
    assert len(audit_rows(assessment)) == 2


def test_exported_content_schema_matches_runtime():
    from pathlib import Path
    root = Path(__file__).parents[1] / "src" / "hyper_dimension" / "schemas"
    exported = json.loads(
        (root / "hd-education-a2a-read-content-v1.2.schema.json").read_text("utf-8"))
    assert exported == CONTENT_SCHEMA
