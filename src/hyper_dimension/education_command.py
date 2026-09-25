"""Strict A2A DataPart mapping for the versioned education command.

A2A carries the part. This adapter validates only business intent; identity and
authorization are established by the transport and server, never by message text.
"""
from __future__ import annotations

from functools import lru_cache
from importlib.resources import files
import json
from typing import Any, Mapping

from jsonschema import Draft202012Validator, ValidationError


@lru_cache(maxsize=1)
def _validator() -> Draft202012Validator:
    schema = json.loads(
        (files("hyper_dimension") / "schemas" /
         "hd-education-command-v1.1.schema.json").read_text(encoding="utf-8")
    )
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def validate_command(command: Mapping[str, Any]) -> None:
    _validator().validate(dict(command))


def command_from_a2a_part(part: Mapping[str, Any]) -> dict[str, Any]:
    """Accept only a v1 A2A JSON DataPart, never infer actions from text."""
    if not isinstance(part, Mapping) or set(part) != {"data", "mediaType"}:
        raise ValidationError("Expected exactly one A2A v1 JSON DataPart")
    if part["mediaType"] != "application/json" or not isinstance(part["data"], dict):
        raise ValidationError("A2A part must contain JSON structured data")
    command = part["data"]
    validate_command(command)
    return dict(command)


def command_to_a2a_part(command: Mapping[str, Any]) -> dict[str, Any]:
    validate_command(command)
    return {"data": dict(command), "mediaType": "application/json"}

@lru_cache(maxsize=1)
def _result_validator() -> Draft202012Validator:
    schema = json.loads(
        (files("hyper_dimension") / "schemas" /
         "hd-education-command-result-v1.1.schema.json").read_text(encoding="utf-8")
    )
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def validate_command_result(result: Mapping[str, Any]) -> None:
    _result_validator().validate(dict(result))


def result_to_a2a_part(result: Mapping[str, Any]) -> dict[str, Any]:
    validate_command_result(result)
    return {"data": dict(result), "mediaType": "application/json"}
