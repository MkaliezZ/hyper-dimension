import copy
import json
import runpy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "english-assessment"
VALIDATE = runpy.run_path(str(SKILL / "scripts" / "validate_bundle.py"))["validate"]
EXAMPLE = json.loads((SKILL / "examples" / "original-formative-bundle.json").read_text(encoding="utf-8"))


def test_original_bundle_passes() -> None:
    assert VALIDATE(EXAMPLE) == []


def test_unreviewed_book_cannot_back_a_question() -> None:
    bundle = copy.deepcopy(EXAMPLE)
    bundle["book_evidence"][0]["content_status"] = "toc_reviewed"
    assert any("lacks reviewed pages" in error for error in VALIDATE(bundle))


def test_listening_requires_real_media_refs() -> None:
    bundle = copy.deepcopy(EXAMPLE)
    bundle["items"][0]["modality"] = "listening"
    assert any("audio and transcript" in error for error in VALIDATE(bundle))

def test_agent_interview_requires_versioned_script() -> None:
    bundle = copy.deepcopy(EXAMPLE)
    bundle["items"][0].pop("interview_script")
    assert any("agent interview requires interview_script" in error for error in VALIDATE(bundle))


READ_WRITE = json.loads((SKILL / "examples" / "reading-writing-grade7-unit1.json").read_text(encoding="utf-8"))


def test_read_write_bundle_passes() -> None:
    assert VALIDATE(READ_WRITE) == []


def test_writing_requires_rubric() -> None:
    bundle = copy.deepcopy(READ_WRITE)
    bundle["items"][2].pop("analytic_rubric")
    assert any("writing requires an analytic rubric" in error for error in VALIDATE(bundle))


def test_reading_mcq_has_key_and_distractor_reasons() -> None:
    item = READ_WRITE["items"][1]
    assert item["task_family"] == "short_message_multiple_choice"
    assert set(item["answer_key"]) == {"Q1", "Q2"}
    assert all(item["distractor_rationales"][q] for q in item["answer_key"])
