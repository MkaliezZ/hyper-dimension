"""Teacher-scoped MCP tools for the local education prototype.

The trusted process binds tenant and teacher. Client-supplied tool arguments cannot
select a different tenant or claim a different actor. Public deployment must add
a verified remote identity gateway before this adapter is exposed over HTTP.
"""
from __future__ import annotations

from typing import Any

from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.student_records import StudentRecords


def create_teacher_mcp(
    assessment: AssessmentService,
    records: StudentRecords,
    *,
    tenant_id: str,
    teacher_id: str,
):
    from mcp.server.fastmcp import FastMCP

    if not tenant_id or not teacher_id or records.teacher_id != teacher_id:
        raise ValueError("A trusted tenant and teacher binding is required")
    server = FastMCP("Hyper Dimension Teacher Education", json_response=True)

    @server.tool()
    def student_profile_read(student_ref: str) -> dict[str, Any]:
        """Read one private student profile in this teacher island."""
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
        return records.edit_profile(
            tenant_id, student_ref, expected_version=expected_version,
            display_name=display_name, public_alias=public_alias,
            teacher_notes=teacher_notes, learning_goals=learning_goals,
        )

    @server.tool()
    def assessment_assignment_create(
        student_ref: str, idempotency_key: str,
    ) -> dict[str, Any]:
        """Generate a private student assignment once per request key."""
        records.profile(tenant_id, student_ref)
        return assessment.create_assignment(
            tenant_id, student_ref, idempotency_key=idempotency_key,
        )

    @server.tool()
    def assessment_report_read(
        student_ref: str, report_ref: str,
    ) -> dict[str, Any]:
        """Read a private approved report for one student."""
        return assessment.report(tenant_id, student_ref, report_ref)

    @server.tool()
    def student_archive_list(student_ref: str) -> dict[str, Any]:
        """List audit references and hashes for one student's private archive."""
        records.profile(tenant_id, student_ref)
        return {"student_ref": student_ref, "artifacts": records.artifacts(tenant_id, student_ref)}

    @server.tool()
    def student_archive_verify(student_ref: str, artifact_ref: str) -> dict[str, Any]:
        """Verify a private exported artifact against its database hash."""
        return {
            "artifact_ref": artifact_ref,
            "verified": records.verify_artifact(tenant_id, student_ref, artifact_ref),
        }

    @server.tool()
    def student_error_history_read(student_ref: str) -> dict[str, Any]:
        """Read accumulated wrong-item references for one student."""
        records.profile(tenant_id, student_ref)
        return {"student_ref": student_ref, "history": assessment.error_history(tenant_id, student_ref)}

    @server.tool()
    def showcase_draft_create(
        student_ref: str, slot: str, kind: str, title: str, summary: str,
        source_artifact_ref: str, publication_consent_ref: str,
        before_score: float | None = None, after_score: float | None = None,
        score_unit: str | None = None,
        baseline_artifact_ref: str | None = None,
    ) -> dict[str, Any]:
        """Make a private draft for teacher review; this tool never publishes."""
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
