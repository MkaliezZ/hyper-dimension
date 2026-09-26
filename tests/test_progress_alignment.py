"""Four-student synthetic acceptance test for teacher-scoped progress alignment."""
from fastapi.testclient import TestClient
import asyncio
import pytest

from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService
from hyper_dimension.local_education_api import create_local_education_app
from hyper_dimension.no_backend_model import NoBackendModel
from hyper_dimension.progress_alignment import ProgressAlignmentService
from hyper_dimension.student_records import StudentRecords
from hyper_dimension.teacher_mcp import create_teacher_mcp


def bundle():
    return {
        "agent_version": "teacher-synthetic-v1",
        "questions": [
            {"id": "r", "kind": "mcq", "prompt": "Choose the place.",
             "options": ["library", "park"]},
            {"id": "w", "kind": "writing", "prompt": "Invite a classmate."},
        ],
        "answer_key": {"r": "library"},
        "rubric": {
            "content": "Relevant information", "communication": "Clear purpose",
            "organisation": "Organised response", "language": "Appropriate language",
        },
    }


def report(assessment, student_ref, label, *, writing_score=80):
    assignment = assessment.publish_agent_bundle(
        "island", student_ref, bundle(), idempotency_key="bundle-" + label,
    )
    assessment.submit(
        tenant_id="island", student_id=student_ref, bundle_id=assignment["bundle_id"],
        attempt_id="attempt-" + label, idempotency_key="submit-" + label,
        answers={"r": "library", "w": "Come to the library."},
        auto_process=False,
    )
    result = assessment.process_attempt(
        "island", student_ref, "attempt-" + label, agent_supplied=True,
        critique={
            "scores": {k: writing_score for k in ("content", "communication", "organisation", "language")},
            "confidence": 0.95, "evidence": "The invitation has a clear purpose.",
            "agent_version": "teacher-synthetic-v1",
        },
        narrative={
            "summary": "Synthetic diagnosis", "strengths": ["Purpose"],
            "needs_work": ["Detail"], "next_steps": ["Try another invitation"],
        },
    )
    assert result["status"] == "approved"
    return result["report_id"]


def test_four_student_alignment_uses_confirmed_comparable_evidence(tmp_path):
    assessment = AssessmentService(tmp_path / "db.sqlite3", NoBackendModel())
    records = StudentRecords(assessment, tmp_path / "private", teacher_id="teacher")
    assessment.authorize_policy(
        tenant_id="island", class_id="class-a", teacher_id="teacher",
        policy_id="policy", weights={
            "reading": 0.5, "content": 0.125, "communication": 0.125,
            "organisation": 0.125, "language": 0.125,
        },
    )
    students = {}
    for label in ("support", "core", "transfer", "pending"):
        students[label] = records.create_student(
            tenant_id="island", class_id="class-a",
            display_name="Synthetic " + label, public_alias="Alias " + label,
            age=12, grade=7, book_id="book", school_progress="Unit 1",
            guardian_consent_ref="demo-consent",
        )["student_ref"]
    token = "synthetic-teacher-token-very-long"
    client = TestClient(create_local_education_app(
        assessment, records, tenant_id="island", teacher_id="teacher",
        teacher_token=token, agent_native=True,
    ))
    headers = {"Authorization": "Bearer " + token}
    endpoint = "/api/v1/teacher/classes/class-a/milestones"
    assert client.post(endpoint, json={
        "capability_node": "invite-peer",
        "prerequisite_nodes": ["write-simple-message"],
        "construct_ref": "functional-writing-v1",
        "score_dimension": "communication",
        "target_difficulty": 2, "target_date": "2026-10-15",
    }).status_code == 401
    created = client.post(endpoint, headers=headers, json={
        "capability_node": "invite-peer",
        "prerequisite_nodes": ["write-simple-message"],
        "construct_ref": "functional-writing-v1",
        "score_dimension": "communication",
        "target_difficulty": 2, "target_date": "2026-10-15",
    })
    assert created.status_code == 200
    milestone_ref = created.json()["milestone_id"]
    service = ProgressAlignmentService(assessment, records, teacher_id="teacher")
    server = create_teacher_mcp(
        assessment, records, tenant_id="island", teacher_id="teacher",
    )

    def tool(name, **args):
        return asyncio.run(server._tool_manager.call_tool(name, args))

    assert tool("class_milestone_read", milestone_ref=milestone_ref)["capability_node"] == "invite-peer"

    def evidence(label, node, suffix, correct, prompt, confirm=True,
                 construct="functional-writing-v1"):
        ref = students[label]
        report_ref = report(assessment, ref, label + suffix,
                            writing_score=80 if correct else 40)
        proposed = tool(
            "alignment_evidence_propose", student_ref=ref,
            report_ref=report_ref, capability_node=node,
            construct_ref=construct,
            score_dimension="communication", difficulty=2, prompt_strength=prompt,
            agent_version="teacher-synthetic-v1",
        )
        if confirm:
            path = f"/api/v1/teacher/students/{ref}/alignment-evidence/{proposed['evidence_ref']}/confirm"
            assert client.post(path).status_code == 401
            assert client.post(path, headers=headers).status_code == 200
        return proposed["evidence_ref"]

    for index in range(2):
        evidence("support", "write-simple-message", f"-pre-{index}", False, 0)
        evidence("core", "write-simple-message", f"-pre-{index}", True, 0)
        evidence("transfer", "write-simple-message", f"-pre-{index}", True, 0)
    evidence("core", "invite-peer", "-target-0", True, 1)
    evidence("core", "invite-peer", "-target-1", True, 1)
    for index in range(2):
        evidence("transfer", "invite-peer", f"-target-{index}", True, 0)
    evidence("pending", "invite-peer", "-unconfirmed", True, 0, confirm=False)
    evidence("pending", "invite-peer", "-wrong-construct", True, 0,
             construct="different-task-v1")

    preview = tool(
        "class_alignment_preview", milestone_ref=milestone_ref,
        idempotency_key="week-1",
    )
    groups = {r["student_ref"]: r["group"] for r in preview["recommendations"]}
    assert groups == {
        students["support"]: "前置支撑",
        students["core"]: "核心练习",
        students["transfer"]: "迁移挑战",
        students["pending"]: "待补证",
    }
    assert tool(
        "class_alignment_preview", milestone_ref=milestone_ref,
        idempotency_key="week-1",
    ) == preview
    assert all("score" not in recommendation for recommendation in preview["recommendations"])
    assert preview["rule_version"] == "alignment-v0.1"
    stricter = service.create_milestone(
        tenant_id="island", class_id="class-a", capability_node="invite-peer",
        prerequisite_nodes=["write-simple-message"],
        construct_ref="functional-writing-v1", score_dimension="communication",
        target_difficulty=2, target_date="2026-10-22",
        support_threshold=60, transfer_threshold=90,
    )
    stricter_run = tool(
        "class_alignment_preview", milestone_ref=stricter["milestone_id"],
        idempotency_key="week-1-strict",
    )
    stricter_groups = {r["student_ref"]: r["group"] for r in stricter_run["recommendations"]}
    assert stricter_groups[students["transfer"]] == "核心练习"
    override_endpoint = (
        f"/api/v1/teacher/alignment-runs/{preview['run_ref']}/students/{students['support']}/decision"
    )
    assert client.post(override_endpoint, headers=headers, json={
        "decision": "override", "reason": "Teacher observed stronger performance.",
    }).status_code == 422
    overridden = client.post(override_endpoint, headers=headers, json={
        "decision": "override", "override_group": "核心练习",
        "reason": "Teacher observed stronger performance.",
    })
    assert overridden.status_code == 200
    assert overridden.json()["effective_group"] == "核心练习"
    assert groups[students["support"]] == "前置支撑"
    assert client.post(override_endpoint, headers=headers, json={
        "decision": "override", "override_group": "迁移挑战",
        "reason": "Changed decision",
    }).status_code == 422

    plan = {
        "goal": "Write a clear invitation", "next_task": "Draft two invitations",
        "review_date": "2026-10-02",
        "weekly_steps": ["Read examples", "Draft", "Revise", "Transfer"],
    }
    with pytest.raises(Exception):
        tool("student_plan_draft_submit", run_ref=preview["run_ref"],
             student_ref=students["core"], idempotency_key="plan-1",
             plan=plan, agent_version="teacher-synthetic-v1")
    decision_endpoint = (
        f"/api/v1/teacher/alignment-runs/{preview['run_ref']}/students/{students['core']}/decision"
    )
    assert client.post(decision_endpoint, headers=headers, json={
        "decision": "confirm", "reason": "Reviewed the two prerequisite reports.",
    }).status_code == 200
    drafted = tool(
        "student_plan_draft_submit", run_ref=preview["run_ref"],
        student_ref=students["core"], idempotency_key="plan-1",
        plan=plan, agent_version="teacher-synthetic-v1",
    )
    assert drafted["status"] == "draft"
    plans_path = f"/api/v1/teacher/students/{students['core']}/plans"
    assert client.get(plans_path).status_code == 401
    drafts = client.get(plans_path, headers=headers).json()["plans"]
    assert len(drafts) == 1
    assert drafts[0]["plan_ref"] == drafted["plan_ref"]
    assert drafts[0]["run_ref"] == preview["run_ref"]
    assert drafts[0]["plan"] == plan
    assert drafts[0]["status"] == "draft"
    assert client.get(
        "/api/v1/teacher/students/missing-student/plans", headers=headers,
    ).status_code == 422
    approve_path = f"/api/v1/teacher/students/{students['core']}/plans/{drafted['plan_ref']}/approve"
    assert client.post(approve_path, headers=headers, json={
        "reason": "Teacher reviewed the four-week plan.",
    }).json()["status"] == "approved"
    approved = client.get(plans_path, headers=headers).json()["plans"][0]
    assert approved["status"] == "approved"
    assert approved["approval_reason"] == "Teacher reviewed the four-week plan."
    assert approved["approved_at"]
    assert client.post(approve_path, headers=headers, json={
        "reason": "Changed reason after approval",
    }).status_code == 422
    assert tool(
        "student_plan_draft_submit", run_ref=preview["run_ref"],
        student_ref=students["core"], idempotency_key="plan-1",
        plan=plan, agent_version="teacher-synthetic-v1",
    )["status"] == "approved"
    second_plan = tool(
        "student_plan_draft_submit", run_ref=preview["run_ref"],
        student_ref=students["core"], idempotency_key="plan-2",
        plan={**plan, "goal": "A different goal"},
        agent_version="teacher-synthetic-v1",
    )
    assert client.post(
        f"/api/v1/teacher/students/{students['core']}/plans/{second_plan['plan_ref']}/approve",
        headers=headers, json={"reason": "Second plan"},
    ).status_code == 422
    pending_evidence = tool("student_capability_evidence_read",
                            student_ref=students["pending"])["evidence"]
    assert {row["status"] for row in pending_evidence} == {"proposed", "confirmed"}

    # New confirmed evidence changes the input snapshot; old run remains immutable.
    evidence("pending", "write-simple-message", "-new", True, 0)
    evidence("transfer", "invite-peer", "-recent-drop", False, 0)
    with pytest.raises(Exception):
        tool("class_alignment_preview", milestone_ref=milestone_ref,
             idempotency_key="week-1")
    next_run = tool("class_alignment_preview", milestone_ref=milestone_ref,
                    idempotency_key="week-2")
    assert next_run["run_ref"] != preview["run_ref"]
    next_groups = {r["student_ref"]: r["group"] for r in next_run["recommendations"]}
    assert groups[students["transfer"]] == "迁移挑战"
    assert next_groups[students["transfer"]] == "核心练习"
    assert groups[students["core"]] == "核心练习"


def test_evidence_cannot_be_attached_to_another_student(tmp_path):
    assessment = AssessmentService(tmp_path / "db.sqlite3", NoBackendModel())
    records = StudentRecords(assessment, tmp_path / "private", teacher_id="teacher")
    assessment.authorize_policy(
        tenant_id="island", class_id="c", teacher_id="teacher",
        policy_id="p", weights={
            "reading": 0.5, "content": 0.125, "communication": 0.125,
            "organisation": 0.125, "language": 0.125,
        },
    )
    refs = [
        records.create_student(
            tenant_id="island", class_id="c", display_name="Synthetic " + str(i),
            public_alias="Alias " + str(i), age=12, grade=7,
            book_id="book", school_progress="Unit 1",
            guardian_consent_ref="demo",
        )["student_ref"]
        for i in range(2)
    ]
    report_ref = report(assessment, refs[0], "ownership")
    service = ProgressAlignmentService(assessment, records, teacher_id="teacher")
    with pytest.raises(AssessmentError):
        service.propose_evidence(
            tenant_id="island", student_id=refs[1], report_id=report_ref,
            capability_node="node", construct_ref="construct",
            score_dimension="communication", difficulty=2, prompt_strength=0, agent_version="synthetic",
        )
