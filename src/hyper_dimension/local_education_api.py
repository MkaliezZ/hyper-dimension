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
from hyper_dimension.guardian_authorization import (
    DemoGuardianAuthorizationProvider, GuardianAuthorizationProvider,
)
from hyper_dimension.student_records import StudentRecords
from hyper_dimension.progress_alignment import ProgressAlignmentService
from hyper_dimension.textbook_catalog import TextbookCatalog
from hyper_dimension.teacher_identity import TeacherAuthenticationError, TeacherOIDCVerifier


class Enrollment(BaseModel):
    class_id: str
    display_name: str
    age: int = Field(ge=6, le=15)
    grade: int = Field(ge=1, le=9)
    book_id: str | None = None
    school_progress: str | None = None
    guardian_consent_ref: str | None = None
    public_alias: str | None = None


class ProfileEdit(BaseModel):
    expected_version: int = Field(ge=1)
    display_name: str
    public_alias: str
    teacher_notes: str
    learning_goals: str


class AssignmentRequest(BaseModel):
    idempotency_key: str


class StudentAssignmentLookup(BaseModel):
    access_code: str = Field(min_length=1)
    signed_name: str = Field(min_length=1)
    bundle_ref: str = Field(min_length=1)


class StudentSubmission(BaseModel):
    access_code: str
    signed_name: str
    bundle_ref: str
    attempt_ref: str
    idempotency_key: str
    answers: dict[str, str]


class TextbookBindingRequest(BaseModel):
    edition_ref: str
    section_ref: str
    expected_version: int | None = Field(default=None, ge=0)


class StudentTextbookRebind(BaseModel):
    expected_version: int = Field(ge=1)
    edition_ref: str
    section_ref: str


class ClassMilestone(BaseModel):
    capability_node: str
    prerequisite_nodes: list[str] = Field(default_factory=list)
    construct_ref: str
    score_dimension: str
    target_difficulty: int = Field(ge=1, le=3)
    support_threshold: float = Field(default=60, ge=0, le=100)
    transfer_threshold: float = Field(default=80, ge=0, le=100)
    target_date: str


class AlignmentDecision(BaseModel):
    decision: str
    reason: str
    override_group: str | None = None


class PlanApproval(BaseModel):
    reason: str


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
    tenant_id: str, teacher_id: str, teacher_token: str | None = None,
    teacher_verifier: TeacherOIDCVerifier | None = None,
    guardian_authorization: GuardianAuthorizationProvider | None = None,
    agent_native: bool = False,
    catalog: TextbookCatalog | None = None,
) -> FastAPI:
    if (not tenant_id or not teacher_id or records.teacher_id != teacher_id
            or (teacher_token is None) == (teacher_verifier is None)
            or (teacher_token is not None and len(teacher_token) < 24)):
        raise ValueError("Exactly one bound teacher credential mode required")
    app = FastAPI(title="Hyper Dimension Local Education Prototype")
    consent_provider = guardian_authorization or DemoGuardianAuthorizationProvider()
    alignment = ProgressAlignmentService(assessment, records, teacher_id=teacher_id)
    catalog = catalog or TextbookCatalog(
        assessment.path, assessment, teacher_id=teacher_id,
    )
    if catalog.teacher_id != teacher_id or catalog.assessment is not assessment:
        raise ValueError("Trusted textbook catalog binding required")

    def teacher(authorization: str | None = Header(default=None)) -> str:
        if authorization is None or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Teacher authentication required")
        token = authorization[7:]
        if teacher_verifier is not None:
            try:
                teacher_verifier.verify(
                    token, tenant_id=tenant_id, teacher_id=teacher_id,
                )
            except TeacherAuthenticationError as exc:
                raise HTTPException(
                    status_code=401, detail="Teacher authentication required",
                ) from exc
        elif teacher_token is None or not hmac.compare_digest(token, teacher_token):
            raise HTTPException(status_code=401, detail="Teacher authentication required")
        return teacher_id

    def safe(operation):
        try:
            return operation()
        except AssessmentError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post("/api/v1/teacher/students", dependencies=[Depends(teacher)])
    def enroll(body: Enrollment) -> dict[str, str]:
        decision = consent_provider.resolve_enrollment(body.guardian_consent_ref)
        if agent_native:
            binding = safe(lambda: catalog.class_binding(
                tenant_id=tenant_id, class_id=body.class_id,
            ))
            if binding["status"] == "bound":
                if body.book_id is not None and body.book_id != binding["edition_ref"]:
                    raise HTTPException(
                        status_code=422, detail="Student edition conflicts with class binding",
                    )
                book_id = binding["edition_ref"]
                school_progress = body.school_progress or binding["section_ref"]
                safe(lambda: catalog.require_bound_section(
                    tenant_id=tenant_id, class_id=body.class_id,
                    edition_ref=book_id, section_ref=school_progress,
                ))
            else:
                book_id = body.book_id or "unbound"
                school_progress = body.school_progress or ""
        else:
            # Legacy synthetic API tests have no teacher policy or catalog binding.
            book_id = body.book_id or "unbound"
            school_progress = body.school_progress or ""
        student = safe(lambda: records.create_student(
            tenant_id=tenant_id, class_id=body.class_id,
            display_name=body.display_name, age=body.age, grade=body.grade,
            book_id=book_id, school_progress=school_progress,
            guardian_consent_ref=decision.consent_ref,
            public_alias=body.public_alias,
        ))
        student["consent_assurance"] = decision.assurance
        if decision.showcase_fields:
            student["showcase_consent_ref"] = safe(lambda: records.record_showcase_consent(
                tenant_id=tenant_id, student_id=student["student_ref"],
                guardian_ref=decision.showcase_guardian_ref,
                evidence_ref=decision.showcase_evidence_ref,
                allowed_fields=list(decision.showcase_fields),
            ))
        return student

    @app.get("/api/v1/teacher/classes/{class_ref}/students",
             dependencies=[Depends(teacher)])
    def class_students(class_ref: str) -> dict[str, Any]:
        return safe(lambda: records.list_class_students(tenant_id, class_ref))

    @app.get("/api/v1/teacher/students/{student_ref}", dependencies=[Depends(teacher)])
    def profile(student_ref: str) -> dict[str, Any]:
        return safe(lambda: records.profile(tenant_id, student_ref))

    @app.put("/api/v1/teacher/students/{student_ref}", dependencies=[Depends(teacher)])
    def edit_profile(student_ref: str, body: ProfileEdit) -> dict[str, Any]:
        return safe(lambda: records.edit_profile(
            tenant_id, student_ref, **body.model_dump(),
        ))

    @app.put("/api/v1/teacher/students/{student_ref}/textbook-binding",
             dependencies=[Depends(teacher)])
    def rebind_student_textbook(
        student_ref: str, body: StudentTextbookRebind,
    ) -> dict[str, Any]:
        current = safe(lambda: records.profile(tenant_id, student_ref))
        safe(lambda: catalog.require_bound_section(
            tenant_id=tenant_id, class_id=current["class_id"],
            edition_ref=body.edition_ref, section_ref=body.section_ref,
        ))
        return safe(lambda: records.rebind_textbook(
            tenant_id, student_ref, **body.model_dump(),
        ))

    @app.post("/api/v1/teacher/students/{student_ref}/assignments",
              dependencies=[Depends(teacher)])
    def assignment(student_ref: str, body: AssignmentRequest) -> dict[str, Any]:
        if agent_native:
            raise HTTPException(status_code=409, detail="Teacher Agent submits bundles through MCP")
        return safe(lambda: assessment.create_assignment(
            tenant_id, student_ref, idempotency_key=body.idempotency_key,
        ))

    @app.put("/api/v1/teacher/classes/{class_ref}/textbook-binding",
             dependencies=[Depends(teacher)])
    def bind_textbook(
        class_ref: str, body: TextbookBindingRequest,
    ) -> dict[str, Any]:
        return safe(lambda: catalog.bind_class(
            tenant_id=tenant_id, class_id=class_ref, **body.model_dump(),
        ))

    @app.get("/api/v1/teacher/classes/{class_ref}/milestones",
             dependencies=[Depends(teacher)])
    def class_milestones(class_ref: str) -> dict[str, Any]:
        return {"class_ref": class_ref, "milestones": safe(
            lambda: alignment.class_milestones(tenant_id, class_ref),
        )}

    @app.get("/api/v1/teacher/classes/{class_ref}/alignment-runs",
             dependencies=[Depends(teacher)])
    def class_alignment_runs(class_ref: str) -> dict[str, Any]:
        return {"class_ref": class_ref, "runs": safe(
            lambda: alignment.class_runs(tenant_id, class_ref),
        )}

    @app.get("/api/v1/teacher/alignment-runs/{run_ref}",
             dependencies=[Depends(teacher)])
    def alignment_run(run_ref: str) -> dict[str, Any]:
        return safe(lambda: alignment.run(tenant_id, run_ref))

    @app.post("/api/v1/teacher/classes/{class_ref}/milestones",
              dependencies=[Depends(teacher)])
    def create_milestone(class_ref: str, body: ClassMilestone) -> dict[str, Any]:
        return safe(lambda: alignment.create_milestone(
            tenant_id=tenant_id, class_id=class_ref, **body.model_dump(),
        ))

    @app.get("/api/v1/teacher/students/{student_ref}/alignment-evidence",
             dependencies=[Depends(teacher)])
    def student_alignment_evidence(student_ref: str) -> dict[str, Any]:
        return {"student_ref": student_ref, "evidence": safe(
            lambda: alignment.student_evidence(tenant_id, student_ref),
        )}

    @app.post("/api/v1/teacher/students/{student_ref}/alignment-evidence/{evidence_ref}/confirm",
              dependencies=[Depends(teacher)])
    def confirm_evidence(student_ref: str, evidence_ref: str) -> dict[str, str]:
        return safe(lambda: alignment.confirm_evidence(
            tenant_id, student_ref, evidence_ref,
        ))

    @app.post("/api/v1/teacher/alignment-runs/{run_ref}/students/{student_ref}/decision",
              dependencies=[Depends(teacher)])
    def decide_alignment(
        run_ref: str, student_ref: str, body: AlignmentDecision,
    ) -> dict[str, str]:
        return safe(lambda: alignment.decide(
            tenant_id, run_ref, student_ref, body.decision, body.reason,
            body.override_group,
        ))

    @app.post("/api/v1/teacher/students/{student_ref}/plans/{plan_ref}/approve",
              dependencies=[Depends(teacher)])
    def approve_plan(
        student_ref: str, plan_ref: str, body: PlanApproval,
    ) -> dict[str, str]:
        return safe(lambda: alignment.approve_plan(
            tenant_id, student_ref, plan_ref, body.reason,
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

    @app.post("/api/v1/student/assignments/lookup")
    def student_assignment_lookup(body: StudentAssignmentLookup) -> dict[str, Any]:
        student_ref = safe(lambda: records.verify_student(
            tenant_id, body.access_code, body.signed_name,
        ))
        return safe(lambda: assessment.student_assignment(
            tenant_id, student_ref, body.bundle_ref,
        ))

    @app.post("/api/v1/student/attempts")
    def student_submit(body: StudentSubmission) -> dict[str, Any]:
        student_ref = safe(lambda: records.verify_student(
            tenant_id, body.access_code, body.signed_name,
        ))
        result = safe(lambda: assessment.submit(
            tenant_id=tenant_id, student_id=student_ref,
            bundle_id=body.bundle_ref, attempt_id=body.attempt_ref,
            idempotency_key=body.idempotency_key, answers=body.answers,
            auto_process=not agent_native,
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
