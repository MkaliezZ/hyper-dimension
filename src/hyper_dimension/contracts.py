"""Versioned business-contract validation.

A2A adapters and future web routes should validate the same request envelope.
Validation only checks shape; authorization and consent require server-side records.
"""

from datetime import datetime
from functools import lru_cache
from importlib.resources import files
import json
import re
from typing import Any, Mapping

from jsonschema import Draft202012Validator, FormatChecker, ValidationError


@lru_cache(maxsize=2)
def _validator(kind: str) -> Draft202012Validator:
    if kind not in {"request", "result"}:
        raise ValueError("Unknown education contract kind")
    name = f"hd-education-{kind}.schema.json"
    text = (files("hyper_dimension") / "schemas" / name).read_text(encoding="utf-8")
    schema = json.loads(text)
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def validate_education_request(value: Mapping[str, Any]) -> None:
    """Validate a v1 request envelope; raises jsonschema.ValidationError."""
    _validator("request").validate(dict(value))


def validate_education_result(value: Mapping[str, Any]) -> None:
    """Validate a v1 result envelope; raises jsonschema.ValidationError."""
    _validator("result").validate(dict(value))


@lru_cache(maxsize=1)
def _curriculum_validator() -> Draft202012Validator:
    name = "curriculum-unit.schema.json"
    text = (files("hyper_dimension") / "schemas" / name).read_text(encoding="utf-8")
    schema = json.loads(text)
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_curriculum_unit(value: Mapping[str, Any]) -> None:
    """Validate the authored unit-package format; approval is separate."""
    unit = dict(value)
    _curriculum_validator().validate(unit)
    reviewed_at = unit["approval"]["reviewed_at"]
    if reviewed_at is not None:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", reviewed_at):
            raise ValidationError("approval.reviewed_at must be an ISO 8601 timestamp with a timezone")
        try:
            datetime.fromisoformat(reviewed_at.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValidationError("approval.reviewed_at is not a valid date and time") from exc
    ages = unit["age_range"]
    if ages["min"] > ages["max"]:
        raise ValidationError("age_range min must not exceed max")
    sequence = [lesson["sequence"] for lesson in unit["lessons"]]
    if sequence != list(range(1, len(sequence) + 1)):
        raise ValidationError("lessons must be numbered 1..n in order")
