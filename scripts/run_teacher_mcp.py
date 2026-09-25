"""Launch the local teacher MCP adapter over stdio.

This is a developer prototype bound to one local teacher process. It is not a
production login or an internet-facing MCP endpoint. Keep the database and
archive outside the Git checkout.
"""
from __future__ import annotations

import os
from pathlib import Path

from hyper_dimension.agent_deepseek import DeepSeekAssessmentAgent
from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService
from hyper_dimension.student_records import StudentRecords
from hyper_dimension.teacher_mcp import create_teacher_mcp


class NoModelConfigured:
    def generate(self, profile, policy):
        raise AssessmentError("DEEPSEEK_API_KEY is required to generate assignments")

    def grade_writing(self, bundle, answer):
        raise AssessmentError("No model configured")

    def draft_report(self, context):
        raise AssessmentError("No model configured")


def main() -> None:
    tenant_id = os.environ["HD_TENANT_ID"]
    teacher_id = os.environ["HD_TEACHER_ID"]
    database = Path(os.environ["HD_LOCAL_DB"]).resolve()
    archive = Path(os.environ["HD_LOCAL_ARCHIVE"]).resolve()
    database.parent.mkdir(parents=True, exist_ok=True)
    archive.mkdir(parents=True, exist_ok=True)
    key = os.environ.get("DEEPSEEK_API_KEY")
    agent = DeepSeekAssessmentAgent(key) if key else NoModelConfigured()
    assessment = AssessmentService(database, agent)
    records = StudentRecords(assessment, archive, teacher_id=os.environ["HD_TEACHER_ID"])
    create_teacher_mcp(
        assessment, records, tenant_id=tenant_id, teacher_id=teacher_id,
    ).run(transport="stdio")


if __name__ == "__main__":
    main()
