"""Canonical Hyper Dimension education A2A business profile, version 1.2.

A2A transports JSON DataParts. This module defines intent and shape only;
the server must authenticate the caller and authorize every referenced record.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from jsonschema import Draft202012Validator, ValidationError

VERSION = "1.2"
PREFIX = "hd.education."


def _string(max_length: int = 128) -> dict[str, Any]:
    return {"type": "string", "minLength": 1, "maxLength": max_length, "pattern": r"\S"}


def _object(required: tuple[str, ...] = (), **properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": list(required),
        "properties": properties,
    }


@dataclass(frozen=True)
class Operation:
    purpose: str
    role: str
    student: bool
    mutation: bool
    payload: dict[str, Any]


EMPTY = _object()
OPERATIONS: dict[str, Operation] = {
    PREFIX + "plan.read.v1": Operation("learning", "student", True, False, EMPTY),
    PREFIX + "assignment.read.v1": Operation(
        "learning", "student", True, False,
        _object(("assignment_ref",), assignment_ref=_string())),
    PREFIX + "evidence.submit.v1": Operation(
        "learning", "student", True, True,
        _object(("assignment_ref", "attempt_ref", "response_ref"),
                assignment_ref=_string(), attempt_ref=_string(), response_ref=_string())),
    PREFIX + "feedback.request.v1": Operation(
        "learning", "student", True, False,
        _object(("submission_ref",), submission_ref=_string())),
    PREFIX + "teacher_help.request.v1": Operation(
        "learning", "student", True, True,
        _object(("assignment_ref", "question"),
                assignment_ref=_string(), question=_string(1000))),
    PREFIX + "student.profile.read.v1": Operation(
        "student_record", "teacher", True, False, EMPTY),
    PREFIX + "student.profile.update.v1": Operation(
        "student_record", "teacher", True, True,
        _object(("expected_version", "display_name", "public_alias",
                 "teacher_notes", "learning_goals"),
                expected_version={"type": "integer", "minimum": 1},
                display_name=_string(80), public_alias=_string(80),
                teacher_notes={"type": "string", "maxLength": 6000},
                learning_goals={"type": "string", "maxLength": 3000})),
    PREFIX + "student.archive.list.v1": Operation(
        "student_record", "teacher", True, False, EMPTY),
    PREFIX + "student.archive.verify.v1": Operation(
        "student_record", "teacher", True, False,
        _object(("artifact_ref",), artifact_ref=_string())),
    PREFIX + "showcase.draft.create.v1": Operation(
        "public_showcase", "teacher", True, True,
        _object(("slot", "kind", "title", "summary", "source_artifact_ref",
                 "publication_consent_ref"),
                slot={"enum": ["learning", "portfolio", "honors"]},
                kind={"enum": ["improvement", "honor"]},
                title=_string(100), summary=_string(500),
                source_artifact_ref=_string(),
                publication_consent_ref=_string(),
                baseline_artifact_ref=_string(),
                metrics=_object(("before_score", "after_score", "unit"),
                                before_score={"type": "number", "minimum": 0, "maximum": 100},
                                after_score={"type": "number", "minimum": 0, "maximum": 100},
                                unit=_string(20)))),
    PREFIX + "showcase.public.read.v1": Operation(
        "public_showcase", "public", False, False,
        _object(slot={"enum": ["learning", "portfolio", "honors"]})),
}

REASON_BY_STATUS = {
    "completed": ("OK",),
    "accepted": ("QUEUED",),
    "pending_review": ("REVIEW_REQUIRED",),
    "needs_consent": ("CONSENT_REQUIRED",),
    "rejected": ("INVALID_REQUEST", "UNAUTHENTICATED", "UNAUTHORIZED",
                 "NOT_FOUND", "VERSION_CONFLICT", "IDEMPOTENCY_CONFLICT",
                 "POLICY_BLOCKED", "REFERENCE_MISMATCH", "RATE_LIMITED"),
}
RESULT_REF_BY_OPERATION = {
    PREFIX + "plan.read.v1": "plan",
    PREFIX + "assignment.read.v1": "assignment",
    PREFIX + "evidence.submit.v1": "submission",
    PREFIX + "feedback.request.v1": "feedback",
    PREFIX + "teacher_help.request.v1": "teacher_help",
    PREFIX + "student.profile.read.v1": "profile",
    PREFIX + "student.profile.update.v1": "profile",
    PREFIX + "student.archive.list.v1": "artifact",
    PREFIX + "student.archive.verify.v1": "artifact",
    PREFIX + "showcase.draft.create.v1": "showcase_entry",
    PREFIX + "showcase.public.read.v1": "showcase_entry",
}


def command_schema() -> dict[str, Any]:
    cases = []
    for name, spec in OPERATIONS.items():
        case: dict[str, Any] = {
            "properties": {
                "operation": {"const": name},
                "purpose": {"const": spec.purpose},
                "payload": spec.payload,
            },
            "required": ["student_ref"] if spec.student else [],
        }
        if not spec.student:
            case["not"] = {"required": ["student_ref"]}
        if name.endswith("showcase.draft.create.v1"):
            case["properties"]["payload"] = {
                **spec.payload,
                "allOf": [
                    {"if": {"properties": {"kind": {"const": "improvement"}},
                            "required": ["kind"]},
                     "then": {"required": ["metrics", "baseline_artifact_ref"]}},
                    {"if": {"properties": {"kind": {"const": "honor"}},
                            "required": ["kind"]},
                     "then": {"not": {"anyOf": [
                         {"required": ["metrics"]},
                         {"required": ["baseline_artifact_ref"]}]}}},
                ],
            }
        cases.append(case)
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:hyperdimension:education:command:1.2",
        "title": "Hyper Dimension Education Command 1.2",
        **_object(
            ("protocol_version", "operation", "request_id", "island_id",
             "idempotency_key", "purpose", "payload"),
            protocol_version={"const": VERSION},
            operation={"enum": list(OPERATIONS)},
            request_id=_string(),
            island_id=_string(),
            student_ref={"type": "string", "pattern": r"^stu_[0-9a-f]{32}$"},
            idempotency_key=_string(),
            purpose={"enum": ["learning", "student_record", "public_showcase"]},
            payload={"type": "object"},
        ),
        "oneOf": cases,
    }


def result_schema() -> dict[str, Any]:
    reference = _object(("kind", "ref"),
                        kind={"enum": sorted(set(RESULT_REF_BY_OPERATION.values()))}, ref=_string())
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:hyperdimension:education:result:1.2",
        "title": "Hyper Dimension Education Result 1.2",
        **_object(
            ("protocol_version", "request_id", "operation", "status",
             "reason_code", "record_refs", "audit_event_id"),
            protocol_version={"const": VERSION},
            request_id=_string(),
            operation={"enum": list(OPERATIONS)},
            status={"enum": list(REASON_BY_STATUS)},
            reason_code={"enum": sorted({r for codes in REASON_BY_STATUS.values() for r in codes})},
            record_refs={"type": "array", "maxItems": 20, "items": reference},
            audit_event_id=_string(),
        ),
        "allOf": [
            {"if": {"properties": {"status": {"const": status}}, "required": ["status"]},
             "then": {"properties": {"reason_code": {"enum": list(codes)}}}}
            for status, codes in REASON_BY_STATUS.items()
        ] + [
            {"if": {"properties": {"status": {"enum": ["rejected", "needs_consent"]}},
                    "required": ["status"]},
             "then": {"properties": {"record_refs": {"maxItems": 0}}}},
        ] + [
            {"if": {"properties": {"operation": {"const": name}}, "required": ["operation"]},
             "then": {"properties": {"record_refs": {"items": {
                 "properties": {"kind": {"const": kind}}}}}}}
            for name, kind in RESULT_REF_BY_OPERATION.items()
        ],
    }


COMMAND_VALIDATOR = Draft202012Validator(command_schema())
RESULT_VALIDATOR = Draft202012Validator(result_schema())


def validate_profile_command(value: Mapping[str, Any]) -> None:
    COMMAND_VALIDATOR.validate(dict(value))


def validate_profile_result(value: Mapping[str, Any], request: Mapping[str, Any] | None = None) -> None:
    RESULT_VALIDATOR.validate(dict(value))
    if request is not None:
        validate_profile_command(request)
        if value["request_id"] != request["request_id"] or value["operation"] != request["operation"]:
            raise ValidationError("Result request_id and operation must match the command")


def profile_from_a2a_part(part: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(part, Mapping) or set(part) != {"data", "mediaType"}:
        raise ValidationError("Expected exactly one A2A v1 JSON DataPart")
    if part["mediaType"] != "application/json" or not isinstance(part["data"], dict):
        raise ValidationError("A2A part must contain JSON structured data")
    validate_profile_command(part["data"])
    return dict(part["data"])


def profile_to_a2a_part(command: Mapping[str, Any]) -> dict[str, Any]:
    validate_profile_command(command)
    return {"data": dict(command), "mediaType": "application/json"}


def profile_result_to_a2a_part(result: Mapping[str, Any],
                               request: Mapping[str, Any] | None = None) -> dict[str, Any]:
    validate_profile_result(result, request)
    return {"data": dict(result), "mediaType": "application/json"}
