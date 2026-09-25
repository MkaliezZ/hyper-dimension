"""Run a synthetic local assessment. No real student data or model key is used."""
from __future__ import annotations

import json
from pathlib import Path
import tempfile

from hyper_dimension.assessment_runtime import AssessmentService


class SyntheticAgent:
    def generate(self, profile: dict, policy: dict) -> dict:
        context = profile["school_progress"]
        grade = profile["grade"]
        return {
            "agent_version": "synthetic-demo-v1",
            "questions": [
                {"id": "r1", "kind": "mcq",
                 "prompt": f"Grade {grade}: In a school notice about {context}, where is the meeting?",
                 "options": ["Library", "Playground", "Canteen"]},
                {"id": "r2", "kind": "mcq",
                 "prompt": "A student needs a storybook. Which place should they visit?",
                 "options": ["Library", "Playground", "Canteen"]},
                {"id": "w1", "kind": "writing",
                 "prompt": f"Write a short message inviting a classmate to a {context} activity."},
            ],
            "answer_key": {"r1": "Playground", "r2": "Library"},
            "rubric": {
                "content": "Includes an invitation and activity details.",
                "communication": "Makes the message clear to the classmate.",
                "organisation": "Uses a readable message order.",
                "language": "Uses understandable English for the task.",
            },
        }

    def draft_report(self, context: dict) -> dict:
        return {"summary": "Synthetic diagnostic demonstration only.",
                "strengths": ["Reading answer recorded."],
                "needs_work": ["Writing needs a real teacher-validated rubric."],
                "next_steps": ["Try a new short message in another context."]}

    def grade_writing(self, bundle: dict, answer: str) -> dict:
        # Synthetic scores exercise the service; they are not educationally valid.
        score = min(100, 40 + len(answer.split()) * 5)
        return {
            "scores": {key: score for key in ("content", "communication", "organisation", "language")},
            "confidence": 0.9,
            "evidence": "Synthetic demo: word count only; no educational interpretation.",
        }


def main() -> None:
    with tempfile.TemporaryDirectory() as temp:
        service = AssessmentService(Path(temp) / "assessment.sqlite3", SyntheticAgent())
        service.register_student(
            tenant_id="demo", student_id="student-01", class_id="class-01",
            age=12, grade=7, book_id="pep-g7a", school_progress="Unit 1",
            consent_id="synthetic-consent-01",
        )
        service.authorize_policy(
            tenant_id="demo", class_id="class-01", teacher_id="teacher-01",
            policy_id="policy-01",
            weights={"reading": 0.5, "content": 0.15, "communication": 0.15,
                     "organisation": 0.1, "language": 0.1},
        )
        assignment = service.create_assignment("demo", "student-01")
        result = service.submit(
            tenant_id="demo", student_id="student-01",
            bundle_id=assignment["bundle_id"], attempt_id="attempt-01",
            idempotency_key="submit-01",
            answers={"r1": "Playground", "r2": "Library",
                     "w1": "Please come to our Unit 1 activity after school."},
        )
        print(json.dumps({"assignment": assignment, "result": result,
                          "report": service.report("demo", "student-01", result["report_id"]),
                          "submission_event": service.audit_event(
                              "demo", "student-01", result["audit_event_id"])},
                         ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
