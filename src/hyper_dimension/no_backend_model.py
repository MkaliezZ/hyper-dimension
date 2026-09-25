"""Fail-closed placeholder: teacher Agent owns inference in the MCP workflow."""
from __future__ import annotations

from hyper_dimension.assessment_runtime import AssessmentError


class NoBackendModel:
    def generate(self, profile, policy):
        raise AssessmentError("Teacher Agent must submit an item bundle through MCP")

    def grade_writing(self, bundle, answer):
        raise AssessmentError("Teacher Agent must submit a grading draft through MCP")

    def draft_report(self, context):
        raise AssessmentError("Teacher Agent must submit a report draft through MCP")
