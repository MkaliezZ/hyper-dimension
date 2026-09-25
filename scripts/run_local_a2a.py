"""Run the optional A2A read prototype on loopback with synthetic data only.

Required: HD_LOCAL_DB, HD_LOCAL_ARCHIVE, HD_TENANT_ID, HD_TEACHER_ID,
HD_TEACHER_TOKEN. Never expose this static-token prototype to the internet.
"""
from __future__ import annotations

import os
from pathlib import Path

import uvicorn

from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.local_a2a import create_local_a2a_app
from hyper_dimension.student_records import StudentRecords


class ReadOnlyAgent:
    """The A2A read adapter must never invoke model generation or grading."""

    def generate(self, *args):
        raise RuntimeError("Read-only A2A process cannot generate assignments")

    def grade_writing(self, *args):
        raise RuntimeError("Read-only A2A process cannot grade")

    def draft_report(self, *args):
        raise RuntimeError("Read-only A2A process cannot draft reports")


def main() -> None:
    database = Path(os.environ["HD_LOCAL_DB"]).resolve()
    archive = Path(os.environ["HD_LOCAL_ARCHIVE"]).resolve()
    if not database.is_file() or not archive.is_dir():
        raise ValueError("Existing synthetic database and archive required")
    port = int(os.environ.get("HD_LOCAL_A2A_PORT", "8770"))
    if not (1 <= port <= 65535):
        raise ValueError("Invalid A2A port")
    assessment = AssessmentService(database, ReadOnlyAgent())
    records = StudentRecords(
        assessment, archive, teacher_id=os.environ["HD_TEACHER_ID"])
    app = create_local_a2a_app(
        records, tenant_id=os.environ["HD_TENANT_ID"],
        teacher_id=os.environ["HD_TEACHER_ID"],
        teacher_token=os.environ["HD_TEACHER_TOKEN"],
        base_url=f"http://127.0.0.1:{port}",
    )
    uvicorn.run(app, host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
