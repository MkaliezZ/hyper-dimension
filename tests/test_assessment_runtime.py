import sqlite3

import pytest

from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService


WEIGHTS = {"reading": 0.5, "content": 0.15, "communication": 0.15,
           "organisation": 0.1, "language": 0.1}
ANSWERS = {"r1": "Library", "r2": "Canteen",
           "w1": "Please meet me in the library after school."}


class StubAgent:
    fail_grade = False
    confidence = 0.9
    invalid_key = False
    bad_report = False

    def generate(self, profile, policy):
        return {
            "agent_version": "test-agent-v1",
            "questions": [
                {"id": "r1", "kind": "mcq",
                 "prompt": "A notice says to meet in the library. Where do you meet?",
                 "options": ["Library", "Canteen", "Garden"]},
                {"id": "r2", "kind": "mcq",
                 "prompt": "A notice says lunch is in the canteen. Where is lunch?",
                 "options": ["Library", "Canteen", "Garden"]},
                {"id": "w1", "kind": "writing",
                 "prompt": f"Write a message about {profile['school_progress']}."},
            ],
            "answer_key": {"r1": "Not an option" if self.invalid_key else "Library",
                           "r2": "Canteen"},
            "rubric": {"content": "Addresses the task.",
                       "communication": "Communicates intent.",
                       "organisation": "Has clear order.",
                       "language": "Uses comprehensible English."},
        }

    def draft_report(self, context):
        if self.bad_report:
            return {"summary": "Incomplete"}
        return {"summary": "A short diagnostic summary.",
                "strengths": ["Reading the notices."],
                "needs_work": ["Organising the message."],
                "next_steps": ["Write a new message in a different context."]}

    def grade_writing(self, bundle, answer):
        if self.fail_grade:
            raise TimeoutError("model unavailable")
        return {"scores": {"content": 80, "communication": 70,
                           "organisation": 60, "language": 90},
                "confidence": self.confidence,
                "evidence": "Please meet me"}


@pytest.fixture
def service(tmp_path):
    agent = StubAgent()
    store = AssessmentService(tmp_path / "assessment.db", agent)
    store.register_student(
        tenant_id="tenant-a", student_id="student-a", class_id="class-a",
        age=12, grade=7, book_id="pep-g7a", school_progress="Unit 1",
        consent_id="consent-demo",
    )
    store.authorize_policy(
        tenant_id="tenant-a", class_id="class-a", teacher_id="teacher-a",
        policy_id="policy-a", weights=WEIGHTS,
    )
    return store, agent


def submit(service, bundle_id, *, attempt_id="attempt-a", key="submit-a", answers=None):
    return service.submit(
        tenant_id="tenant-a", student_id="student-a", bundle_id=bundle_id,
        attempt_id=attempt_id, idempotency_key=key,
        answers=ANSWERS if answers is None else answers,
    )


def test_full_assessment_is_durable_and_deduplicated(service):
    store, _ = service
    assignment = store.create_assignment("tenant-a", "student-a")
    assert "answer_key" not in assignment
    assert "rubric" not in assignment
    assert "Unit 1" in assignment["questions"][2]["prompt"]

    first = submit(store, assignment["bundle_id"])
    second = submit(store, assignment["bundle_id"])
    assert first == second
    assert first["status"] == "approved"
    report = store.report("tenant-a", "student-a", first["report_id"])
    assert report["score"] == 87.5
    assert report["teacher_policy_ref"] == "policy-a:v1"
    assert report["next_steps"]
    assert store.error_history("tenant-a", "student-a")[0]["wrong_item_ids"] == []
    event = store.audit_event("tenant-a", "student-a", first["audit_event_id"])
    assert event["event_type"] == "attempt.submitted"

    with sqlite3.connect(store.path) as db:
        assert db.execute("SELECT count(*) FROM attempts").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM grade_runs").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM report_revisions").fetchone()[0] == 1
        types = {row[0] for row in db.execute("SELECT event_type FROM audit_events")}
        assert {"bundle.published", "attempt.submitted", "grade.completed",
                "approval.auto_approved", "report.published"} <= types


def test_submission_conflict_and_tenant_isolation(service):
    store, _ = service
    assignment = store.create_assignment("tenant-a", "student-a")
    first = submit(store, assignment["bundle_id"])
    with pytest.raises(AssessmentError, match="reused"):
        submit(store, assignment["bundle_id"], answers={**ANSWERS, "r1": "Garden"})
    with pytest.raises(AssessmentError, match="unavailable"):
        store.report("tenant-b", "student-a", first["report_id"])
    with pytest.raises(AssessmentError, match="unavailable"):
        store.audit_event("tenant-b", "student-a", first["audit_event_id"])


def test_low_confidence_goes_to_review_without_report(service):
    store, agent = service
    agent.confidence = 0.3
    assignment = store.create_assignment("tenant-a", "student-a")
    result = submit(store, assignment["bundle_id"])
    assert result["status"] == "needs_review"
    assert result["report_id"] is None
    with sqlite3.connect(store.path) as db:
        assert db.execute("SELECT count(*) FROM approval_decisions").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM report_revisions").fetchone()[0] == 0


def test_model_outage_leaves_committed_submission_resumable(service):
    store, agent = service
    agent.fail_grade = True
    assignment = store.create_assignment("tenant-a", "student-a")
    pending = submit(store, assignment["bundle_id"])
    assert pending["status"] == "submitted"
    assert store.audit_event("tenant-a", "student-a", pending["audit_event_id"])["event_type"] == "attempt.submitted"
    agent.fail_grade = False
    result = store.process_attempt("tenant-a", "student-a", "attempt-a")
    assert result["status"] == "approved"
    assert store.process_attempt("tenant-a", "student-a", "attempt-a") == result


def test_bad_agent_bundle_not_published(service):
    store, agent = service
    agent.invalid_key = True
    with pytest.raises(AssessmentError, match="Correct answer"):
        store.create_assignment("tenant-a", "student-a")
    with sqlite3.connect(store.path) as db:
        assert db.execute("SELECT count(*) FROM item_bundles").fetchone()[0] == 0


def test_policy_change_blocks_old_bundle_from_auto_grading(service):
    store, _ = service
    assignment = store.create_assignment("tenant-a", "student-a")
    store.authorize_policy(
        tenant_id="tenant-a", class_id="class-a", teacher_id="teacher-a",
        policy_id="policy-a", weights=WEIGHTS, version=2,
    )
    with pytest.raises(AssessmentError, match="policy"):
        submit(store, assignment["bundle_id"])


def test_guardian_withdrawal_blocks_new_tasks_and_is_audited(service):
    store, _ = service
    store.revoke_consent("tenant-a", "student-a", "guardian-a")
    with pytest.raises(AssessmentError, match="consent"):
        store.create_assignment("tenant-a", "student-a")
    with sqlite3.connect(store.path) as db:
        assert db.execute(
            "SELECT count(*) FROM audit_events WHERE event_type='consent.withdrawn'"
        ).fetchone()[0] == 1


def test_invalid_first_generation_is_retried_once(service):
    store, agent = service
    original = agent.generate
    calls = 0

    def flaky(profile, policy):
        nonlocal calls
        calls += 1
        bundle = original(profile, policy)
        if calls == 1:
            bundle["answer_key"]["r1"] = "Not an option"
        return bundle

    agent.generate = flaky
    assignment = store.create_assignment("tenant-a", "student-a")
    assert calls == 2
    assert assignment["questions"][0]["id"] == "r1"


def test_incomplete_agent_report_does_not_publish(service):
    store, agent = service
    agent.bad_report = True
    assignment = store.create_assignment("tenant-a", "student-a")
    pending = submit(store, assignment["bundle_id"])
    assert pending["status"] == "submitted"
    assert pending["report_id"] is None
    agent.bad_report = False
    approved = store.process_attempt("tenant-a", "student-a", "attempt-a")
    assert approved["status"] == "approved"
    assert store.report("tenant-a", "student-a", approved["report_id"])["next_steps"]


def test_agent_extra_fields_cannot_leak_answer_key_to_student(service):
    store, agent = service
    original = agent.generate

    def extra(profile, policy):
        bundle = original(profile, policy)
        bundle["questions"][0]["answer"] = "Library"
        bundle["questions"][0]["teacher_notes"] = "private"
        return bundle

    agent.generate = extra
    assignment = store.create_assignment("tenant-a", "student-a")
    assert "answer" not in assignment["questions"][0]
    assert "teacher_notes" not in assignment["questions"][0]
