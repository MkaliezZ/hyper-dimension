"""Teacher read views expose immutable alignment runs only inside their class."""
from fastapi.testclient import TestClient

from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.local_education_api import create_local_education_app
from hyper_dimension.no_backend_model import NoBackendModel
from hyper_dimension.progress_alignment import ProgressAlignmentService
from hyper_dimension.student_records import StudentRecords


def test_teacher_can_read_milestones_runs_and_decisions(tmp_path):
    assessment = AssessmentService(tmp_path / "synthetic.sqlite3", NoBackendModel())
    records = StudentRecords(assessment, tmp_path / "archive", teacher_id="teacher-a")
    weights = {
        "reading": 0.5, "content": 0.125, "communication": 0.125,
        "organisation": 0.125, "language": 0.125,
    }
    for class_id in ("class-a", "class-b"):
        assessment.authorize_policy(
            tenant_id="island-a", class_id=class_id, teacher_id="teacher-a",
            policy_id="policy-" + class_id, weights=weights,
        )
    student = records.create_student(
        tenant_id="island-a", class_id="class-a",
        display_name="Synthetic A", public_alias="Alias A", age=12, grade=7,
        book_id="demo", school_progress="Unit 1",
        guardian_consent_ref="synthetic-consent",
    )
    service = ProgressAlignmentService(assessment, records, teacher_id="teacher-a")
    milestone = service.create_milestone(
        tenant_id="island-a", class_id="class-a", capability_node="write-message",
        prerequisite_nodes=[], construct_ref="functional-writing-v1",
        score_dimension="communication", target_difficulty=2,
        target_date="2026-10-15",
    )
    preview = service.preview(
        "island-a", milestone["milestone_id"], "synthetic-week-1",
    )
    decision = service.decide(
        "island-a", preview["run_ref"], student["student_ref"],
        "confirm", "Synthetic teacher confirmation",
    )
    assert decision["effective_group"] == "待补证"

    client = TestClient(create_local_education_app(
        assessment, records, tenant_id="island-a", teacher_id="teacher-a",
        teacher_token="synthetic-teacher-token-32-characters",
        agent_native=True,
    ))
    headers = {"Authorization": "Bearer synthetic-teacher-token-32-characters"}
    milestones_path = "/api/v1/teacher/classes/class-a/milestones"
    runs_path = "/api/v1/teacher/classes/class-a/alignment-runs"
    run_path = "/api/v1/teacher/alignment-runs/" + preview["run_ref"]
    evidence_path = (
        "/api/v1/teacher/students/" + student["student_ref"] + "/alignment-evidence"
    )
    for path in (milestones_path, runs_path, run_path, evidence_path):
        assert client.get(path).status_code == 401
    assert client.get(evidence_path, headers=headers).json()["evidence"] == []

    milestones = client.get(milestones_path, headers=headers).json()["milestones"]
    assert [item["milestone_id"] for item in milestones] == [milestone["milestone_id"]]
    assert milestones[0]["prerequisite_nodes"] == []
    assert "prerequisite_nodes_json" not in milestones[0]
    assert client.get(
        "/api/v1/teacher/classes/class-b/milestones", headers=headers,
    ).json()["milestones"] == []

    runs = client.get(runs_path, headers=headers).json()["runs"]
    assert len(runs) == 1
    assert runs[0]["run_ref"] == preview["run_ref"]
    assert runs[0]["recommendation_count"] == 1
    assert client.get(
        "/api/v1/teacher/classes/class-b/alignment-runs", headers=headers,
    ).json()["runs"] == []

    detail = client.get(run_path, headers=headers).json()
    assert detail["recommendations"] == preview["recommendations"]
    assert detail["decisions"][0]["student_ref"] == student["student_ref"]
    assert detail["decisions"][0]["decision"] == "confirm"
    assert "student_id" not in detail["decisions"][0]
    assert "access_code" not in str(detail)


def test_alignment_run_from_another_tenant_is_unavailable(tmp_path):
    assessment = AssessmentService(tmp_path / "synthetic.sqlite3", NoBackendModel())
    records = StudentRecords(assessment, tmp_path / "archive", teacher_id="teacher-a")
    assessment.authorize_policy(
        tenant_id="island-b", class_id="class-a", teacher_id="teacher-a",
        policy_id="policy-b", weights={
            "reading": 0.5, "content": 0.125, "communication": 0.125,
            "organisation": 0.125, "language": 0.125,
        },
    )
    service = ProgressAlignmentService(assessment, records, teacher_id="teacher-a")
    milestone = service.create_milestone(
        tenant_id="island-b", class_id="class-a", capability_node="write-message",
        prerequisite_nodes=[], construct_ref="functional-writing-v1",
        score_dimension="communication", target_difficulty=2,
        target_date="2026-10-15",
    )
    preview = service.preview(
        "island-b", milestone["milestone_id"], "synthetic-week-1",
    )
    client = TestClient(create_local_education_app(
        assessment, records, tenant_id="island-a", teacher_id="teacher-a",
        teacher_token="synthetic-teacher-token-32-characters",
        agent_native=True,
    ))
    response = client.get(
        "/api/v1/teacher/alignment-runs/" + preview["run_ref"],
        headers={"Authorization": "Bearer synthetic-teacher-token-32-characters"},
    )
    assert response.status_code == 422
