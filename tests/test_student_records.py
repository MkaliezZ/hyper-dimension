import json

import pytest

from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService
from hyper_dimension.student_records import StudentRecords


class DemoAgent:
    def generate(self, profile, policy):
        return {
            "agent_version": "demo-v1",
            "questions": [
                {"id": "r1", "kind": "mcq",
                 "prompt": "The library opens at nine. When does it open?",
                 "options": ["Nine", "Ten", "Eleven"]},
                {"id": "w1", "kind": "writing",
                 "prompt": "Invite a classmate to the library."},
            ],
            "answer_key": {"r1": "Nine"},
            "rubric": {"content": "Invitation included",
                       "communication": "Intent clear",
                       "organisation": "Ordered message",
                       "language": "Comprehensible language"},
        }

    def grade_writing(self, bundle, answer):
        return {"scores": {"content": 80, "communication": 80,
                           "organisation": 70, "language": 70},
                "confidence": 0.9, "evidence": "Please come"}

    def draft_report(self, context):
        return {"summary": "A single task was completed.",
                "strengths": ["Located opening time."],
                "needs_work": ["Write a clearer invitation."],
                "next_steps": ["Try a new invitation context."]}


@pytest.fixture
def setup(tmp_path):
    service = AssessmentService(tmp_path / "assessment.sqlite3", DemoAgent())
    records = StudentRecords(service, tmp_path / "private-archive", teacher_id="teacher-1")
    created = records.create_student(
        tenant_id="teacher-island", class_id="class-7",
        display_name="Lin Mei", age=12, grade=7,
        book_id="pep-g7a", school_progress="Unit 1",
        guardian_consent_ref="synthetic-consent",
        public_alias="Star Seven",
    )
    service.authorize_policy(
        tenant_id="teacher-island", class_id="class-7",
        teacher_id="teacher-1", policy_id="policy-1",
        weights={"reading": 0.5, "content": 0.15,
                 "communication": 0.15, "organisation": 0.1,
                 "language": 0.1},
    )
    return service, records, created


def test_student_identity_is_stable_and_not_based_on_name(setup):
    _, records, created = setup
    student_id = created["student_id"]
    assert created["student_ref"] == student_id
    assert student_id.startswith("stu_")
    assert "Lin" not in str(records._folder("teacher-island", student_id))
    assert records.verify_student(
        "teacher-island", created["access_code"], "Lin Mei"
    ) == student_id
    with pytest.raises(AssessmentError):
        records.verify_student("teacher-island", created["access_code"], "Other")
    with pytest.raises(AssessmentError):
        records.verify_student("teacher-island", "wrong-code", "Lin Mei")
    new_code = records.rotate_access_code("teacher-island", student_id)
    with pytest.raises(AssessmentError):
        records.verify_student("teacher-island", created["access_code"], "Lin Mei")
    assert records.verify_student("teacher-island", new_code, "Lin Mei") == student_id


def test_profile_versions_and_report_export_are_auditable(setup):
    service, records, created = setup
    student_id = created["student_id"]
    profile = records.edit_profile(
        "teacher-island", student_id, expected_version=1,
        display_name="Lin Mei", public_alias="Star Seven",
        teacher_notes="Needs help writing invitations.",
        learning_goals="Write clear messages.",
    )
    assert profile["version"] == 2
    with pytest.raises(AssessmentError, match="version"):
        records.edit_profile(
            "teacher-island", student_id, expected_version=1,
            display_name="Lin Mei", public_alias="Star Seven",
            teacher_notes="", learning_goals="",
        )
    assignment = service.create_assignment("teacher-island", student_id)
    result = service.submit(
        tenant_id="teacher-island", student_id=student_id,
        bundle_id=assignment["bundle_id"], attempt_id="attempt-1",
        idempotency_key="submit-1",
        answers={"r1": "Nine", "w1": "Please come to the library."},
    )
    assert result["status"] == "approved"
    first = records.archive_report("teacher-island", student_id, result["report_id"])
    repeated = records.archive_report("teacher-island", student_id, result["report_id"])
    assert first == repeated
    assert records.verify_artifact("teacher-island", student_id, first["artifact_id"])
    artifacts = records.artifacts("teacher-island", student_id)
    assert len(artifacts) == 3  # enrollment, profile revision, assessment
    assert len({a["artifact_id"] for a in artifacts}) == 3
    assert all(a["record_event_id"] and a["export_event_id"] for a in artifacts)

    path = records._folder("teacher-island", student_id) / "artifacts" / (first["artifact_id"] + ".json")
    wrapper = json.loads(path.read_text(encoding="utf-8"))
    wrapper["body"]["report"]["score"] = 0
    path.write_text(json.dumps(wrapper), encoding="utf-8")
    assert not records.verify_artifact("teacher-island", student_id, first["artifact_id"])
    with pytest.raises(AssessmentError, match="modified"):
        records.archive_report("teacher-island", student_id, result["report_id"])


def test_public_showcase_requires_separate_consent_and_archived_evidence(setup):
    service, records, created = setup
    student_id = created["student_id"]
    source_id = records.archive_teacher_note(
        "teacher-island", student_id, teacher_id="teacher-1",
        evidence_ref="classroom-reading-demo", title="Reading challenge",
        note="Teacher observed the completed challenge.",
    )["artifact_id"]
    with pytest.raises(AssessmentError, match="consent"):
        records.create_showcase_draft(
            tenant_id="teacher-island", student_id=student_id,
            slot="honors", kind="honor", title="Reading milestone",
            summary="Completed a classroom reading challenge.",
            metrics={}, consent_id="missing", source_artifact_id=source_id,
        )
    consent_id = records.record_showcase_consent(
        tenant_id="teacher-island", student_id=student_id,
        guardian_ref="synthetic-guardian",
        evidence_ref="signed-form-demo", allowed_fields=["alias", "honor"],
    )
    entry_id = records.create_showcase_draft(
        tenant_id="teacher-island", student_id=student_id,
        slot="honors", kind="honor", title="Reading milestone",
        summary="Completed a classroom reading challenge.",
        metrics={}, consent_id=consent_id, source_artifact_id=source_id,
    )
    assert records.public_showcase("teacher-island") == []
    source_path = records._folder("teacher-island", student_id) / "artifacts" / (source_id + ".json")
    original = source_path.read_bytes()
    source_path.write_text("{}", encoding="utf-8")
    with pytest.raises(AssessmentError, match="verification"):
        records.publish_showcase("teacher-island", student_id, entry_id)
    source_path.write_bytes(original)
    records.publish_showcase("teacher-island", student_id, entry_id)
    cards = records.public_showcase("teacher-island", "honors")
    assert len(cards) == 1
    assert cards[0]["student_alias"] == "Star Seven"
    assert "student_id" not in cards[0]
    assert "display_name" not in cards[0]
    assert records.public_showcase("other-island") == []
    records.withdraw_showcase_consent(
        "teacher-island", student_id, consent_id, "synthetic-guardian"
    )
    assert records.public_showcase("teacher-island") == []


def test_public_score_scope_is_checked(setup):
    service, records, created = setup
    student_id = created["student_id"]
    assignment = service.create_assignment("teacher-island", student_id)
    baseline_result = service.submit(
        tenant_id="teacher-island", student_id=student_id,
        bundle_id=assignment["bundle_id"], attempt_id="attempt-score-baseline",
        idempotency_key="score-baseline",
        answers={"r1": "Ten", "w1": "Please come to the library."},
    )
    baseline_id = records.archive_report(
        "teacher-island", student_id, baseline_result["report_id"]
    )["artifact_id"]
    latest_assignment = service.create_assignment("teacher-island", student_id)
    latest_result = service.submit(
        tenant_id="teacher-island", student_id=student_id,
        bundle_id=latest_assignment["bundle_id"], attempt_id="attempt-score-latest",
        idempotency_key="score-latest",
        answers={"r1": "Nine", "w1": "Please come to the library."},
    )
    source_id = records.archive_report(
        "teacher-island", student_id, latest_result["report_id"]
    )["artifact_id"]
    consent_id = records.record_showcase_consent(
        tenant_id="teacher-island", student_id=student_id,
        guardian_ref="synthetic-guardian", evidence_ref="form-demo",
        allowed_fields=["alias", "improvement"],
    )
    entry_id = records.create_showcase_draft(
        tenant_id="teacher-island", student_id=student_id,
        slot="learning", kind="improvement",
        title="A reading step forward",
        summary="Completed two different classroom reading tasks.",
        metrics={"before_score": 38, "after_score": 88, "unit": "points"},
        consent_id=consent_id, source_artifact_id=source_id,
        baseline_artifact_id=baseline_id,
    )
    with pytest.raises(AssessmentError, match="cover"):
        records.publish_showcase("teacher-island", student_id, entry_id)
    with pytest.raises(AssessmentError, match="do not match"):
        records.create_showcase_draft(
            tenant_id="teacher-island", student_id=student_id,
            slot="learning", kind="improvement", title="Unsupported claim",
            summary="An incorrect number.", metrics={
                "before_score": 1, "after_score": 88, "unit": "points",
            }, consent_id=consent_id, source_artifact_id=source_id,
            baseline_artifact_id=baseline_id,
        )
