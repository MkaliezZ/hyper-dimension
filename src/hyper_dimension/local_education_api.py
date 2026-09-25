"""Opt-in local HTTP adapter for the teacher-first education prototype.

The default public app exposes only /healthz. This factory is for synthetic
development data; real students require production identity and guardian proof.
"""
from __future__ import annotations

import hmac
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService
from hyper_dimension.student_records import StudentRecords


class Enrollment(BaseModel):
    class_id: str
    display_name: str
    age: int = Field(ge=6, le=15)
    grade: int = Field(ge=1, le=9)
    book_id: str
    school_progress: str
    guardian_consent_ref: str
    public_alias: str | None = None


class ProfileEdit(BaseModel):
    expected_version: int = Field(ge=1)
    display_name: str
    public_alias: str
    teacher_notes: str
    learning_goals: str


class AssignmentRequest(BaseModel):
    idempotency_key: str


class StudentSubmission(BaseModel):
    access_code: str
    signed_name: str
    bundle_ref: str
    attempt_ref: str
    idempotency_key: str
    answers: dict[str, str]


class TeacherNote(BaseModel):
    evidence_ref: str
    title: str
    note: str


class PublicationConsent(BaseModel):
    guardian_ref: str
    evidence_ref: str
    allowed_fields: list[str]


class ShowcaseDraft(BaseModel):
    slot: str
    kind: str
    title: str
    summary: str
    metrics: dict[str, Any] = Field(default_factory=dict)
    publication_consent_ref: str
    source_artifact_ref: str
    baseline_artifact_ref: str | None = None


def create_local_education_app(
    assessment: AssessmentService, records: StudentRecords, *,
    tenant_id: str, teacher_id: str, teacher_token: str,
) -> FastAPI:
    if (not all((tenant_id, teacher_id, teacher_token)) or
        len(teacher_token) < 24 or records.teacher_id != teacher_id):
        raise ValueError("Local teacher identity binding and strong token required")
    app = FastAPI(title="Hyper Dimension Local Education Prototype")

    def teacher(authorization: str | None = Header(default=None)) -> str:
        if (authorization is None or not authorization.startswith("Bearer ") or
            not hmac.compare_digest(authorization[7:], teacher_token)):
            raise HTTPException(status_code=401, detail="Teacher authentication required")
        return teacher_id

    def safe(operation):
        try:
            return operation()
        except AssessmentError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post("/api/v1/teacher/students", dependencies=[Depends(teacher)])
    def enroll(body: Enrollment) -> dict[str, str]:
        return safe(lambda: records.create_student(
            tenant_id=tenant_id, class_id=body.class_id,
            display_name=body.display_name, age=body.age, grade=body.grade,
            book_id=body.book_id, school_progress=body.school_progress,
            guardian_consent_ref=body.guardian_consent_ref,
            public_alias=body.public_alias,
        ))

    @app.get("/api/v1/teacher/students/{student_ref}", dependencies=[Depends(teacher)])
    def profile(student_ref: str) -> dict[str, Any]:
        return safe(lambda: records.profile(tenant_id, student_ref))

    @app.put("/api/v1/teacher/students/{student_ref}", dependencies=[Depends(teacher)])
    def edit_profile(student_ref: str, body: ProfileEdit) -> dict[str, Any]:
        return safe(lambda: records.edit_profile(
            tenant_id, student_ref, **body.model_dump(),
        ))

    @app.post("/api/v1/teacher/students/{student_ref}/assignments",
              dependencies=[Depends(teacher)])
    def assignment(student_ref: str, body: AssignmentRequest) -> dict[str, Any]:
        return safe(lambda: assessment.create_assignment(
            tenant_id, student_ref, idempotency_key=body.idempotency_key,
        ))

    @app.get("/api/v1/teacher/students/{student_ref}/archive",
             dependencies=[Depends(teacher)])
    def archive(student_ref: str) -> dict[str, Any]:
        safe(lambda: records.profile(tenant_id, student_ref))
        return {"student_ref": student_ref,
                "artifacts": records.artifacts(tenant_id, student_ref)}

    @app.get("/api/v1/teacher/students/{student_ref}/archive/{artifact_ref}/verify",
             dependencies=[Depends(teacher)])
    def verify_archive(student_ref: str, artifact_ref: str) -> dict[str, Any]:
        return {"artifact_ref": artifact_ref, "verified": safe(
            lambda: records.verify_artifact(tenant_id, student_ref, artifact_ref)
        )}

    @app.post("/api/v1/teacher/students/{student_ref}/notes",
              dependencies=[Depends(teacher)])
    def teacher_note(student_ref: str, body: TeacherNote) -> dict[str, str]:
        return safe(lambda: records.archive_teacher_note(
            tenant_id, student_ref, teacher_id=teacher_id, **body.model_dump(),
        ))

    @app.post("/api/v1/teacher/students/{student_ref}/publication-consents",
              dependencies=[Depends(teacher)])
    def record_publication_consent(
        student_ref: str, body: PublicationConsent,
    ) -> dict[str, str]:
        return {"consent_ref": safe(lambda: records.record_showcase_consent(
            tenant_id=tenant_id, student_id=student_ref, **body.model_dump(),
        ))}

    @app.post("/api/v1/teacher/students/{student_ref}/showcase-drafts",
              dependencies=[Depends(teacher)])
    def showcase_draft(student_ref: str, body: ShowcaseDraft) -> dict[str, str]:
        entry_ref = safe(lambda: records.create_showcase_draft(
            tenant_id=tenant_id, student_id=student_ref,
            slot=body.slot, kind=body.kind, title=body.title,
            summary=body.summary, metrics=body.metrics,
            consent_id=body.publication_consent_ref,
            source_artifact_id=body.source_artifact_ref,
            baseline_artifact_id=body.baseline_artifact_ref,
        ))
        return {"entry_ref": entry_ref, "status": "draft"}

    @app.post("/api/v1/teacher/students/{student_ref}/showcase-drafts/{entry_ref}/publish",
              dependencies=[Depends(teacher)])
    def showcase_publish(student_ref: str, entry_ref: str) -> dict[str, str]:
        safe(lambda: records.publish_showcase(tenant_id, student_ref, entry_ref))
        return {"entry_ref": entry_ref, "status": "published"}

    @app.post("/api/v1/student/attempts")
    def student_submit(body: StudentSubmission) -> dict[str, Any]:
        student_ref = safe(lambda: records.verify_student(
            tenant_id, body.access_code, body.signed_name,
        ))
        result = safe(lambda: assessment.submit(
            tenant_id=tenant_id, student_id=student_ref,
            bundle_id=body.bundle_ref, attempt_id=body.attempt_ref,
            idempotency_key=body.idempotency_key, answers=body.answers,
        ))
        if result.get("report_id"):
            result["archive"] = safe(lambda: records.archive_report(
                tenant_id, student_ref, result["report_id"],
            ))
        return result

    @app.get("/api/v1/showcase")
    def public_showcase(slot: str | None = None) -> dict[str, Any]:
        return {"entries": safe(lambda: records.public_showcase(tenant_id, slot))}

    return app
