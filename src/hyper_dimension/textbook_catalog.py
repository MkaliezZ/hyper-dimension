"""Cluster-shared textbook metadata prototype with explicit rights and review gates.

This service stores metadata and original summaries only. It never stores textbook
pages or file paths. Internal catalog writes require a trusted operator; teacher
MCP tools expose only scoped reads, and binding requires a protected teacher API.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
from typing import Any, Iterator

from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService


REVIEW_LEVELS = {"E0": 0, "E1": 1, "E2": 2, "E3": 3, "E4": 4}
RIGHTS_SCOPES = {"unreviewed", "metadata_only", "summary_allowed"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _ref(prefix: str, value: Any) -> str:
    return prefix + "_" + hashlib.sha256(_json(value).encode("utf-8")).hexdigest()[:32]


def _required(value: str | None, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise AssessmentError(label + " required")
    return value.strip()


class TextbookCatalog:
    def __init__(self, path: str | Path, assessment: AssessmentService | None, *, teacher_id: str):
        if not teacher_id:
            raise ValueError("Trusted teacher ID required")
        self.path = str(path)
        self.assessment = assessment
        self.teacher_id = teacher_id
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self._db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS textbook_editions (
                    edition_ref TEXT PRIMARY KEY, publisher TEXT NOT NULL,
                    series TEXT NOT NULL, school_system TEXT NOT NULL,
                    grade INTEGER NOT NULL, volume TEXT NOT NULL,
                    revision_year INTEGER, printing TEXT, isbn TEXT,
                    source_ref TEXT NOT NULL UNIQUE, source_kind TEXT NOT NULL,
                    catalog_status TEXT NOT NULL, identity_evidence_ref TEXT,
                    verified_by TEXT, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS textbook_assets (
                    asset_hash TEXT NOT NULL, edition_ref TEXT PRIMARY KEY,
                    bytes INTEGER NOT NULL, pages INTEGER NOT NULL,
                    source_evidence_ref TEXT NOT NULL, verified_by TEXT NOT NULL,
                    rights_scope TEXT NOT NULL, rights_evidence_ref TEXT,
                    rights_reviewed_by TEXT, created_at TEXT NOT NULL,
                    FOREIGN KEY (edition_ref) REFERENCES textbook_editions(edition_ref)
                );
                CREATE TABLE IF NOT EXISTS textbook_sections (
                    section_ref TEXT PRIMARY KEY, edition_ref TEXT NOT NULL,
                    ordinal INTEGER NOT NULL, revision INTEGER NOT NULL,
                    title TEXT NOT NULL, page_start INTEGER, page_end INTEGER,
                    review_level TEXT NOT NULL, review_evidence_ref TEXT,
                    summary TEXT, summary_status TEXT NOT NULL,
                    reviewed_by TEXT, second_reviewer TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE (edition_ref,ordinal,revision),
                    FOREIGN KEY (edition_ref) REFERENCES textbook_editions(edition_ref)
                );
                CREATE TABLE IF NOT EXISTS textbook_rights_reviews (
                    review_ref TEXT PRIMARY KEY, edition_ref TEXT NOT NULL,
                    scope TEXT NOT NULL, rights_evidence_ref TEXT NOT NULL UNIQUE,
                    reviewed_by TEXT NOT NULL, reviewed_at TEXT NOT NULL,
                    FOREIGN KEY (edition_ref) REFERENCES textbook_editions(edition_ref)
                );
                CREATE TABLE IF NOT EXISTS teacher_textbook_bindings (
                    tenant_id TEXT NOT NULL, class_id TEXT NOT NULL,
                    teacher_id TEXT NOT NULL, edition_ref TEXT NOT NULL,
                    section_ref TEXT NOT NULL, version INTEGER NOT NULL,
                    confirmed_at TEXT NOT NULL,
                    PRIMARY KEY (tenant_id,class_id),
                    FOREIGN KEY (edition_ref) REFERENCES textbook_editions(edition_ref),
                    FOREIGN KEY (section_ref) REFERENCES textbook_sections(section_ref)
                );
                CREATE TABLE IF NOT EXISTS textbook_binding_revisions (
                    tenant_id TEXT NOT NULL, class_id TEXT NOT NULL,
                    teacher_id TEXT NOT NULL, edition_ref TEXT NOT NULL,
                    section_ref TEXT NOT NULL, version INTEGER NOT NULL,
                    confirmed_at TEXT NOT NULL,
                    PRIMARY KEY (tenant_id,class_id,version)
                );
                CREATE TABLE IF NOT EXISTS textbook_catalog_audit (
                    event_ref TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    class_id TEXT NOT NULL, actor_id TEXT NOT NULL,
                    event_type TEXT NOT NULL, object_ref TEXT NOT NULL,
                    occurred_at TEXT NOT NULL
                );
            """)
            asset_primary_key = [
                row["name"] for row in db.execute("PRAGMA table_info(textbook_assets)")
                if row["pk"]
            ]
            if asset_primary_key == ["asset_hash"]:
                db.executescript("""
                    CREATE TABLE textbook_assets_v2 (
                        asset_hash TEXT NOT NULL, edition_ref TEXT PRIMARY KEY,
                        bytes INTEGER NOT NULL, pages INTEGER NOT NULL,
                        source_evidence_ref TEXT NOT NULL, verified_by TEXT NOT NULL,
                        rights_scope TEXT NOT NULL, rights_evidence_ref TEXT,
                        rights_reviewed_by TEXT, created_at TEXT NOT NULL,
                        FOREIGN KEY (edition_ref) REFERENCES textbook_editions(edition_ref)
                    );
                    INSERT INTO textbook_assets_v2 SELECT * FROM textbook_assets;
                    DROP TABLE textbook_assets;
                    ALTER TABLE textbook_assets_v2 RENAME TO textbook_assets;
                """)

    @contextmanager
    def _db(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def _teacher_class(self, tenant_id: str, class_id: str) -> None:
        if self.assessment is None:
            raise AssessmentError("Catalog admin process has no teacher access")
        with self.assessment._db() as db:
            row = db.execute(
                """SELECT teacher_id FROM teacher_policies WHERE tenant_id=?
                   AND class_id=? AND active=1 ORDER BY version DESC LIMIT 1""",
                (tenant_id, class_id),
            ).fetchone()
        if row is None or row["teacher_id"] != self.teacher_id:
            raise AssessmentError("No active teacher policy for class")

    def register_edition(
        self, *, publisher: str, series: str, school_system: str,
        grade: int, volume: str, source_ref: str, source_kind: str,
        revision_year: int | None = None, printing: str | None = None,
        isbn: str | None = None, identity_evidence_ref: str | None = None,
        verified_by: str | None = None,
    ) -> dict[str, Any]:
        """Trusted catalog-admin ingestion. Third-party indexes stay pending."""
        publisher = _required(publisher, "Publisher")
        series = _required(series, "Series")
        volume = _required(volume, "Volume")
        source_ref = _required(source_ref, "Source")
        source_kind = _required(source_kind, "Source kind")
        if school_system not in {"unknown", "六三制", "五四制"} or type(grade) is not int or not 1 <= grade <= 9:
            raise AssessmentError("Invalid school system or grade")
        if revision_year is not None and (type(revision_year) is not int or not 1900 <= revision_year <= 2100):
            raise AssessmentError("Invalid revision year")
        confirmed = bool(identity_evidence_ref and verified_by)
        if bool(identity_evidence_ref) != bool(verified_by):
            raise AssessmentError("Identity evidence and reviewer must appear together")
        if confirmed and (school_system == "unknown" or not (printing or isbn)):
            raise AssessmentError("Confirmed edition needs school system and printing or ISBN")
        identity = {
            "publisher": publisher, "series": series, "school_system": school_system,
            "grade": grade, "volume": volume, "revision_year": revision_year,
            "printing": printing, "isbn": isbn, "source_ref": source_ref,
        }
        edition_ref = _ref("ed", identity)
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            prior = db.execute(
                "SELECT * FROM textbook_editions WHERE source_ref=?", (source_ref,),
            ).fetchone()
            if prior is not None:
                if prior["edition_ref"] != edition_ref:
                    raise AssessmentError("Source reference reused with different edition identity")
                if (prior["identity_evidence_ref"], prior["verified_by"]) != (
                    identity_evidence_ref, verified_by,
                ):
                    raise AssessmentError("Identity review changed; register a new verified source")
                return dict(prior)
            db.execute(
                "INSERT INTO textbook_editions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (edition_ref, publisher, series, school_system, grade, volume,
                 revision_year, printing, isbn, source_ref, source_kind,
                 "confirmed" if confirmed else "pending",
                 identity_evidence_ref, verified_by, _now()),
            )
            return dict(db.execute(
                "SELECT * FROM textbook_editions WHERE edition_ref=?", (edition_ref,),
            ).fetchone())

    def verify_asset_file(
        self, *, edition_ref: str, path: str | Path,
        source_evidence_ref: str, verified_by: str,
    ) -> dict[str, Any]:
        """Hash and count pages of a local PDF; do not copy or persist its path."""
        _required(source_evidence_ref, "Asset source evidence")
        _required(verified_by, "Asset reviewer")
        try:
            import pymupdf
        except ImportError as exc:
            raise AssessmentError("Install the pdf extra to inspect textbook assets") from exc
        source = Path(path)
        if not source.is_file():
            raise AssessmentError("Textbook asset unavailable")
        digest = hashlib.sha256()
        size = 0
        with source.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
                size += len(chunk)
        try:
            with pymupdf.open(source) as doc:
                pages = doc.page_count
                if pages <= 0 or doc.is_encrypted:
                    raise AssessmentError("Unreadable textbook PDF")
        except AssessmentError:
            raise
        except Exception as exc:
            raise AssessmentError("Unreadable textbook PDF") from exc
        asset_hash = digest.hexdigest()
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            edition = db.execute(
                "SELECT edition_ref FROM textbook_editions WHERE edition_ref=?", (edition_ref,),
            ).fetchone()
            if edition is None:
                raise AssessmentError("Unknown edition")
            prior = db.execute(
                "SELECT * FROM textbook_assets WHERE edition_ref=?", (edition_ref,),
            ).fetchone()
            if prior is not None:
                if (prior["asset_hash"], prior["source_evidence_ref"], prior["verified_by"]) != (
                    asset_hash, source_evidence_ref, verified_by,
                ):
                    raise AssessmentError("Edition asset evidence changed")
                return dict(prior)
            db.execute(
                "INSERT INTO textbook_assets VALUES (?,?,?,?,?,?,?,?,?,?)",
                (asset_hash, edition_ref, size, pages, source_evidence_ref,
                 verified_by, "unreviewed", None, None, _now()),
            )
            return dict(db.execute(
                "SELECT * FROM textbook_assets WHERE edition_ref=?", (edition_ref,),
            ).fetchone())

    def set_rights(
        self, *, edition_ref: str, scope: str,
        rights_evidence_ref: str, reviewed_by: str,
    ) -> dict[str, Any]:
        """Trusted legal review; preserve each decision, never expose PDF bytes."""
        if scope not in RIGHTS_SCOPES - {"unreviewed"}:
            raise AssessmentError("Unsupported rights scope")
        _required(rights_evidence_ref, "Rights evidence")
        _required(reviewed_by, "Rights reviewer")
        review_ref = _ref("rights", {
            "edition_ref": edition_ref, "evidence_ref": rights_evidence_ref,
        })
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            prior = db.execute(
                "SELECT * FROM textbook_rights_reviews WHERE rights_evidence_ref=?",
                (rights_evidence_ref,),
            ).fetchone()
            if prior is not None:
                if (prior["edition_ref"], prior["scope"], prior["reviewed_by"]) != (
                    edition_ref, scope, reviewed_by,
                ):
                    raise AssessmentError("Rights evidence reused with different decision")
                return dict(db.execute(
                    "SELECT * FROM textbook_assets WHERE edition_ref=?",
                    (edition_ref,),
                ).fetchone())
            asset = db.execute(
                "SELECT * FROM textbook_assets WHERE edition_ref=?", (edition_ref,),
            ).fetchone()
            if asset is None:
                raise AssessmentError("No verified asset for rights review")
            db.execute(
                "INSERT INTO textbook_rights_reviews VALUES (?,?,?,?,?,?)",
                (review_ref, edition_ref, scope, rights_evidence_ref, reviewed_by, _now()),
            )
            db.execute(
                """UPDATE textbook_assets SET rights_scope=?,
                   rights_evidence_ref=?,rights_reviewed_by=?
                   WHERE edition_ref=?""",
                (scope, rights_evidence_ref, reviewed_by, edition_ref),
            )
            return dict(db.execute(
                "SELECT * FROM textbook_assets WHERE edition_ref=?",
                (edition_ref,),
            ).fetchone())

    def register_section(
        self, *, edition_ref: str, ordinal: int, title: str,
        review_level: str = "E0", revision: int = 1,
        page_start: int | None = None,
        page_end: int | None = None, review_evidence_ref: str | None = None,
        summary: str | None = None, summary_status: str = "pending",
        reviewed_by: str | None = None, second_reviewer: str | None = None,
    ) -> dict[str, Any]:
        """Trusted review ingestion; summaries are original, never copied pages."""
        title = _required(title, "Section title")
        if (type(ordinal) is not int or ordinal < 1 or
            type(revision) is not int or revision < 1 or
            review_level not in REVIEW_LEVELS):
            raise AssessmentError("Invalid section order or review level")
        if summary_status not in {"pending", "approved"}:
            raise AssessmentError("Invalid summary status")
        if review_level in {"E0", "E1"} and (summary or summary_status == "approved"):
            raise AssessmentError("Unreviewed section cannot carry approved summary")
        if REVIEW_LEVELS[review_level] >= 2:
            if (not review_evidence_ref or not reviewed_by or
                type(page_start) is not int or type(page_end) is not int or
                page_start < 1 or page_end < page_start):
                raise AssessmentError("Reviewed content needs source pages and reviewer")
        if review_level == "E4" and (not second_reviewer or second_reviewer == reviewed_by):
            raise AssessmentError("E4 requires independent second reviewer")
        if summary_status == "approved" and (not summary or not summary.strip()):
            raise AssessmentError("Approved summary text required")
        section_ref = _ref(
            "sec", {"edition_ref": edition_ref, "ordinal": ordinal, "revision": revision},
        )
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            edition = db.execute(
                "SELECT * FROM textbook_editions WHERE edition_ref=?", (edition_ref,),
            ).fetchone()
            if edition is None:
                raise AssessmentError("Unknown edition")
            asset = db.execute(
                "SELECT pages FROM textbook_assets WHERE edition_ref=?", (edition_ref,),
            ).fetchone()
            if REVIEW_LEVELS[review_level] >= 2 and (asset is None or page_end > asset["pages"]):
                raise AssessmentError("Reviewed page span exceeds verified asset")
            prior = db.execute(
                """SELECT * FROM textbook_sections
                   WHERE edition_ref=? AND ordinal=? AND revision=?""",
                (edition_ref, ordinal, revision),
            ).fetchone()
            if prior is not None:
                expected = (
                    title, page_start, page_end, review_level,
                    review_evidence_ref, summary, summary_status,
                    reviewed_by, second_reviewer,
                )
                existing = tuple(prior[key] for key in (
                    "title", "page_start", "page_end", "review_level",
                    "review_evidence_ref", "summary", "summary_status",
                    "reviewed_by", "second_reviewer",
                ))
                if expected != existing:
                    raise AssessmentError("Section revision requires a new review record")
                return dict(prior)
            latest = db.execute(
                "SELECT MAX(revision) AS value FROM textbook_sections WHERE edition_ref=? AND ordinal=?",
                (edition_ref, ordinal),
            ).fetchone()["value"]
            if revision != (latest or 0) + 1:
                raise AssessmentError("Section revisions must be consecutive")
            db.execute(
                "INSERT INTO textbook_sections VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (section_ref, edition_ref, ordinal, revision, title,
                 page_start, page_end, review_level, review_evidence_ref,
                 summary, summary_status, reviewed_by, second_reviewer, _now()),
            )
            return dict(db.execute(
                "SELECT * FROM textbook_sections WHERE section_ref=?", (section_ref,),
            ).fetchone())

    def resolve_edition(
        self, *, tenant_id: str, class_id: str, publisher: str,
        grade: int, volume: str, school_system: str | None = None,
        series: str | None = None, revision_year: int | None = None,
        printing: str | None = None, isbn: str | None = None,
    ) -> dict[str, Any]:
        self._teacher_class(tenant_id, class_id)
        if not publisher or type(grade) is not int or not volume:
            raise AssessmentError("Publisher, grade and volume required")
        clauses = ["publisher=?", "grade=?", "volume=?"]
        values: list[Any] = [publisher, grade, volume]
        for key, value in (
            ("school_system", school_system), ("series", series),
            ("revision_year", revision_year), ("printing", printing), ("isbn", isbn),
        ):
            if value is not None:
                clauses.append(key + "=?")
                values.append(value)
        with self._db() as db:
            rows = db.execute(
                """SELECT edition_ref,publisher,series,school_system,grade,volume,
                          revision_year,printing,isbn,catalog_status,source_kind
                   FROM textbook_editions WHERE """ + " AND ".join(clauses) +
                " ORDER BY catalog_status,edition_ref LIMIT 20", values,
            ).fetchall()
        candidates = [dict(row) for row in rows]
        if not candidates:
            status = "not_found"
        elif len(candidates) > 1:
            status = "needs_teacher_confirmation"
        elif candidates[0]["catalog_status"] != "confirmed":
            status = "pending_identity_verification"
        else:
            status = "resolved"
        return {"status": status, "candidates": candidates}

    def list_sections(self, *, tenant_id: str, class_id: str, edition_ref: str) -> dict[str, Any]:
        self._teacher_class(tenant_id, class_id)
        with self._db() as db:
            edition = db.execute(
                "SELECT catalog_status FROM textbook_editions WHERE edition_ref=?",
                (edition_ref,),
            ).fetchone()
            if edition is None:
                raise AssessmentError("Unknown edition")
            rows = db.execute(
                """SELECT s.section_ref,s.ordinal,s.revision,s.title,s.page_start,
                          s.page_end,s.review_level,s.summary_status
                   FROM textbook_sections s WHERE s.edition_ref=?
                     AND s.revision=(SELECT MAX(x.revision) FROM textbook_sections x
                                     WHERE x.edition_ref=s.edition_ref AND x.ordinal=s.ordinal)
                   ORDER BY s.ordinal""",
                (edition_ref,),
            ).fetchall()
            return {"edition_ref": edition_ref, "catalog_status": edition["catalog_status"],
                    "sections": [dict(row) for row in rows]}

    def bind_class(
        self, *, tenant_id: str, class_id: str,
        edition_ref: str, section_ref: str,
        expected_version: int | None = None,
    ) -> dict[str, Any]:
        """Called only through a teacher-authenticated approval route."""
        self._teacher_class(tenant_id, class_id)
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            edition = db.execute(
                "SELECT catalog_status FROM textbook_editions WHERE edition_ref=?",
                (edition_ref,),
            ).fetchone()
            section = db.execute(
                """SELECT s.review_level FROM textbook_sections s
                   WHERE s.section_ref=? AND s.edition_ref=?
                     AND s.revision=(SELECT MAX(x.revision) FROM textbook_sections x
                                     WHERE x.edition_ref=s.edition_ref AND x.ordinal=s.ordinal)""",
                (section_ref, edition_ref),
            ).fetchone()
            if edition is None or edition["catalog_status"] != "confirmed" or section is None:
                raise AssessmentError("Edition or section not verified")
            if REVIEW_LEVELS[section["review_level"]] < 1:
                raise AssessmentError("Class section needs verified table of contents")
            prior = db.execute(
                "SELECT * FROM teacher_textbook_bindings WHERE tenant_id=? AND class_id=?",
                (tenant_id, class_id),
            ).fetchone()
            if prior is None:
                if expected_version not in (None, 0):
                    raise AssessmentError("Class binding version conflict")
                version = 1
                db.execute(
                    "INSERT INTO teacher_textbook_bindings VALUES (?,?,?,?,?,?,?)",
                    (tenant_id, class_id, self.teacher_id, edition_ref,
                     section_ref, version, _now()),
                )
            else:
                if prior["teacher_id"] != self.teacher_id:
                    raise AssessmentError("Class is bound by another teacher")
                if prior["edition_ref"] == edition_ref and prior["section_ref"] == section_ref:
                    return dict(prior)
                if expected_version != prior["version"]:
                    raise AssessmentError("Explicit expected version required to change textbook")
                version = prior["version"] + 1
                db.execute(
                    """UPDATE teacher_textbook_bindings SET edition_ref=?,section_ref=?,
                       version=?,confirmed_at=? WHERE tenant_id=? AND class_id=?""",
                    (edition_ref, section_ref, version, _now(), tenant_id, class_id),
                )
            current = db.execute(
                "SELECT * FROM teacher_textbook_bindings WHERE tenant_id=? AND class_id=?",
                (tenant_id, class_id),
            ).fetchone()
            db.execute(
                "INSERT INTO textbook_binding_revisions VALUES (?,?,?,?,?,?,?)",
                (tenant_id, class_id, self.teacher_id, edition_ref, section_ref,
                 version, current["confirmed_at"]),
            )
            event_ref = _ref("evt", {
                "tenant_id": tenant_id, "class_id": class_id,
                "edition_ref": edition_ref, "version": version,
            })
            db.execute(
                "INSERT INTO textbook_catalog_audit VALUES (?,?,?,?,?,?,?)",
                (event_ref, tenant_id, class_id, self.teacher_id,
                 "class_textbook.confirmed", edition_ref, _now()),
            )
            return dict(db.execute(
                "SELECT * FROM teacher_textbook_bindings WHERE tenant_id=? AND class_id=?",
                (tenant_id, class_id),
            ).fetchone())

    def class_binding(self, *, tenant_id: str, class_id: str) -> dict[str, Any]:
        self._teacher_class(tenant_id, class_id)
        with self._db() as db:
            row = db.execute(
                """SELECT edition_ref,section_ref,version,confirmed_at
                   FROM teacher_textbook_bindings WHERE tenant_id=? AND class_id=?""",
                (tenant_id, class_id),
            ).fetchone()
            return {"status": "bound", **dict(row)} if row else {"status": "unbound"}

    def require_bound_section(
        self, *, tenant_id: str, class_id: str,
        edition_ref: str, section_ref: str,
    ) -> None:
        """Validate a student's selected section against this class's current edition."""
        binding = self.class_binding(tenant_id=tenant_id, class_id=class_id)
        if binding["status"] != "bound" or binding["edition_ref"] != edition_ref:
            raise AssessmentError("Edition is not the current class binding")
        with self._db() as db:
            section = db.execute(
                """SELECT s.review_level FROM textbook_sections s
                   WHERE s.section_ref=? AND s.edition_ref=?
                     AND s.revision=(SELECT MAX(x.revision) FROM textbook_sections x
                                     WHERE x.edition_ref=s.edition_ref AND x.ordinal=s.ordinal)""",
                (section_ref, edition_ref),
            ).fetchone()
            if section is None or REVIEW_LEVELS[section["review_level"]] < 1:
                raise AssessmentError("Student section needs a verified table of contents")

    def search_evidence(
        self, *, tenant_id: str, class_id: str, edition_ref: str,
        section_ref: str, query: str,
    ) -> dict[str, Any]:
        """Return only a licensed original summary anchored to verified page metadata."""
        self._teacher_class(tenant_id, class_id)
        if not isinstance(query, str) or len(query) > 500:
            raise AssessmentError("Invalid evidence query")
        with self._db() as db:
            binding = db.execute(
                """SELECT edition_ref FROM teacher_textbook_bindings
                   WHERE tenant_id=? AND class_id=? AND teacher_id=?""",
                (tenant_id, class_id, self.teacher_id),
            ).fetchone()
            if binding is None or binding["edition_ref"] != edition_ref:
                raise AssessmentError("Edition not bound to this class")
            edition = db.execute(
                "SELECT catalog_status FROM textbook_editions WHERE edition_ref=?",
                (edition_ref,),
            ).fetchone()
            section = db.execute(
                """SELECT s.* FROM textbook_sections s
                   WHERE s.section_ref=? AND s.edition_ref=?
                     AND s.revision=(SELECT MAX(x.revision) FROM textbook_sections x
                                     WHERE x.edition_ref=s.edition_ref AND x.ordinal=s.ordinal)""",
                (section_ref, edition_ref),
            ).fetchone()
            asset = db.execute(
                "SELECT * FROM textbook_assets WHERE edition_ref=?",
                (edition_ref,),
            ).fetchone()
            if edition is None or section is None:
                raise AssessmentError("Wrong edition or section")
            if edition["catalog_status"] != "confirmed":
                return {"status": "pending_identity_verification", "evidence": []}
            if asset is None or asset["rights_scope"] != "summary_allowed":
                return {"status": "rights_not_cleared", "evidence": []}
            if REVIEW_LEVELS[section["review_level"]] < 2 or section["summary_status"] != "approved":
                return {"status": "content_unreviewed", "evidence": []}
            if query and query.casefold() not in (section["title"] + " " + section["summary"]).casefold():
                return {"status": "no_match", "evidence": []}
            return {
                "status": "found",
                "evidence": [{
                    "evidence_ref": _ref("te", {
                        "section_ref": section_ref, "asset_hash": asset["asset_hash"],
                        "review_evidence_ref": section["review_evidence_ref"],
                    }),
                    "edition_ref": edition_ref, "asset_hash": asset["asset_hash"],
                    "section_ref": section_ref, "page_start": section["page_start"],
                    "page_end": section["page_end"],
                    "review_level": section["review_level"],
                    "summary": section["summary"],
                    "rights_scope": asset["rights_scope"],
                }],
            }
