import json
from copy import deepcopy
from pathlib import Path

import pytest
from jsonschema import ValidationError

from hyper_dimension.contracts import validate_curriculum_unit


EXAMPLE = Path(__file__).resolve().parents[1] / "examples" / "curriculum" / "pep-2022standard-g3a-u1.json"


def test_draft_unit_package_is_valid() -> None:
    validate_curriculum_unit(json.loads(EXAMPLE.read_text(encoding="utf-8")))


def test_approval_requires_reviewed_source_and_person() -> None:
    unit = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    unit["status"] = "approved"
    unit["edition"]["verification_status"] = "pending_source"
    with pytest.raises(ValidationError):
        validate_curriculum_unit(unit)

    unit["edition"]["verification_status"] = "publisher_verified"
    with pytest.raises(ValidationError):
        validate_curriculum_unit(unit)

    unit["approval"] = {"reviewer": "teacher-demo", "reviewed_at": "2026-09-25T10:00:00Z"}
    with pytest.raises(ValidationError):
        validate_curriculum_unit(unit)

    unit["edition"]["content_review_status"] = "unit_pages_reviewed"
    unit["edition"]["content_review_ref"] = "private:review-evidence-demo"
    validate_curriculum_unit(unit)


def test_external_textbook_excerpt_is_rejected() -> None:
    unit = deepcopy(json.loads(EXAMPLE.read_text(encoding="utf-8")))
    unit["rights"]["textbook_excerpt_included"] = True
    with pytest.raises(ValidationError):
        validate_curriculum_unit(unit)


def test_age_range_and_lesson_order_are_consistent() -> None:
    unit = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    unit["age_range"] = {"min": 10, "max": 8}
    with pytest.raises(ValidationError):
        validate_curriculum_unit(unit)

    unit["age_range"] = {"min": 8, "max": 9}
    unit["lessons"][1]["sequence"] = 1
    with pytest.raises(ValidationError):
        validate_curriculum_unit(unit)


def test_approval_timestamp_must_be_iso_datetime() -> None:
    unit = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    unit["status"] = "approved"
    unit["edition"]["content_review_status"] = "unit_pages_reviewed"
    unit["edition"]["content_review_ref"] = "private:review-evidence-demo"
    unit["approval"] = {"reviewer": "teacher-demo", "reviewed_at": "yesterday"}
    with pytest.raises(ValidationError):
        validate_curriculum_unit(unit)
