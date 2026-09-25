"""Synthetic end-to-end DeepSeek smoke test.

Set DEEPSEEK_API_KEY only in the current shell. This script never prints the key,
student text, generated questions or model output. It creates no persistent files.
"""
from __future__ import annotations

import os
from pathlib import Path
import tempfile

from hyper_dimension.agent_deepseek import DeepSeekAssessmentAgent
from hyper_dimension.assessment_runtime import AssessmentService


class ProbeAgent(DeepSeekAssessmentAgent):
    def grade_writing(self, bundle, answer):
        try:
            result = super().grade_writing(bundle, answer)
            print("grade_contract_shape=" + str(set(result) >= {"scores", "confidence", "evidence"}))
            return result
        except Exception as exc:
            print("grade_error_type=" + type(exc).__name__)
            raise

    def draft_report(self, context):
        try:
            result = super().draft_report(context)
            print("report_contract_shape=" + str(set(result) >= {"summary", "strengths", "needs_work", "next_steps"}))
            return result
        except Exception as exc:
            print("report_error_type=" + type(exc).__name__)
            if isinstance(exc, ValueError):
                print("report_error_reason=" + str(exc)[:100])
            raise


def main() -> None:
    agent = ProbeAgent(os.environ["DEEPSEEK_API_KEY"])
    with tempfile.TemporaryDirectory() as temp:
        service = AssessmentService(Path(temp) / "assessment.db", agent)
        service.register_student(
            tenant_id="smoke-demo", student_id="synthetic-student",
            class_id="synthetic-class", age=12, grade=7,
            book_id="synthetic-g7a", school_progress="Unit 1 introductions",
            consent_id="synthetic-consent",
        )
        service.authorize_policy(
            tenant_id="smoke-demo", class_id="synthetic-class",
            teacher_id="synthetic-teacher", policy_id="synthetic-policy",
            weights={"reading": 0.5, "content": 0.15, "communication": 0.15,
                     "organisation": 0.1, "language": 0.1},
            min_confidence=float(os.environ.get("HD_SMOKE_MIN_CONFIDENCE", "0.65")),
        )
        assignment = service.create_assignment("smoke-demo", "synthetic-student")
        answers = {
            q["id"]: q["options"][0] if q["kind"] == "mcq"
            else "Hi, I am new to this school. Would you like to visit the library with me after class?"
            for q in assignment["questions"]
        }
        result = service.submit(
            tenant_id="smoke-demo", student_id="synthetic-student",
            bundle_id=assignment["bundle_id"], attempt_id="synthetic-attempt",
            idempotency_key="synthetic-submit", answers=answers,
        )
        print("question_count=" + str(len(assignment["questions"])))
        print("attempt_status=" + result["status"])
        print("audit_persisted=" + str(bool(service.audit_event(
            "smoke-demo", "synthetic-student", result["audit_event_id"]))))
        print("report_created=" + str(bool(result["report_id"])))


if __name__ == "__main__":
    main()
