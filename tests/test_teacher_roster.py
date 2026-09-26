"""Teacher roster is private, tenant-scoped, and contains no access codes."""
from fastapi.testclient import TestClient

from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.local_education_api import create_local_education_app
from hyper_dimension.student_records import StudentRecords


class NoModel:
    pass


def test_teacher_roster_requires_auth_and_stays_inside_island(tmp_path):
    assessment = AssessmentService(tmp_path / "synthetic.sqlite3", NoModel())
    records = StudentRecords(
        assessment, tmp_path / "archive", teacher_id="teacher-1",
    )
    first = records.create_student(
        tenant_id="island-1", class_id="class-a",
        display_name="Synthetic A", public_alias="A", age=12, grade=7,
        book_id="demo", school_progress="Unit 1",
        guardian_consent_ref="synthetic-consent",
    )
    records.create_student(
        tenant_id="island-1", class_id="class-b",
        display_name="Synthetic B", public_alias="B", age=12, grade=7,
        book_id="demo", school_progress="Unit 1",
        guardian_consent_ref="synthetic-consent",
    )
    records.create_student(
        tenant_id="island-2", class_id="class-a",
        display_name="Synthetic C", public_alias="C", age=12, grade=7,
        book_id="demo", school_progress="Unit 1",
        guardian_consent_ref="synthetic-consent",
    )
    client = TestClient(create_local_education_app(
        assessment, records, tenant_id="island-1",
        teacher_id="teacher-1",
        teacher_token="synthetic-secret-token-32-characters",
    ))
    path = "/api/v1/teacher/classes/class-a/students"
    assert client.get(path).status_code == 401
    response = client.get(
        path, headers={"Authorization": "Bearer synthetic-secret-token-32-characters"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["has_more"] is False
    assert [item["student_ref"] for item in body["students"]] == [
        first["student_ref"],
    ]
    assert "access_code" not in str(body)
    assert "guardian_consent_ref" not in str(body)
