from jsonschema import ValidationError
import pytest
from fastapi.testclient import TestClient

from hyper_dimension.api import app
from hyper_dimension.contracts import (
    validate_education_request,
    validate_education_result,
)


def example_request() -> dict:
    return {
        "protocol_version": "1.0",
        "operation": "hd.education.evidence.submit.v1",
        "request_id": "request-demo-1",
        "island_id": "island-demo",
        "student_ref": "student-scoped-demo",
        "purpose": "英语口语任务提交",
        "idempotency_key": "submission-demo-1",
        "payload_refs": [
            {"kind": "assignment", "ref": "assignment-demo"},
            {"kind": "audio_upload", "ref": "upload-demo"},
        ],
    }


def test_education_request_accepts_valid_evidence_submission() -> None:
    validate_education_request(example_request())


def test_education_request_rejects_missing_assignment() -> None:
    request = example_request()
    request["payload_refs"] = [{"kind": "audio_upload", "ref": "upload-demo"}]
    with pytest.raises(ValidationError):
        validate_education_request(request)


def test_education_request_rejects_client_claimed_actor() -> None:
    request = example_request()
    request["actor_id"] = "teacher"
    with pytest.raises(ValidationError):
        validate_education_request(request)


def test_education_result_accepts_reference_only() -> None:
    validate_education_result({
        "protocol_version": "1.0",
        "request_id": "request-demo-1",
        "status": "accepted",
        "record_refs": [{"kind": "evidence", "ref": "evidence-demo"}],
        "reason_code": "OK",
        "audit_event_id": "event-demo",
    })


def test_healthz() -> None:
    response = TestClient(app).get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
