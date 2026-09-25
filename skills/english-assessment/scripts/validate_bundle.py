"""Check assessment bundle cross-references and high-risk omissions.

Usage: python validate_bundle.py BUNDLE_JSON
"""

import json
import sys
from pathlib import Path


def validate(data: dict) -> list[str]:
    errors = []
    books = {book.get("book_id"): book for book in data.get("book_evidence", [])}
    items = data.get("items", [])
    if not books:
        errors.append("book_evidence is empty")
    if not items:
        errors.append("items is empty")
    for book_id, book in books.items():
        if not book_id or not book.get("relative_pdf_path"):
            errors.append("book evidence lacks ID or relative PDF path")
        if book.get("content_status") in {"pages_reviewed", "full_reviewed"} and not book.get("pdf_page_refs"):
            errors.append(f"{book_id}: reviewed content lacks PDF page references")
    blueprint = data.get("blueprint", {})
    for book_id in blueprint.get("book_ids", []):
        if book_id not in books:
            errors.append(f"blueprint references missing book {book_id}")
    seen = set()
    for item in items:
        item_id = item.get("item_id", "<missing-id>")
        if item_id in seen:
            errors.append(f"{item_id}: duplicate item ID")
        seen.add(item_id)
        for field in ("version", "target_behaviour", "prompt", "explanation", "review_status"):
            if not item.get(field):
                errors.append(f"{item_id}: missing {field}")
        if item.get("origin") != "original":
            errors.append(f"{item_id}: origin must be original")
        if not item.get("cefr_descriptor_refs"):
            errors.append(f"{item_id}: missing CEFR reference")
        if not item.get("knowledge_tags"):
            errors.append(f"{item_id}: missing knowledge tags")
        for book_id in item.get("book_evidence_refs", []):
            if book_id not in books:
                errors.append(f"{item_id}: missing book evidence {book_id}")
            elif books[book_id].get("content_status") not in {"pages_reviewed", "full_reviewed"}:
                errors.append(f"{item_id}: book {book_id} lacks reviewed pages")
        modality = item.get("modality")
        if modality == "listening" and not (item.get("audio_ref") and item.get("transcript_ref")):
            errors.append(f"{item_id}: listening requires audio and transcript references")
        if modality and modality.startswith("speaking") and not item.get("analytic_rubric"):
            errors.append(f"{item_id}: speaking requires an analytic rubric")
        if modality in {"reading", "listening"} and not item.get("answer_key"):
            errors.append(f"{item_id}: objective task requires an answer key")
    return errors


def main() -> None:
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    errors = validate(data)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        raise SystemExit(1)
    print(f"Valid bundle structure: {len(data['items'])} item(s)")


if __name__ == "__main__":
    main()
