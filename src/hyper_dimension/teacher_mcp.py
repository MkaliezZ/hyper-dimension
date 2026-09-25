"""Teacher-scoped MCP tools for the local education prototype.

The trusted process binds tenant and teacher. Client-supplied tool arguments cannot
select a different tenant or claim a different actor. Public deployment must add
a verified remote identity gateway before this adapter is exposed over HTTP.
"""
from __future__ import annotations

from typing import Any

from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService
from hyper_dimension.student_records import StudentRecords
from hyper_dimension.progress_alignment import ProgressAlignmentService
from hyper_dimension.textbook_catalog import TextbookCatalog


TEACHER_MCP_TOOL_NAMES = (
    "student_profile_read",
    "student_profile_update",
    "assessment_generation_context_read",
    "assessment_bundle_submit",
    "assessment_pending_attempts_read",
    "assessment_grading_context_read",
    "assessment_grade_submit",
    "assessment_report_read",
    "student_archive_list",
    "student_archive_verify",
    "student_error_history_read",
    "showcase_draft_create",
    "showcase_public_read",
    "class_milestone_read",
    "alignment_evidence_propose",
    "student_capability_evidence_read",
    "class_alignment_preview",
    "student_plan_draft_submit",
    "resolve_textbook_edition",
    "list_textbook_sections",
    "class_textbook_binding_read",
    "search_textbook_evidence",
)


def create_teacher_mcp(
    assessment: AssessmentService,
    records: StudentRecords,
    *,
    tenant_id: str,
    teacher_id: str,
    catalog: TextbookCatalog | None = None,
):
    from mcp.server.fastmcp import FastMCP

    if not tenant_id or not teacher_id or records.teacher_id != teacher_id:
        raise ValueError("A trusted tenant and teacher binding is required")
    server = FastMCP("Hyper Dimension Teacher Education", json_response=True)
    alignment = ProgressAlignmentService(
        assessment, records, teacher_id=teacher_id,
    )
    catalog = catalog or TextbookCatalog(
        assessment.path, assessment, teacher_id=teacher_id,
    )
    if catalog.teacher_id != teacher_id or catalog.assessment is not assessment:
        raise ValueError("Trusted textbook catalog binding required")

    def require_student(student_ref: str) -> dict[str, Any]:
        records.profile(tenant_id, student_ref)
        context = assessment.generation_context(tenant_id, student_ref)
        if context["policy"]["teacher_id"] != teacher_id:
            raise AssessmentError("Student is assigned to another teacher policy")
        binding = catalog.class_binding(
            tenant_id=tenant_id, class_id=context["profile"]["class_id"],
        )
        context["textbook_binding"] = binding
        context["textbook_alignment_status"] = (
            "mismatch" if binding["status"] == "bound" and
            context["profile"]["book_id"] != binding["edition_ref"]
            else "aligned" if binding["status"] == "bound" else "unbound"
        )
        return context

    @server.tool()
    def student_profile_read(student_ref: str) -> dict[str, Any]:
        """Read one private student profile in this teacher island."""
        require_student(student_ref)
        return records.profile(tenant_id, student_ref)

    @server.tool()
    def student_profile_update(
        student_ref: str,
        expected_version: int,
        display_name: str,
        public_alias: str,
        teacher_notes: str,
        learning_goals: str,
    ) -> dict[str, Any]:
        """Save an editable private profile revision; rejects stale versions."""
        require_student(student_ref)
        return records.edit_profile(
            tenant_id, student_ref, expected_version=expected_version,
            display_name=display_name, public_alias=public_alias,
            teacher_notes=teacher_notes, learning_goals=learning_goals,
        )

    @server.tool()
    def assessment_generation_context_read(student_ref: str) -> dict[str, Any]:
        """Read the authorized student and policy context for Agent-authored items."""
        return require_student(student_ref)

    @server.tool()
    def assessment_bundle_submit(
        student_ref: str, idempotency_key: str, bundle: dict[str, Any],
    ) -> dict[str, Any]:
        """Validate and publish an Agent-authored item bundle; no platform model call."""
        context = require_student(student_ref)
        if context["textbook_alignment_status"] == "mismatch":
            raise AssessmentError("Student textbook differs from class binding")
        return assessment.publish_agent_bundle(
            tenant_id, student_ref, bundle, idempotency_key=idempotency_key,
        )

    @server.tool()
    def assessment_pending_attempts_read(class_ref: str) -> dict[str, Any]:
        """List submitted attempt references in the teacher's active class policy."""
        return {"class_ref": class_ref, "attempts": assessment.pending_attempts(
            tenant_id, class_ref, teacher_id,
        )}

    @server.tool()
    def assessment_grading_context_read(
        student_ref: str, attempt_ref: str,
    ) -> dict[str, Any]:
        """Read a pending writing answer and rubric; MCQ answer key stays server-side."""
        require_student(student_ref)
        return assessment.grading_context(tenant_id, student_ref, attempt_ref)

    @server.tool()
    def assessment_grade_submit(
        student_ref: str, attempt_ref: str,
        critique: dict[str, Any], narrative: dict[str, Any],
    ) -> dict[str, Any]:
        """Validate Agent grading, apply teacher policy and archive an approved report."""
        require_student(student_ref)
        result = assessment.process_attempt(
            tenant_id, student_ref, attempt_ref,
            critique=critique, narrative=narrative, agent_supplied=True,
        )
        if result.get("report_id"):
            result["archive"] = records.archive_report(
                tenant_id, student_ref, result["report_id"],
            )
        return result

    @server.tool()
    def assessment_report_read(
        student_ref: str, report_ref: str,
    ) -> dict[str, Any]:
        """Read a private approved report for one student."""
        require_student(student_ref)
        return assessment.report(tenant_id, student_ref, report_ref)

    @server.tool()
    def student_archive_list(student_ref: str) -> dict[str, Any]:
        """List audit references and hashes for one student's private archive."""
        require_student(student_ref)
        return {"student_ref": student_ref, "artifacts": records.artifacts(tenant_id, student_ref)}

    @server.tool()
    def student_archive_verify(student_ref: str, artifact_ref: str) -> dict[str, Any]:
        """Verify a private exported artifact against its database hash."""
        require_student(student_ref)
        return {
            "artifact_ref": artifact_ref,
            "verified": records.verify_artifact(tenant_id, student_ref, artifact_ref),
        }

    @server.tool()
    def student_error_history_read(student_ref: str) -> dict[str, Any]:
        """Read accumulated wrong-item references for one student."""
        require_student(student_ref)
        return {"student_ref": student_ref, "history": assessment.error_history(tenant_id, student_ref)}

    @server.tool()
    def class_milestone_read(milestone_ref: str) -> dict[str, Any]:
        """Read one teacher-confirmed class milestone and its comparison rules."""
        return alignment.milestone(tenant_id, milestone_ref)

    @server.tool()
    def alignment_evidence_propose(
        student_ref: str, report_ref: str, capability_node: str,
        construct_ref: str, score_dimension: str,
        difficulty: int, prompt_strength: int, agent_version: str,
    ) -> dict[str, Any]:
        """Propose a capability tag for an approved report; teacher confirmation is required."""
        return alignment.propose_evidence(
            tenant_id=tenant_id, student_id=student_ref, report_id=report_ref,
            capability_node=capability_node, construct_ref=construct_ref,
            score_dimension=score_dimension, difficulty=difficulty,
            prompt_strength=prompt_strength,
            agent_version=agent_version,
        )

    @server.tool()
    def student_capability_evidence_read(student_ref: str) -> dict[str, Any]:
        """Read confirmed and proposed capability tags for one authorized student."""
        return {"student_ref": student_ref,
                "evidence": alignment.student_evidence(tenant_id, student_ref)}

    @server.tool()
    def class_alignment_preview(milestone_ref: str, idempotency_key: str) -> dict[str, Any]:
        """Compute an immutable class suggestion from confirmed comparable evidence."""
        return alignment.preview(tenant_id, milestone_ref, idempotency_key)

    @server.tool()
    def student_plan_draft_submit(
        run_ref: str, student_ref: str, idempotency_key: str,
        plan: dict[str, Any], agent_version: str,
    ) -> dict[str, Any]:
        """Store a private four-week plan draft; never confirm or publish it."""
        return alignment.plan_draft(
            tenant_id=tenant_id, run_id=run_ref, student_id=student_ref,
            idempotency_key=idempotency_key, plan=plan,
            agent_version=agent_version,
        )

    @server.tool()
    def resolve_textbook_edition(
        class_ref: str, publisher: str, grade: int, volume: str,
        school_system: str | None = None, series: str | None = None,
        revision_year: int | None = None, printing: str | None = None,
        isbn: str | None = None,
    ) -> dict[str, Any]:
        """Resolve edition metadata; ambiguous or unverified records require teacher review."""
        return catalog.resolve_edition(
            tenant_id=tenant_id, class_id=class_ref,
            publisher=publisher, grade=grade, volume=volume,
            school_system=school_system, series=series,
            revision_year=revision_year, printing=printing, isbn=isbn,
        )

    @server.tool()
    def list_textbook_sections(class_ref: str, edition_ref: str) -> dict[str, Any]:
        """List section titles and review levels without textbook body content."""
        return catalog.list_sections(
            tenant_id=tenant_id, class_id=class_ref, edition_ref=edition_ref,
        )

    @server.tool()
    def class_textbook_binding_read(class_ref: str) -> dict[str, Any]:
        """Read this teacher's confirmed class edition and teaching section."""
        return catalog.class_binding(tenant_id=tenant_id, class_id=class_ref)

    @server.tool()
    def search_textbook_evidence(
        class_ref: str, edition_ref: str, section_ref: str, query: str,
    ) -> dict[str, Any]:
        """Read only rights-cleared original summaries with verified page evidence."""
        return catalog.search_evidence(
            tenant_id=tenant_id, class_id=class_ref,
            edition_ref=edition_ref, section_ref=section_ref, query=query,
        )

    @server.tool()
    def showcase_draft_create(
        student_ref: str, slot: str, kind: str, title: str, summary: str,
        source_artifact_ref: str, publication_consent_ref: str,
        before_score: float | None = None, after_score: float | None = None,
        score_unit: str | None = None,
        baseline_artifact_ref: str | None = None,
    ) -> dict[str, Any]:
        """Make a private draft for teacher review; this tool never publishes."""
        require_student(student_ref)
        provided = [before_score is not None, after_score is not None, score_unit is not None]
        if any(provided) and not all(provided):
            raise ValueError("Score evidence needs before_score, after_score and score_unit together")
        metrics = (
            {"before_score": before_score, "after_score": after_score, "unit": score_unit}
            if all(provided) else {}
        )
        entry_ref = records.create_showcase_draft(
            tenant_id=tenant_id, student_id=student_ref,
            slot=slot, kind=kind, title=title, summary=summary,
            metrics=metrics, consent_id=publication_consent_ref,
            source_artifact_id=source_artifact_ref,
            baseline_artifact_id=baseline_artifact_ref,
        )
        return {"entry_ref": entry_ref, "status": "draft", "published": False}

    @server.tool()
    def showcase_public_read(slot: str | None = None) -> dict[str, Any]:
        """Read already published, currently authorized island showcase cards."""
        return {"entries": records.public_showcase(tenant_id, slot)}

    return server
