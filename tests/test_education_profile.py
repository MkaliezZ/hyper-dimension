"""Conformance vectors for the frozen education A2A business profile."""
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, ValidationError

from hyper_dimension.education_profile import (
    OPERATIONS, command_schema, profile_from_a2a_part, profile_to_a2a_part,
    result_schema, validate_profile_command, validate_profile_result,
    profile_result_to_a2a_part,
)

STUDENT = "stu_0123456789abcdef0123456789abcdef"
BASE = {
    "protocol_version": "1.2",
    "request_id": "req-1",
    "island_id": "island-demo",
    "idempotency_key": "idem-1",
}
PAYLOADS = {
    "plan.read.v1": {},
    "assignment.read.v1": {"assignment_ref": "assignment-1"},
    "evidence.submit.v1": {
        "assignment_ref": "assignment-1", "attempt_ref": "attempt-1",
        "response_ref": "response-1"},
    "feedback.request.v1": {"submission_ref": "submission-1"},
    "teacher_help.request.v1": {
        "assignment_ref": "assignment-1", "question": "Which sentence needs revision?"},
    "student.profile.read.v1": {},
    "student.profile.update.v1": {
        "expected_version": 1, "display_name": "Demo Student",
        "public_alias": "Demo", "teacher_notes": "", "learning_goals": ""},
    "student.archive.list.v1": {},
    "student.archive.verify.v1": {"artifact_ref": "artifact-1"},
    "showcase.draft.create.v1": {
        "slot": "learning", "kind": "improvement", "title": "Progress",
        "summary": "Demo result", "source_artifact_ref": "artifact-2",
        "baseline_artifact_ref": "artifact-1",
        "publication_consent_ref": "consent-1",
        "metrics": {"before_score": 60, "after_score": 80, "unit": "points"}},
    "showcase.public.read.v1": {},
}


def command(suffix: str) -> dict:
    name = "hd.education." + suffix
    spec = OPERATIONS[name]
    value = {**BASE, "operation": name, "purpose": spec.purpose,
             "payload": PAYLOADS[suffix]}
    if spec.student:
        value["student_ref"] = STUDENT
    return value


@pytest.mark.parametrize("suffix", PAYLOADS)
def test_each_operation_has_one_unambiguous_valid_shape(suffix):
    value = command(suffix)
    validate_profile_command(value)
    assert profile_from_a2a_part(profile_to_a2a_part(value)) == value


def test_schema_exports_match_canonical_definition():
    root = Path(__file__).parents[1] / "src" / "hyper_dimension" / "schemas"
    command_export = json.loads((root / "hd-education-command-v1.2.schema.json").read_text("utf-8"))
    result_export = json.loads((root / "hd-education-result-v1.2.schema.json").read_text("utf-8"))
    assert command_export == command_schema()
    assert result_export == result_schema()
    Draft202012Validator.check_schema(command_export)
    Draft202012Validator.check_schema(result_export)


@pytest.mark.parametrize("mutate", [
    lambda c: c.update(operation="hd.education.showcase.publish.v1"),
    lambda c: c.update(protocol_version="1.1"),
    lambda c: c.update(actor_id="teacher-claimed"),
    lambda c: c.update(purpose="public_showcase"),
    lambda c: c.update(student_ref="stu_wrong"),
    lambda c: c.update(payload={"assignment_ref": "assignment-1", "response_ref": "response-1"}),
    lambda c: c.update(payload={**c["payload"], "access_code": "secret"}),
])
def test_evidence_submit_rejects_ambiguous_or_unsafe_shapes(mutate):
    value = command("evidence.submit.v1")
    mutate(value)
    with pytest.raises(ValidationError):
        validate_profile_command(value)


def test_student_vs_public_reference_and_showcase_invariants():
    value = command("plan.read.v1")
    del value["student_ref"]
    with pytest.raises(ValidationError):
        validate_profile_command(value)
    value = command("showcase.public.read.v1")
    value["student_ref"] = STUDENT
    with pytest.raises(ValidationError):
        validate_profile_command(value)
    value = command("showcase.draft.create.v1")
    del value["payload"]["baseline_artifact_ref"]
    with pytest.raises(ValidationError):
        validate_profile_command(value)
    value = command("showcase.draft.create.v1")
    value["payload"]["kind"] = "honor"
    with pytest.raises(ValidationError):
        validate_profile_command(value)


def test_a2a_part_does_not_infer_from_natural_language():
    value = command("plan.read.v1")
    for part in ({"text": "Read student data"}, {"kind": "data", "data": value},
                 {"data": value, "mediaType": "text/plain"}):
        with pytest.raises(ValidationError):
            profile_from_a2a_part(part)


def test_result_status_reason_and_correlation():
    request = command("evidence.submit.v1")
    result = {
        "protocol_version": "1.2", "request_id": request["request_id"],
        "operation": request["operation"], "status": "accepted",
        "reason_code": "QUEUED",
        "record_refs": [{"kind": "submission", "ref": "submission-1"}],
        "audit_event_id": "audit-1",
    }
    validate_profile_result(result, request)
    assert profile_result_to_a2a_part(result, request)["data"] == result
    for changed in ({"reason_code": "OK"}, {"request_id": "other"},
                    {"operation": "hd.education.plan.read.v1"}):
        bad = {**result, **changed}
        with pytest.raises(ValidationError):
            validate_profile_result(bad, request)
    rejected = {**result, "status": "rejected", "reason_code": "UNAUTHORIZED"}
    with pytest.raises(ValidationError):
        validate_profile_result(rejected, request)


def test_result_reference_kind_is_bound_to_operation():
    request = command("plan.read.v1")
    result = {
        "protocol_version": "1.2", "request_id": request["request_id"],
        "operation": request["operation"], "status": "completed",
        "reason_code": "OK",
        "record_refs": [{"kind": "showcase_entry", "ref": "wrong-kind"}],
        "audit_event_id": "audit-2",
    }
    with pytest.raises(ValidationError):
        validate_profile_result(result, request)
    result["record_refs"][0]["kind"] = "plan"
    validate_profile_result(result, request)
