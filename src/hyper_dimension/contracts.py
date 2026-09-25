"""Versioned business-contract validation.

A2A adapters and future web routes should validate the same request envelope.
Validation only checks shape; authorization and consent require server-side records.
"""

from functools import lru_cache
from importlib.resources import files
import json
from typing import Any, Mapping

from jsonschema import Draft202012Validator


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
