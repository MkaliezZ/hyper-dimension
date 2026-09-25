"""Teacher-first student registry, private archive and opt-in island showcase.

Database records are authoritative. Per-student folders are an export of immutable
artifact versions and can be rebuilt. Name is a cross-check, never a credential.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import re
import secrets
from typing import Any
from uuid import uuid4

from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService


PUBLIC_FIELDS = frozenset({"alias", "improvement", "score", "honor"})
SLOTS = frozenset({"learning", "portfolio", "honors"})


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _student_id() -> str:
    return "stu_" + uuid4().hex


def _normalized_name(value: str) -> str:
    return "".join(value.casefold().split())


class StudentRecords:
    def __init__(self, assessment: AssessmentService, archive_root: str | Path,
                 *, teacher_id: str):
        if not teacher_id:
            raise ValueError("Trusted teacher ID required")
        self.assessment = assessment
        self.teacher_id = teacher_id
        self.archive_root = Path(archive_root).resolve()
        self._init_db()

    def _init_db(self) -> None:
        with self.assessment._db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS student_profiles (
                    tenant_id TEXT NOT NULL, student_id TEXT NOT NULL,
                    display_name TEXT NOT NULL, public_alias TEXT NOT NULL,
                    teacher_notes TEXT NOT NULL, learning_goals TEXT NOT NULL,
                    version INTEGER NOT NULL, updated_at TEXT NOT NULL,
                    PRIMARY KEY (tenant_id, student_id)
                );
                CREATE TABLE IF NOT EXISTS student_access (
                    tenant_id TEXT NOT NULL, student_id TEXT NOT NULL,
                    code_sha256 TEXT NOT NULL UNIQUE, rotated_at TEXT NOT NULL,
                    PRIMARY KEY (tenant_id, student_id)
                );
                CREATE TABLE IF NOT EXISTS archive_artifacts (
                    artifact_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    student_id TEXT NOT NULL, kind TEXT NOT NULL,
                    source_ref TEXT NOT NULL, body_json TEXT NOT NULL,
                    body_sha256 TEXT NOT NULL, record_event_id TEXT NOT NULL,
                    export_event_id TEXT, export_state TEXT NOT NULL,
                    relative_path TEXT, created_at TEXT NOT NULL,
                    UNIQUE (tenant_id, student_id, kind, source_ref)
                );
                CREATE TABLE IF NOT EXISTS showcase_consents (
                    consent_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    student_id TEXT NOT NULL, guardian_ref TEXT NOT NULL,
                    evidence_ref TEXT NOT NULL, allowed_fields_json TEXT NOT NULL,
                    active INTEGER NOT NULL, recorded_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS showcase_entries (
                    entry_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    student_id TEXT NOT NULL, class_id TEXT NOT NULL,
                    slot TEXT NOT NULL, kind TEXT NOT NULL,
                    title TEXT NOT NULL, summary TEXT NOT NULL,
                    metrics_json TEXT NOT NULL, consent_id TEXT NOT NULL,
                    source_artifact_id TEXT NOT NULL,
                    baseline_artifact_id TEXT,
                    status TEXT NOT NULL, version INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );
            """)

    def _folder(self, tenant_id: str, student_id: str) -> Path:
        if not re.fullmatch(r"stu_[0-9a-f]{32}", student_id):
            raise AssessmentError("Invalid internal student ID for archive")
        tenant_segment = _sha(tenant_id.encode())[:16]
        return self.archive_root / "tenants" / tenant_segment / "students" / student_id

    def create_student(self, *, tenant_id: str, class_id: str,
                       display_name: str, age: int, grade: int,
                       book_id: str, school_progress: str,
                       guardian_consent_ref: str,
                       public_alias: str | None = None) -> dict[str, str]:
        name = display_name.strip()
        alias = (public_alias or "Learning Star").strip()
        if (not name or len(name) > 80 or not alias or len(alias) > 80 or
            (len(_normalized_name(name)) >= 2 and
             _normalized_name(name) in _normalized_name(alias)) or
            not (6 <= age <= 15 and 1 <= grade <= 9) or
            not all((tenant_id, class_id, book_id, guardian_consent_ref))):
            raise AssessmentError("Invalid student enrollment")
        student_id = _student_id()
        access_code = secrets.token_urlsafe(24)
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute(
                "INSERT INTO students VALUES (?,?,?,?,?,?,?)",
                (tenant_id, student_id, class_id, age, grade,
                 book_id, school_progress),
            )
            db.execute(
                "INSERT INTO guardian_consents VALUES (?,?,?,?,?,1)",
                (tenant_id, student_id, guardian_consent_ref,
                 "english_assessment", _now()),
            )
            db.execute(
                "INSERT INTO student_profiles VALUES (?,?,?,?,?,?,?,?)",
                (tenant_id, student_id, name, alias, "", "", 1, _now()),
            )
            db.execute(
                "INSERT INTO student_access VALUES (?,?,?,?)",
                (tenant_id, student_id, _sha(access_code.encode()), _now()),
            )
            self.assessment._event(
                db, tenant_id, student_id, None, "student.enrolled",
                "teacher", self.teacher_id, student_id,
            )
        self.archive_document(
            tenant_id=tenant_id, student_id=student_id, kind="profile",
            source_ref="profile:v1",
            body={"student_id": student_id, "class_id": class_id,
                  "display_name": name, "public_alias": alias,
                  "age": age, "grade": grade, "book_id": book_id,
                  "school_progress": school_progress,
                  "teacher_notes": "", "learning_goals": "", "version": 1},
        )
        return {"student_id": student_id, "student_ref": student_id,
                "access_code": access_code}

    def verify_student(self, tenant_id: str, access_code: str,
                       signed_name: str) -> str:
        """The random code authenticates; the signed name checks for mixups."""
        if not access_code or not signed_name:
            raise AssessmentError("Student identity check failed")
        digest = _sha(access_code.encode())
        with self.assessment._db() as db:
            row = db.execute(
                """SELECT a.student_id,p.display_name,c.active
                   FROM student_access a
                   JOIN student_profiles p ON p.tenant_id=a.tenant_id AND p.student_id=a.student_id
                   JOIN guardian_consents c ON c.tenant_id=a.tenant_id AND c.student_id=a.student_id
                   WHERE a.tenant_id=? AND a.code_sha256=?""",
                (tenant_id, digest),
            ).fetchone()
            if (row is None or not row["active"] or
                not hmac.compare_digest(
                    _normalized_name(signed_name),
                    _normalized_name(row["display_name"]),
                )):
                raise AssessmentError("Student identity check failed")
            return row["student_id"]

    def rotate_access_code(self, tenant_id: str, student_id: str) -> str:
        code = secrets.token_urlsafe(24)
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            changed = db.execute(
                "UPDATE student_access SET code_sha256=?,rotated_at=? WHERE tenant_id=? AND student_id=?",
                (_sha(code.encode()), _now(), tenant_id, student_id),
            ).rowcount
            if not changed:
                raise AssessmentError("Unknown student")
            self.assessment._event(
                db, tenant_id, student_id, None, "student.code_rotated",
                "teacher", self.teacher_id, student_id,
            )
        return code

    def profile(self, tenant_id: str, student_id: str) -> dict[str, Any]:
        with self.assessment._db() as db:
            row = db.execute(
                """SELECT s.tenant_id,s.student_id,s.class_id,s.age,s.grade,
                          s.book_id,s.school_progress,p.display_name,p.public_alias,
                          p.teacher_notes,p.learning_goals,p.version
                   FROM students s JOIN student_profiles p
                   ON p.tenant_id=s.tenant_id AND p.student_id=s.student_id
                   WHERE s.tenant_id=? AND s.student_id=?""",
                (tenant_id, student_id),
            ).fetchone()
            if row is None:
                raise AssessmentError("Unknown student")
            return dict(row)

    def edit_profile(self, tenant_id: str, student_id: str, *,
                     expected_version: int, display_name: str,
                     public_alias: str, teacher_notes: str,
                     learning_goals: str) -> dict[str, Any]:
        if (not display_name.strip() or not public_alias.strip() or
            len(display_name) > 80 or len(public_alias) > 80 or
            (len(_normalized_name(display_name)) >= 2 and
             _normalized_name(display_name) in _normalized_name(public_alias)) or
            len(teacher_notes) > 6000 or len(learning_goals) > 3000):
            raise AssessmentError("Invalid profile fields")
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            changed = db.execute(
                """UPDATE student_profiles
                   SET display_name=?,public_alias=?,teacher_notes=?,
                       learning_goals=?,version=version+1,updated_at=?
                   WHERE tenant_id=? AND student_id=? AND version=?""",
                (display_name.strip(), public_alias.strip(), teacher_notes,
                 learning_goals, _now(), tenant_id, student_id,
                 expected_version),
            ).rowcount
            if not changed:
                raise AssessmentError("Profile version conflict or student missing")
            self.assessment._event(
                db, tenant_id, student_id, None, "profile.updated",
                "teacher", self.teacher_id, student_id,
            )
        updated = self.profile(tenant_id, student_id)
        self.archive_document(
            tenant_id=tenant_id, student_id=student_id, kind="profile",
            source_ref=f"profile:v{updated['version']}", body=updated,
        )
        return updated

    def archive_document(self, *, tenant_id: str, student_id: str,
                         kind: str, source_ref: str,
                         body: dict[str, Any]) -> dict[str, str]:
        """Commit the artifact and audit event, then export idempotently."""
        if kind not in {"profile", "assessment", "teacher_note"}:
            raise AssessmentError("Unsupported archive kind")
        content = _json(body)
        body_digest = _sha(content.encode("utf-8"))
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            existing = db.execute(
                """SELECT * FROM archive_artifacts
                   WHERE tenant_id=? AND student_id=? AND kind=? AND source_ref=?""",
                (tenant_id, student_id, kind, source_ref),
            ).fetchone()
            if existing is not None:
                if existing["body_sha256"] != body_digest:
                    raise AssessmentError("Archive source changed after recording")
                artifact_id = existing["artifact_id"]
            else:
                profile = db.execute(
                    "SELECT 1 FROM students WHERE tenant_id=? AND student_id=?",
                    (tenant_id, student_id),
                ).fetchone()
                if profile is None:
                    raise AssessmentError("Unknown student")
                artifact_id = "art_" + uuid4().hex
                event_id = self.assessment._event(
                    db, tenant_id, student_id, None, "artifact.recorded",
                    "service", "student_records", artifact_id,
                )
                db.execute(
                    "INSERT INTO archive_artifacts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (artifact_id, tenant_id, student_id, kind, source_ref,
                     content, body_digest, event_id, None, "pending",
                     None, _now()),
                )
        return self._export(tenant_id, student_id, artifact_id)

    def _export(self, tenant_id: str, student_id: str,
                artifact_id: str) -> dict[str, str]:
        with self.assessment._db() as db:
            row = db.execute(
                """SELECT * FROM archive_artifacts
                   WHERE artifact_id=? AND tenant_id=? AND student_id=?""",
                (artifact_id, tenant_id, student_id),
            ).fetchone()
            if row is None:
                raise AssessmentError("Unknown artifact")
            record = dict(row)
        folder = self._folder(tenant_id, student_id) / "artifacts"
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / (artifact_id + ".json")
        wrapper = {
            "schema_version": "1.0", "artifact_id": artifact_id,
            "student_ref": student_id, "kind": record["kind"],
            "source_ref": record["source_ref"],
            "body_sha256": record["body_sha256"],
            "record_event_id": record["record_event_id"],
            "body": json.loads(record["body_json"]),
        }
        data = _json(wrapper).encode("utf-8")
        if target.exists():
            if target.read_bytes() != data:
                raise AssessmentError("Existing archive export was modified")
        else:
            if record["export_event_id"] is not None:
                raise AssessmentError("Existing archive export is missing")
            temp = folder / (artifact_id + "." + uuid4().hex + ".tmp")
            try:
                with open(temp, "xb") as stream:
                    stream.write(data)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temp, target)
            finally:
                temp.unlink(missing_ok=True)
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            current = db.execute(
                "SELECT export_event_id FROM archive_artifacts WHERE artifact_id=?",
                (artifact_id,),
            ).fetchone()
            if current["export_event_id"] is None:
                export_event_id = self.assessment._event(
                    db, tenant_id, student_id, None, "artifact.exported",
                    "service", "student_records", artifact_id,
                )
                db.execute(
                    """UPDATE archive_artifacts SET export_state='exported',
                       relative_path=?,export_event_id=? WHERE artifact_id=?""",
                    (str(target.relative_to(self.archive_root)),
                     export_event_id, artifact_id),
                )
            else:
                export_event_id = current["export_event_id"]
        return {"artifact_id": artifact_id, "body_sha256": record["body_sha256"],
                "record_event_id": record["record_event_id"],
                "export_event_id": export_event_id}

    def archive_teacher_note(self, tenant_id: str, student_id: str, *,
                             teacher_id: str, evidence_ref: str,
                             title: str, note: str) -> dict[str, str]:
        if teacher_id != self.teacher_id or not all((teacher_id, evidence_ref, title.strip(), note.strip())):
            raise AssessmentError("Teacher note requires author and evidence reference")
        if len(title) > 100 or len(note) > 6000:
            raise AssessmentError("Teacher note is too long")
        return self.archive_document(
            tenant_id=tenant_id, student_id=student_id,
            kind="teacher_note", source_ref=evidence_ref,
            body={"teacher_id": teacher_id, "title": title.strip(),
                  "note": note.strip(), "evidence_ref": evidence_ref},
        )

    def archive_report(self, tenant_id: str, student_id: str,
                       report_id: str) -> dict[str, str]:
        with self.assessment._db() as db:
            row = db.execute(
                """SELECT r.attempt_id,r.body_json,a.bundle_id,a.answers_json,
                          b.student_json,b.key_json,b.rubric_json,
                          g.breakdown_json,d.mode,d.policy_id,d.policy_version
                   FROM report_revisions r
                   JOIN attempts a ON a.attempt_id=r.attempt_id
                   JOIN item_bundles b ON b.bundle_id=a.bundle_id
                   JOIN grade_runs g ON g.attempt_id=a.attempt_id
                   JOIN approval_decisions d ON d.attempt_id=a.attempt_id
                   WHERE r.tenant_id=? AND r.student_id=? AND r.report_id=?""",
                (tenant_id, student_id, report_id),
            ).fetchone()
            if row is None:
                raise AssessmentError("Report unavailable")
            snapshot = {
                "report_id": report_id, "attempt_id": row["attempt_id"],
                "bundle_id": row["bundle_id"],
                "report": json.loads(row["body_json"]),
                "student_questions": json.loads(row["student_json"]),
                "answer_key": json.loads(row["key_json"]),
                "rubric": json.loads(row["rubric_json"]),
                "student_answers": json.loads(row["answers_json"]),
                "grade": json.loads(row["breakdown_json"]),
                "decision": {"mode": row["mode"], "policy_id": row["policy_id"],
                             "policy_version": row["policy_version"]},
            }
        return self.archive_document(
            tenant_id=tenant_id, student_id=student_id,
            kind="assessment", source_ref=report_id, body=snapshot,
        )

    def artifacts(self, tenant_id: str,
                  student_id: str) -> list[dict[str, Any]]:
        with self.assessment._db() as db:
            rows = db.execute(
                """SELECT artifact_id,kind,source_ref,body_sha256,
                          record_event_id,export_event_id,export_state,created_at
                   FROM archive_artifacts
                   WHERE tenant_id=? AND student_id=? ORDER BY created_at""",
                (tenant_id, student_id),
            ).fetchall()
            return [dict(row) for row in rows]

    def verify_artifact(self, tenant_id: str, student_id: str,
                        artifact_id: str) -> bool:
        with self.assessment._db() as db:
            row = db.execute(
                """SELECT * FROM archive_artifacts
                   WHERE artifact_id=? AND tenant_id=? AND student_id=?""",
                (artifact_id, tenant_id, student_id),
            ).fetchone()
            if row is None:
                raise AssessmentError("Unknown artifact")
            record = dict(row)
        path = self._folder(tenant_id, student_id) / "artifacts" / (artifact_id + ".json")
        try:
            wrapper = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return False
        return (wrapper.get("artifact_id") == artifact_id and
                wrapper.get("record_event_id") == record["record_event_id"] and
                _sha(_json(wrapper.get("body")).encode("utf-8")) ==
                record["body_sha256"])

    def record_showcase_consent(self, *, tenant_id: str, student_id: str,
                                guardian_ref: str, evidence_ref: str,
                                allowed_fields: list[str]) -> str:
        fields = set(allowed_fields)
        if (not guardian_ref or not evidence_ref or not fields or
            not fields <= PUBLIC_FIELDS or "alias" not in fields):
            raise AssessmentError("Invalid separate publication consent")
        consent_id = "pubcons_" + uuid4().hex
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            base = db.execute(
                """SELECT active FROM guardian_consents
                   WHERE tenant_id=? AND student_id=?""",
                (tenant_id, student_id),
            ).fetchone()
            if base is None or not base["active"]:
                raise AssessmentError("No active base guardian consent")
            db.execute(
                "INSERT INTO showcase_consents VALUES (?,?,?,?,?,?,1,?)",
                (consent_id, tenant_id, student_id, guardian_ref,
                 evidence_ref, _json(sorted(fields)), _now()),
            )
            self.assessment._event(
                db, tenant_id, student_id, None, "showcase.consent_recorded",
                "guardian", guardian_ref, consent_id,
            )
        return consent_id

    def create_showcase_draft(self, *, tenant_id: str, student_id: str,
                              slot: str, kind: str, title: str,
                              summary: str, metrics: dict[str, Any],
                              consent_id: str, source_artifact_id: str,
                              baseline_artifact_id: str | None = None) -> str:
        if (slot not in SLOTS or kind not in {"improvement", "honor"} or
            not title.strip() or not summary.strip() or
            len(title) > 100 or len(summary) > 500):
            raise AssessmentError("Invalid showcase entry")
        if (not isinstance(metrics, dict) or
            set(metrics) - {"before_score", "after_score", "unit"} or
            (metrics and (set(metrics) != {"before_score", "after_score", "unit"} or
                          any(not isinstance(metrics[k], (int, float)) or
                              isinstance(metrics[k], bool) or not math.isfinite(metrics[k]) or not 0 <= metrics[k] <= 100
                              for k in ("before_score", "after_score")) or
                          not isinstance(metrics["unit"], str) or len(metrics["unit"]) > 20))):
            raise AssessmentError("Invalid public metrics")
        if metrics and (not baseline_artifact_id or baseline_artifact_id == source_artifact_id):
            raise AssessmentError("Score improvement requires a distinct baseline report")
        profile = self.profile(tenant_id, student_id)
        if _normalized_name(profile["display_name"]) in _normalized_name(title + summary):
            raise AssessmentError("Private student name cannot appear in public showcase text")
        entry_id = "show_" + uuid4().hex
        with self.assessment._db() as db:
            consent = db.execute(
                """SELECT 1 FROM showcase_consents
                   WHERE consent_id=? AND tenant_id=? AND student_id=? AND active=1""",
                (consent_id, tenant_id, student_id),
            ).fetchone()
            if consent is None:
                raise AssessmentError("No active publication consent")
            source = db.execute(
                """SELECT kind FROM archive_artifacts WHERE artifact_id=? AND
                   tenant_id=? AND student_id=? AND export_state='exported'""",
                (source_artifact_id, tenant_id, student_id),
            ).fetchone()
            if source is None or (kind == "improvement" and source["kind"] != "assessment") or (kind == "honor" and source["kind"] not in {"assessment", "teacher_note"}):
                raise AssessmentError("Showcase requires matching archived evidence")
            if metrics:
                baseline = db.execute(
                    """SELECT body_json,created_at FROM archive_artifacts WHERE artifact_id=?
                       AND tenant_id=? AND student_id=? AND kind='assessment'
                       AND export_state='exported'""",
                    (baseline_artifact_id, tenant_id, student_id),
                ).fetchone()
                latest = db.execute(
                    "SELECT body_json,created_at FROM archive_artifacts WHERE artifact_id=?",
                    (source_artifact_id,),
                ).fetchone()
                if baseline is None or latest is None or baseline["created_at"] >= latest["created_at"]:
                    raise AssessmentError("Score improvement requires ordered archived reports")
                if (round(json.loads(baseline["body_json"])["report"]["score"], 2) != round(metrics["before_score"], 2) or
                    round(json.loads(latest["body_json"])["report"]["score"], 2) != round(metrics["after_score"], 2)):
                    raise AssessmentError("Public scores do not match archived reports")
            db.execute(
                "INSERT INTO showcase_entries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (entry_id, tenant_id, student_id, profile["class_id"], slot,
                 kind, title.strip(), summary.strip(), _json(metrics),
                 consent_id, source_artifact_id, baseline_artifact_id,
                 "draft", 1, _now()),
            )
            self.assessment._event(
                db, tenant_id, student_id, None, "showcase.drafted",
                "teacher", self.teacher_id, entry_id,
            )
        return entry_id

    def publish_showcase(self, tenant_id: str, student_id: str,
                         entry_id: str) -> None:
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                """SELECT e.kind,e.metrics_json,e.status,e.source_artifact_id,
                          e.baseline_artifact_id,c.allowed_fields_json,c.active,
                          g.active AS base_active
                   FROM showcase_entries e
                   JOIN showcase_consents c ON c.consent_id=e.consent_id
                   JOIN guardian_consents g ON g.tenant_id=e.tenant_id AND g.student_id=e.student_id
                   WHERE e.entry_id=? AND e.tenant_id=? AND e.student_id=?""",
                (entry_id, tenant_id, student_id),
            ).fetchone()
            if row is None or row["status"] != "draft" or not row["active"] or not row["base_active"]:
                raise AssessmentError("Showcase cannot be published")
            allowed = set(json.loads(row["allowed_fields_json"]))
            required = {"alias", row["kind"]}
            if json.loads(row["metrics_json"]):
                required.add("score")
            if not required <= allowed:
                raise AssessmentError("Publication consent does not cover selected fields")
            if not self.verify_artifact(tenant_id, student_id, row["source_artifact_id"]):
                raise AssessmentError("Publication source artifact failed verification")
            if row["baseline_artifact_id"] and not self.verify_artifact(
                tenant_id, student_id, row["baseline_artifact_id"]
            ):
                raise AssessmentError("Publication baseline artifact failed verification")
            db.execute(
                "UPDATE showcase_entries SET status='published',version=version+1 WHERE entry_id=?",
                (entry_id,),
            )
            self.assessment._event(
                db, tenant_id, student_id, None, "showcase.published",
                "teacher", self.teacher_id, entry_id,
            )

    def withdraw_showcase_consent(self, tenant_id: str, student_id: str,
                                  consent_id: str, guardian_ref: str) -> None:
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            changed = db.execute(
                """UPDATE showcase_consents SET active=0
                   WHERE consent_id=? AND tenant_id=? AND student_id=? AND active=1""",
                (consent_id, tenant_id, student_id),
            ).rowcount
            if not changed:
                raise AssessmentError("Publication consent unavailable")
            self.assessment._event(
                db, tenant_id, student_id, None, "showcase.consent_withdrawn",
                "guardian", guardian_ref, consent_id,
            )

    def public_showcase(self, tenant_id: str,
                        slot: str | None = None) -> list[dict[str, Any]]:
        if slot is not None and slot not in SLOTS:
            raise AssessmentError("Unknown island slot")
        with self.assessment._db() as db:
            rows = db.execute(
                """SELECT e.entry_id,e.slot,e.kind,e.title,e.summary,e.metrics_json,
                          p.public_alias,c.allowed_fields_json
                   FROM showcase_entries e
                   JOIN showcase_consents c ON c.consent_id=e.consent_id
                   JOIN guardian_consents g ON g.tenant_id=e.tenant_id AND g.student_id=e.student_id
                   JOIN student_profiles p ON p.tenant_id=e.tenant_id AND p.student_id=e.student_id
                   WHERE e.tenant_id=? AND e.status='published'
                     AND c.active=1 AND g.active=1
                     AND (? IS NULL OR e.slot=?)
                   ORDER BY e.created_at DESC""",
                (tenant_id, slot, slot),
            ).fetchall()
            return [
                {"entry_ref": row["entry_id"], "slot": row["slot"],
                 "kind": row["kind"], "title": row["title"],
                 "summary": row["summary"], "student_alias": row["public_alias"],
                 "metrics": json.loads(row["metrics_json"])
                 if "score" in json.loads(row["allowed_fields_json"]) else {}}
                for row in rows
            ]
