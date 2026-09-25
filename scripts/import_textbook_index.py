"""Import a third-party English-book index as pending PRIVATE metadata only.

Usage: python scripts/import_textbook_index.py INDEX_JSON PRIVATE_CATALOG_DB
No PDF is read or copied. Publisher, school system, TOC and rights remain unverified.
"""
from __future__ import annotations

import json
from pathlib import Path
import sys

from hyper_dimension.textbook_catalog import TextbookCatalog


def import_index(source: Path, catalog: TextbookCatalog) -> dict[str, int]:
    data = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(data.get("books"), list):
        raise ValueError("Index JSON needs a books list")
    counts = {"books": 0, "toc_headings": 0}
    for book in data["books"]:
        if book.get("verification_status") not in {"pending_source", "pending"}:
            raise ValueError("Import only unverified third-party index entries")
        edition = catalog.register_edition(
            publisher=book["publisher_label"],
            series=book.get("series_label") or "未标注",
            school_system="unknown",
            grade=book["grade"],
            volume=book["volume"],
            revision_year=book.get("version_year"),
            source_ref=book["book_url"],
            source_kind="third_party_index",
        )
        if edition["catalog_status"] != "pending":
            raise ValueError("Third-party index cannot confirm an edition")
        counts["books"] += 1
        for position, heading in enumerate(book.get("toc", []), start=1):
            catalog.register_section(
                edition_ref=edition["edition_ref"], ordinal=position,
                title=heading["title"], review_level="E0",
            )
            counts["toc_headings"] += 1
    return counts


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: import_textbook_index.py INDEX_JSON PRIVATE_CATALOG_DB")
    source, destination = (Path(value).resolve() for value in sys.argv[1:])
    if source == destination or destination.suffix.lower() not in {".db", ".sqlite", ".sqlite3"}:
        raise SystemExit("Choose a separate private SQLite catalog destination")
    catalog = TextbookCatalog(destination, None, teacher_id="catalog-importer")
    result = import_index(source, catalog)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
