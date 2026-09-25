"""Inventory local textbook PDFs without copying their copyrighted contents.

Usage: python scripts/inventory_textbook_pdfs.py SOURCE_DIR OUTPUT_JSON
"""

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

pymupdf.TOOLS.mupdf_display_errors(False)


def inspect(path: Path, root: Path) -> dict:
    rel = path.relative_to(root)
    result = {
        "path": rel.as_posix(),
        "bytes": path.stat().st_size,
        "school_system": "五四制" if "五•四" in rel.parts[0] else "六三制",
        "stage": "初中" if rel.parts[0].startswith("初中") else "小学",
        "publisher_label": rel.parts[1],
        "volume_label": rel.parts[2],
    }
    try:
        with pymupdf.open(path) as doc:
            result["pages"] = doc.page_count
            result["encrypted"] = bool(doc.is_encrypted)
            indices = sorted({0, min(2, doc.page_count - 1), doc.page_count // 2, doc.page_count - 1})
            result["sample_text_chars"] = sum(len(doc[i].get_text()) for i in indices)
            result["sampled_pages"] = [i + 1 for i in indices]
            result["status"] = "readable" if doc.page_count > 0 else "empty"
    except Exception as exc:
        result["status"] = "error"
        result["error"] = f"{type(exc).__name__}: {exc}"
    return result


def main() -> None:
    root, output = map(Path, sys.argv[1:3])
    files = sorted(root.rglob("*.pdf"))
    books = [inspect(path, root) for path in files]
    summary = {
        "files": len(books),
        "total_bytes": sum(book["bytes"] for book in books),
        "status": dict(Counter(book["status"] for book in books)),
        "stage_and_system": dict(Counter(f"{b['school_system']}-{b['stage']}" for b in books)),
        "zero_sample_text": sum(b.get("sample_text_chars", 0) == 0 for b in books),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {"generated_at_utc": datetime.now(timezone.utc).isoformat(), "summary": summary, "books": books},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
