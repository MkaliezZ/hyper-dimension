"""Run the synthetic teacher education API on the local loopback interface.

Set HD_LOCAL_DB, HD_LOCAL_ARCHIVE, HD_TENANT_ID, HD_TEACHER_ID,
HD_TEACHER_TOKEN and DEEPSEEK_API_KEY in the current process. Do not use this
local authentication prototype for real students.
"""
from __future__ import annotations

import os
from pathlib import Path

import uvicorn

from hyper_dimension.agent_deepseek import DeepSeekAssessmentAgent
from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.local_education_api import create_local_education_app
from hyper_dimension.student_records import StudentRecords


def main() -> None:
    database = Path(os.environ["HD_LOCAL_DB"]).resolve()
    archive = Path(os.environ["HD_LOCAL_ARCHIVE"]).resolve()
    database.parent.mkdir(parents=True, exist_ok=True)
    archive.mkdir(parents=True, exist_ok=True)
    assessment = AssessmentService(
        database, DeepSeekAssessmentAgent(os.environ["DEEPSEEK_API_KEY"]),
    )
    records = StudentRecords(assessment, archive, teacher_id=os.environ["HD_TEACHER_ID"])
    app = create_local_education_app(
        assessment, records,
        tenant_id=os.environ["HD_TENANT_ID"],
        teacher_id=os.environ["HD_TEACHER_ID"],
        teacher_token=os.environ["HD_TEACHER_TOKEN"],
    )
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("HD_LOCAL_API_PORT", "8765")))


if __name__ == "__main__":
    main()
