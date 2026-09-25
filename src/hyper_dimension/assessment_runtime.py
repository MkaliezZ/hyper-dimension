"""Local assessment service with durable audit and an injectable assessment agent.

This module is an in-process development slice. Callers must authenticate teachers
and students before invoking it. Do not expose it directly to untrusted clients.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sqlite3
from typing import Any, Iterator, Protocol
from uuid import uuid4


DIMENSIONS = ("reading", "content", "communication", "organisation", "language")


class AssessmentAgent(Protocol):
    def generate(self, profile: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]: ...
    def grade_writing(self, bundle: dict[str, Any], answer: str) -> dict[str, Any]: ...
    def draft_report(self, context: dict[str, Any]) -> dict[str, Any]: ...


class AssessmentError(ValueError):
    pass


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id(prefix: str) -> str:
    return prefix + "_" + uuid4().hex


def _load(value: str) -> Any:
    return json.loads(value)


class AssessmentService:
    """A local SQLite implementation of the service contract, using synthetic data."""

    def __init__(self, path: str | Path, agent: AssessmentAgent):
        self.path = str(path)
        self.agent = agent
        self._init_db()

    @contextmanager
    def _db(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path, timeout=15)
        try:
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys = ON")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def _init_db(self) -> None:
        with self._db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS students (
                    tenant_id TEXT NOT NULL, student_id TEXT NOT NULL,
                    class_id TEXT NOT NULL, age INTEGER NOT NULL, grade INTEGER NOT NULL,
                    book_id TEXT NOT NULL, school_progress TEXT NOT NULL,
                    PRIMARY KEY (tenant_id, student_id)
                );
                CREATE TABLE IF NOT EXISTS guardian_consents (
                    tenant_id TEXT NOT NULL, student_id TEXT NOT NULL,
                    consent_id TEXT NOT NULL, scope TEXT NOT NULL,
                    recorded_at TEXT NOT NULL, active INTEGER NOT NULL,
                    PRIMARY KEY (tenant_id, student_id)
                );
                CREATE TABLE IF NOT EXISTS teacher_policies (
                    tenant_id TEXT NOT NULL, class_id TEXT NOT NULL,
                    policy_id TEXT NOT NULL, teacher_id TEXT NOT NULL,
                    version INTEGER NOT NULL, weights_json TEXT NOT NULL,
                    min_confidence REAL NOT NULL, active INTEGER NOT NULL,
                    PRIMARY KEY (tenant_id, class_id, policy_id, version)
                );
                CREATE TABLE IF NOT EXISTS item_bundles (
                    bundle_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    student_id TEXT NOT NULL, class_id TEXT NOT NULL,
                    policy_id TEXT NOT NULL, policy_version INTEGER NOT NULL,
                    student_json TEXT NOT NULL, key_json TEXT NOT NULL,
                    rubric_json TEXT NOT NULL, agent_version TEXT NOT NULL,
                    status TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS attempts (
                    attempt_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    student_id TEXT NOT NULL, bundle_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL, content_sha256 TEXT NOT NULL,
                    answers_json TEXT NOT NULL, status TEXT NOT NULL,
                    submit_event_id TEXT NOT NULL, created_at TEXT NOT NULL,
                    UNIQUE (tenant_id, student_id, idempotency_key),
                    UNIQUE (tenant_id, student_id, bundle_id, attempt_id)
                );
                CREATE TABLE IF NOT EXISTS grade_runs (
                    grade_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE,
                    score REAL NOT NULL, breakdown_json TEXT NOT NULL,
                    confidence REAL NOT NULL, status TEXT NOT NULL,
                    agent_version TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS approval_decisions (
                    decision_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE,
                    mode TEXT NOT NULL, policy_id TEXT NOT NULL,
                    policy_version INTEGER NOT NULL, reason TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS report_revisions (
                    report_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE,
                    tenant_id TEXT NOT NULL, student_id TEXT NOT NULL,
                    body_json TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS audit_events (
                    event_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    student_id TEXT NOT NULL, attempt_id TEXT,
                    event_type TEXT NOT NULL, actor_type TEXT NOT NULL,
                    actor_id TEXT NOT NULL, object_ref TEXT NOT NULL,
                    occurred_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS outbox_events (
                    outbox_id TEXT PRIMARY KEY, event_id TEXT NOT NULL UNIQUE,
                    event_type TEXT NOT NULL, status TEXT NOT NULL
                );
            """)

    def _event(self, db: sqlite3.Connection, tenant_id: str, student_id: str,
               attempt_id: str | None, event_type: str, actor_type: str,
               actor_id: str, object_ref: str) -> str:
        event_id = _id("evt")
        db.execute(
            "INSERT INTO audit_events VALUES (?,?,?,?,?,?,?,?,?)",
            (event_id, tenant_id, student_id, attempt_id, event_type,
             actor_type, actor_id, object_ref, _now()),
        )
        db.execute(
            "INSERT INTO outbox_events VALUES (?,?,?,?)",
            (_id("out"), event_id, event_type, "pending"),
        )
        return event_id

    def register_student(self, *, tenant_id: str, student_id: str, class_id: str,
                         age: int, grade: int, book_id: str, school_progress: str,
                         consent_id: str, consent_scope: str = "english_assessment") -> None:
        """Called only after an upstream identity/guardian-consent verification."""
        if not (6 <= age <= 15 and 1 <= grade <= 9 and consent_id and consent_scope):
            raise AssessmentError("Invalid profile or guardian consent")
        with self._db() as db:
            db.execute(
                "INSERT INTO students VALUES (?,?,?,?,?,?,?)",
                (tenant_id, student_id, class_id, age, grade, book_id, school_progress),
            )
            db.execute(
                "INSERT INTO guardian_consents VALUES (?,?,?,?,?,1)",
                (tenant_id, student_id, consent_id, consent_scope, _now()),
            )

    def revoke_consent(self, tenant_id: str, student_id: str, guardian_id: str) -> None:
        """Record a verified guardian's withdrawal and block future assessment."""
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            changed = db.execute(
                "UPDATE guardian_consents SET active=0 WHERE tenant_id=? AND student_id=? AND active=1",
                (tenant_id, student_id),
            ).rowcount
            if not changed:
                raise AssessmentError("No active consent to withdraw")
            self._event(db, tenant_id, student_id, None, "consent.withdrawn",
                        "guardian", guardian_id, student_id)

    def authorize_policy(self, *, tenant_id: str, class_id: str, teacher_id: str,
                         policy_id: str, weights: dict[str, float],
                         min_confidence: float = 0.75, version: int = 1) -> None:
        """Called only after upstream verification of a teacher's approval."""
        if set(weights) != set(DIMENSIONS) or any(
            not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or value < 0
            for value in weights.values()
        ) or sum(weights.values()) <= 0:
            raise AssessmentError("Weights must cover all dimensions and sum above zero")
        if not (0 <= min_confidence <= 1 and version >= 1 and teacher_id):
            raise AssessmentError("Invalid policy")
        with self._db() as db:
            db.execute(
                "INSERT INTO teacher_policies VALUES (?,?,?,?,?,?,?,1)",
                (tenant_id, class_id, policy_id, teacher_id, version,
                 _json(weights), min_confidence),
            )

    def _context(self, db: sqlite3.Connection, tenant_id: str, student_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
        student = db.execute(
            "SELECT * FROM students WHERE tenant_id=? AND student_id=?",
            (tenant_id, student_id),
        ).fetchone()
        consent = db.execute(
            "SELECT active,scope FROM guardian_consents WHERE tenant_id=? AND student_id=?",
            (tenant_id, student_id),
        ).fetchone()
        if student is None or consent is None or not consent["active"] or consent["scope"] != "english_assessment":
            raise AssessmentError("No active student profile and assessment consent")
        policy = db.execute(
            "SELECT * FROM teacher_policies WHERE tenant_id=? AND class_id=? AND active=1 ORDER BY version DESC LIMIT 1",
            (tenant_id, student["class_id"]),
        ).fetchone()
        if policy is None:
            raise AssessmentError("No active teacher policy")
        history = db.execute(
            """SELECT g.score FROM grade_runs g JOIN attempts a ON a.attempt_id=g.attempt_id
               WHERE a.tenant_id=? AND a.student_id=? ORDER BY g.created_at DESC LIMIT 5""",
            (tenant_id, student_id),
        ).fetchall()
        profile = {key: student[key] for key in ("tenant_id", "student_id", "class_id", "age", "grade", "book_id", "school_progress")}
        profile["recent_scores"] = [row["score"] for row in history]
        return profile, {
            "policy_id": policy["policy_id"], "version": policy["version"],
            "teacher_id": policy["teacher_id"], "weights": _load(policy["weights_json"]),
            "min_confidence": policy["min_confidence"],
        }

    @staticmethod
    def _validate_bundle(bundle: dict[str, Any], policy: dict[str, Any]) -> None:
        if not isinstance(bundle, dict):
            raise AssessmentError("Agent did not return an object")
        questions = bundle.get("questions")
        key = bundle.get("answer_key")
        rubric = bundle.get("rubric")
        if not isinstance(questions, list) or not isinstance(key, dict) or not isinstance(rubric, dict):
            raise AssessmentError("Incomplete item bundle")
        ids = [q.get("id") for q in questions if isinstance(q, dict)]
        if len(ids) != len(questions) or len(ids) != len(set(ids)):
            raise AssessmentError("Question IDs must be unique")
        mcq = [q for q in questions if q.get("kind") == "mcq"]
        writing = [q for q in questions if q.get("kind") == "writing"]
        if not mcq or len(writing) != 1 or len(mcq) + 1 != len(questions):
            raise AssessmentError("First slice requires MCQ reading and one writing item")
        if set(key) != {q["id"] for q in mcq}:
            raise AssessmentError("Answer key does not match MCQ items")
        for q in mcq:
            options = q.get("options")
            if not isinstance(q.get("prompt"), str) or not q["prompt"].strip():
                raise AssessmentError("Missing question prompt")
            if (not isinstance(options, list) or len(options) < 2 or
                any(not isinstance(option, str) or not option.strip() for option in options) or
                len(set(options)) != len(options)):
                raise AssessmentError("Invalid options")
            if key[q["id"]] not in options:
                raise AssessmentError("Correct answer absent from options")
        if not isinstance(writing[0].get("prompt"), str) or not writing[0]["prompt"].strip():
            raise AssessmentError("Missing writing prompt")
        if set(rubric) != set(DIMENSIONS) - {"reading"} or any(
            not isinstance(value, str) or not value.strip() for value in rubric.values()
        ):
            raise AssessmentError("Missing writing rubric")
        if not isinstance(bundle.get("agent_version"), str) or not bundle["agent_version"]:
            raise AssessmentError("Missing agent version")
        if sum(policy["weights"].values()) <= 0:
            raise AssessmentError("Invalid policy weights")

    def create_assignment(self, tenant_id: str, student_id: str) -> dict[str, Any]:
        with self._db() as db:
            profile, policy = self._context(db, tenant_id, student_id)
        # JSON mode does not guarantee answer-key consistency. Retry once, then fail closed.
        for generation_attempt in range(2):
            bundle = self.agent.generate(profile, policy)
            try:
                self._validate_bundle(bundle, policy)
                break
            except AssessmentError:
                if generation_attempt == 1:
                    raise
        bundle_id = _id("bundle")
        student_questions = [
            {key: question[key] for key in ("id", "kind", "prompt", "options") if key in question}
            for question in bundle["questions"]
        ]
        student_view = {"bundle_id": bundle_id, "questions": student_questions,
                        "book_id": profile["book_id"], "school_progress": profile["school_progress"]}
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            current_profile, current_policy = self._context(db, tenant_id, student_id)
            if (current_profile["class_id"] != profile["class_id"] or
                current_policy["policy_id"] != policy["policy_id"] or
                current_policy["version"] != policy["version"]):
                raise AssessmentError("Student or teacher policy changed during generation")
            db.execute(
                "INSERT INTO item_bundles VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (bundle_id, tenant_id, student_id, profile["class_id"], policy["policy_id"],
                 policy["version"], _json(student_view), _json(bundle["answer_key"]),
                 _json(bundle["rubric"]), bundle["agent_version"], "published", _now()),
            )
            event_id = self._event(db, tenant_id, student_id, None, "bundle.published",
                                   "agent", bundle["agent_version"], bundle_id)
        return {**student_view, "audit_event_id": event_id}

    def submit(self, *, tenant_id: str, student_id: str, bundle_id: str,
               attempt_id: str, idempotency_key: str, answers: dict[str, str]) -> dict[str, Any]:
        if not all((bundle_id, attempt_id, idempotency_key)) or not isinstance(answers, dict):
            raise AssessmentError("Missing submission identity or answers")
        content_sha = hashlib.sha256(_json({"bundle_id": bundle_id, "answers": answers}).encode()).hexdigest()
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            old = db.execute(
                "SELECT * FROM attempts WHERE tenant_id=? AND student_id=? AND (idempotency_key=? OR attempt_id=?)",
                (tenant_id, student_id, idempotency_key, attempt_id),
            ).fetchone()
            if old is not None:
                if old["content_sha256"] != content_sha or old["bundle_id"] != bundle_id:
                    raise AssessmentError("Idempotency key or attempt ID reused with different content")
                return self._result(db, old)
            bundle = db.execute(
                "SELECT * FROM item_bundles WHERE bundle_id=? AND tenant_id=? AND student_id=? AND status='published'",
                (bundle_id, tenant_id, student_id),
            ).fetchone()
            if bundle is None:
                raise AssessmentError("No published assignment for this student")
            profile, policy = self._context(db, tenant_id, student_id)
            if (bundle["policy_id"], bundle["policy_version"]) != (policy["policy_id"], policy["version"]):
                raise AssessmentError("Assignment policy is no longer active")
            question_ids = {q["id"] for q in _load(bundle["student_json"])["questions"]}
            if set(answers) != question_ids or any(not isinstance(v, str) for v in answers.values()):
                raise AssessmentError("Answers must match all question IDs")
            event_id = self._event(db, tenant_id, student_id, attempt_id,
                                   "attempt.submitted", "student", student_id, attempt_id)
            db.execute(
                "INSERT INTO attempts VALUES (?,?,?,?,?,?,?,?,?,?)",
                (attempt_id, tenant_id, student_id, bundle_id, idempotency_key,
                 content_sha, _json(answers), "submitted", event_id, _now()),
            )
        try:
            return self.process_attempt(tenant_id, student_id, attempt_id)
        except AssessmentError:
            # Consent/policy can change after a submission has committed.
            with self._db() as db:
                row = db.execute("SELECT * FROM attempts WHERE attempt_id=?", (attempt_id,)).fetchone()
                return self._result(db, row)

    def process_attempt(self, tenant_id: str, student_id: str, attempt_id: str) -> dict[str, Any]:
        with self._db() as db:
            attempt = db.execute(
                "SELECT * FROM attempts WHERE tenant_id=? AND student_id=? AND attempt_id=?",
                (tenant_id, student_id, attempt_id),
            ).fetchone()
            if attempt is None:
                raise AssessmentError("Unknown attempt")
            if attempt["status"] != "submitted":
                return self._result(db, attempt)
            bundle = db.execute(
                "SELECT * FROM item_bundles WHERE bundle_id=?", (attempt["bundle_id"],)
            ).fetchone()
            profile, policy = self._context(db, tenant_id, student_id)
        if (bundle["policy_id"], bundle["policy_version"]) != (policy["policy_id"], policy["version"]):
            raise AssessmentError("Assignment policy changed before grading")
        questions = _load(bundle["student_json"])["questions"]
        key = _load(bundle["key_json"])
        answers = _load(attempt["answers_json"])
        mcq = [q for q in questions if q["kind"] == "mcq"]
        writing = next(q for q in questions if q["kind"] == "writing")
        reading = 100 * sum(answers[q["id"]] == key[q["id"]] for q in mcq) / len(mcq)
        try:
            critique = self.agent.grade_writing(
                {"questions": questions, "rubric": _load(bundle["rubric_json"]),
                 "agent_version": bundle["agent_version"]},
                answers[writing["id"]],
            )
            dimensions = critique["scores"]
            confidence = critique["confidence"]
            evidence = critique["evidence"]
            if (set(dimensions) != set(DIMENSIONS) - {"reading"} or
                any(not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v) or not 0 <= v <= 100
                    for v in dimensions.values()) or
                not isinstance(confidence, (int, float)) or not math.isfinite(confidence) or not 0 <= confidence <= 1 or
                not isinstance(evidence, str)):
                raise ValueError("Agent grade does not meet rubric contract")
        except Exception:
            # The committed submission remains resumable after an Agent outage.
            return {"attempt_id": attempt_id, "status": "submitted",
                    "audit_event_id": attempt["submit_event_id"], "report_id": None}
        breakdown = {"reading": reading, **dimensions}
        weights = policy["weights"]
        total = round(sum(weights[k] * breakdown[k] for k in DIMENSIONS) / sum(weights.values()), 2)
        reason = "approved" if confidence >= policy["min_confidence"] and evidence.strip() else "low_confidence_or_missing_evidence"
        status = "approved" if reason == "approved" else "needs_review"
        wrong_answers = [q["id"] for q in mcq if answers[q["id"]] != key[q["id"]]]
        narrative = None
        if status == "approved":
            try:
                narrative = self.agent.draft_report({
                    "profile": {k: profile[k] for k in ("age", "grade", "book_id", "school_progress")},
                    "questions": questions, "answers": answers,
                    "answer_key": key, "score": total, "breakdown": breakdown,
                    "wrong_answers": wrong_answers, "writing_evidence": evidence,
                })
                if (not isinstance(narrative, dict) or
                    not isinstance(narrative.get("summary"), str) or
                    not narrative["summary"].strip() or
                    any(not isinstance(narrative.get(k), list) or
                        not narrative[k] or
                        any(not isinstance(x, str) or not x.strip() for x in narrative[k])
                        for k in ("strengths", "needs_work", "next_steps"))):
                    raise ValueError("Incomplete Agent report")
            except Exception:
                # Keep the answer resumable instead of publishing an incomplete report.
                return {"attempt_id": attempt_id, "status": "submitted",
                        "audit_event_id": attempt["submit_event_id"], "report_id": None}
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            current = db.execute(
                "SELECT * FROM attempts WHERE attempt_id=? AND tenant_id=? AND student_id=?",
                (attempt_id, tenant_id, student_id),
            ).fetchone()
            if current["status"] != "submitted":
                return self._result(db, current)
            latest_profile, latest_policy = self._context(db, tenant_id, student_id)
            if (latest_profile["class_id"] != bundle["class_id"] or
                latest_policy["policy_id"] != bundle["policy_id"] or
                latest_policy["version"] != bundle["policy_version"]):
                raise AssessmentError("Consent or teacher policy changed before approval")
            db.execute(
                "INSERT INTO grade_runs VALUES (?,?,?,?,?,?,?,?)",
                (_id("grade"), attempt_id, total,
                 _json({"scores": breakdown, "weights": weights, "evidence": evidence,
                        "wrong_answers": wrong_answers}),
                 confidence, status, bundle["agent_version"], _now()),
            )
            self._event(db, tenant_id, student_id, attempt_id,
                        "grade.completed", "agent", bundle["agent_version"], attempt_id)
            db.execute(
                "INSERT INTO approval_decisions VALUES (?,?,?,?,?,?,?)",
                (_id("decision"), attempt_id,
                 "auto_under_teacher_policy" if status == "approved" else "needs_review",
                 policy["policy_id"], policy["version"], reason, _now()),
            )
            self._event(db, tenant_id, student_id, attempt_id,
                        "approval.auto_approved" if status == "approved" else "approval.needs_review",
                        "service", "assessment_service", attempt_id)
            if status == "approved":
                report_id = _id("report")
                report = {"score": total, "breakdown": breakdown,
                          "wrong_answers": wrong_answers,
                          "writing_evidence": evidence, "teacher_policy_ref":
                          f"{policy['policy_id']}:v{policy['version']}",
                          "summary": narrative["summary"],
                          "strengths": narrative["strengths"],
                          "needs_work": narrative["needs_work"],
                          "next_steps": narrative["next_steps"],
                          "note": "Project teaching diagnosis, not an official examination result"}
                db.execute(
                    "INSERT INTO report_revisions VALUES (?,?,?,?,?,?)",
                    (report_id, attempt_id, tenant_id, student_id, _json(report), _now()),
                )
                self._event(db, tenant_id, student_id, attempt_id,
                            "report.published", "service", "assessment_service", report_id)
            db.execute("UPDATE attempts SET status=? WHERE attempt_id=?", (status, attempt_id))
            final = db.execute("SELECT * FROM attempts WHERE attempt_id=?", (attempt_id,)).fetchone()
            return self._result(db, final)

    def _result(self, db: sqlite3.Connection, attempt: sqlite3.Row) -> dict[str, Any]:
        report = db.execute("SELECT report_id FROM report_revisions WHERE attempt_id=?", (attempt["attempt_id"],)).fetchone()
        return {"attempt_id": attempt["attempt_id"], "status": attempt["status"],
                "audit_event_id": attempt["submit_event_id"],
                "report_id": report["report_id"] if report else None}

    def report(self, tenant_id: str, student_id: str, report_id: str) -> dict[str, Any]:
        with self._db() as db:
            row = db.execute(
                "SELECT body_json FROM report_revisions WHERE tenant_id=? AND student_id=? AND report_id=?",
                (tenant_id, student_id, report_id),
            ).fetchone()
            if row is None:
                raise AssessmentError("Report unavailable")
            return _load(row["body_json"])

    def error_history(self, tenant_id: str, student_id: str) -> list[dict[str, Any]]:
        """Return accumulated wrong-item references, scoped to one student."""
        with self._db() as db:
            rows = db.execute(
                """SELECT a.attempt_id, a.bundle_id, g.breakdown_json, g.created_at
                   FROM attempts a JOIN grade_runs g ON g.attempt_id=a.attempt_id
                   WHERE a.tenant_id=? AND a.student_id=? ORDER BY g.created_at""",
                (tenant_id, student_id),
            ).fetchall()
            return [
                {"attempt_id": row["attempt_id"], "bundle_id": row["bundle_id"],
                 "wrong_item_ids": _load(row["breakdown_json"])["wrong_answers"],
                 "created_at": row["created_at"]}
                for row in rows
            ]

    def audit_event(self, tenant_id: str, student_id: str, event_id: str) -> dict[str, Any]:
        with self._db() as db:
            row = db.execute(
                "SELECT * FROM audit_events WHERE tenant_id=? AND student_id=? AND event_id=?",
                (tenant_id, student_id, event_id),
            ).fetchone()
            if row is None:
                raise AssessmentError("Audit event unavailable")
            return dict(row)
