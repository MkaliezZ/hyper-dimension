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
