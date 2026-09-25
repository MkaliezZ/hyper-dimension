"""Explicit test for the synthetic-only guardian default in the local API."""
import json
from fastapi.testclient import TestClient

from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.local_education_api import create_local_education_app
from hyper_dimension.guardian_authorization import GuardianAuthorization
from hyper_dimension.student_records import StudentRecords


class NoModel:
    def generate(self, *args):
        raise AssertionError("No model call expected")

    def grade_writing(self, *args):
        raise AssertionError("No model call expected")

    def draft_report(self, *args):
        raise AssertionError("No model call expected")


def test_local_enrollment_without_guardian_input_is_labeled_unverified_demo(tmp_path):
    service = AssessmentService(tmp_path / "demo.sqlite3", NoModel())
    records = StudentRecords(service, tmp_path / "archive", teacher_id="teacher-demo")
    client = TestClient(create_local_education_app(
        service, records, tenant_id="island-demo",
        teacher_id="teacher-demo",
        teacher_token="synthetic-secret-token-32-characters",
    ))
    response = client.post(
        "/api/v1/teacher/students",
        headers={"Authorization": "Bearer synthetic-secret-token-32-characters"},
        json={
            "class_id": "class-demo", "display_name": "Lin Mei",
            "age": 12, "grade": 7, "book_id": "demo-book",
            "school_progress": "Unit 1", "public_alias": "Learning Star",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["consent_assurance"] == "unverified_demo_default"
    assert body["showcase_consent_ref"]
    with service._db() as db:
        guardian = db.execute(
            "SELECT consent_id FROM guardian_consents WHERE tenant_id=? AND student_id=?",
            ("island-demo", body["student_ref"]),
        ).fetchone()
        showcase = db.execute(
            "SELECT guardian_ref,evidence_ref,allowed_fields_json FROM showcase_consents "
            "WHERE consent_id=?",
            (body["showcase_consent_ref"],),
        ).fetchone()
    assert guardian["consent_id"] == "demo-assumed-guardian-full-v1"
    assert showcase["guardian_ref"] == "demo-assumed-guardian"
    assert showcase["evidence_ref"] == "demo-assumed-guardian-full-v1"
    assert set(json.loads(showcase["allowed_fields_json"])) == {
        "alias", "improvement", "score", "honor"}



def test_local_enrollment_accepts_replaceable_authorization_provider(tmp_path):
    class SuppliedProvider:
        def resolve_enrollment(self, supplied_ref):
            assert supplied_ref is None
            return GuardianAuthorization(
                consent_ref="external-decision-1",
                assurance="test_provider_decision",
            )

    service = AssessmentService(tmp_path / "provider.sqlite3", NoModel())
    records = StudentRecords(service, tmp_path / "archive", teacher_id="teacher-demo")
    client = TestClient(create_local_education_app(
        service, records, tenant_id="island-demo",
        teacher_id="teacher-demo",
        teacher_token="synthetic-secret-token-32-characters",
        guardian_authorization=SuppliedProvider(),
    ))
    response = client.post(
        "/api/v1/teacher/students",
        headers={"Authorization": "Bearer synthetic-secret-token-32-characters"},
        json={
            "class_id": "class-demo", "display_name": "Lin Mei",
            "age": 12, "grade": 7, "book_id": "demo-book",
            "school_progress": "Unit 1",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["consent_assurance"] == "test_provider_decision"
    assert "showcase_consent_ref" not in body
    with service._db() as db:
        guardian = db.execute(
            "SELECT consent_id FROM guardian_consents WHERE tenant_id=? AND student_id=?",
            ("island-demo", body["student_ref"]),
        ).fetchone()
    assert guardian["consent_id"] == "external-decision-1"
