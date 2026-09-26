"""Local, auditable teacher-scoped progress alignment over approved reports.

This SQLite slice uses synthetic students. A confirmed evidence tag records a
teacher decision; raw grades and prior runs are never rewritten.
"""
from __future__ import annotations

from datetime import date
import hashlib
import math
from typing import Any
from uuid import uuid4

from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService, DIMENSIONS, _json, _load, _now
from hyper_dimension.student_records import StudentRecords


def _new(prefix: str) -> str:
    return prefix + "_" + uuid4().hex


class ProgressAlignmentService:
    def __init__(self, assessment: AssessmentService, records: StudentRecords, *, teacher_id: str):
        if records.teacher_id != teacher_id:
            raise ValueError("Trusted teacher binding required")
        self.assessment = assessment
        self.records = records
        self.teacher_id = teacher_id
        with assessment._db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS class_milestones (
                    milestone_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    class_id TEXT NOT NULL, teacher_id TEXT NOT NULL,
                    capability_node TEXT NOT NULL, prerequisite_nodes_json TEXT NOT NULL,
                    construct_ref TEXT NOT NULL, score_dimension TEXT NOT NULL,
                    target_difficulty INTEGER NOT NULL,
                    support_threshold REAL NOT NULL, transfer_threshold REAL NOT NULL,
                    target_date TEXT NOT NULL, version INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS alignment_evidence (
                    evidence_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    student_id TEXT NOT NULL, report_id TEXT NOT NULL,
                    capability_node TEXT NOT NULL, construct_ref TEXT NOT NULL,
                    score_dimension TEXT NOT NULL, difficulty INTEGER NOT NULL,
                    prompt_strength INTEGER NOT NULL,
                    score REAL NOT NULL, agent_version TEXT NOT NULL,
                    status TEXT NOT NULL, confirmed_by TEXT,
                    created_at TEXT NOT NULL, confirmed_at TEXT,
                    UNIQUE (tenant_id,student_id,report_id,capability_node,construct_ref)
                );
                CREATE TABLE IF NOT EXISTS alignment_runs (
                    run_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    milestone_id TEXT NOT NULL, idempotency_key TEXT NOT NULL,
                    input_sha256 TEXT NOT NULL, body_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE (tenant_id,milestone_id,idempotency_key)
                );
                CREATE TABLE IF NOT EXISTS alignment_plan_drafts (
                    plan_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    run_id TEXT NOT NULL, student_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL, body_sha256 TEXT NOT NULL,
                    body_json TEXT NOT NULL, status TEXT NOT NULL,
                    agent_version TEXT NOT NULL, created_at TEXT NOT NULL,
                    approval_reason TEXT, approved_at TEXT,
                    UNIQUE (tenant_id,run_id,student_id,idempotency_key)
                );
                CREATE TABLE IF NOT EXISTS alignment_decisions (
                    decision_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    run_id TEXT NOT NULL, student_id TEXT NOT NULL,
                    decision TEXT NOT NULL, override_group TEXT,
                    reason TEXT NOT NULL, teacher_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE (tenant_id,run_id,student_id)
                );
                CREATE TABLE IF NOT EXISTS alignment_audit (
                    event_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
                    class_id TEXT NOT NULL, actor_id TEXT NOT NULL,
                    event_type TEXT NOT NULL, object_ref TEXT NOT NULL,
                    occurred_at TEXT NOT NULL
                );
            """)

    def _class_policy(self, db, tenant_id: str, class_id: str) -> None:
        row = db.execute(
            """SELECT teacher_id FROM teacher_policies
               WHERE tenant_id=? AND class_id=? AND active=1
               ORDER BY version DESC LIMIT 1""",
            (tenant_id, class_id),
        ).fetchone()
        if row is None or row["teacher_id"] != self.teacher_id:
            raise AssessmentError("No active teacher policy for this class")

    def _student(self, tenant_id: str, student_id: str) -> dict[str, Any]:
        profile = self.records.profile(tenant_id, student_id)
        context = self.assessment.generation_context(tenant_id, student_id)
        if context["policy"]["teacher_id"] != self.teacher_id:
            raise AssessmentError("Student belongs to another teacher policy")
        return profile

    def create_milestone(
        self, *, tenant_id: str, class_id: str, capability_node: str,
        prerequisite_nodes: list[str], construct_ref: str,
        score_dimension: str, target_difficulty: int, target_date: str,
        support_threshold: float = 60, transfer_threshold: float = 80,
    ) -> dict[str, Any]:
        if (not capability_node or not construct_ref or not target_date or
            score_dimension not in DIMENSIONS or
            not isinstance(prerequisite_nodes, list) or
            any(not isinstance(node, str) or not node or node == capability_node
                for node in prerequisite_nodes) or
            len(set(prerequisite_nodes)) != len(prerequisite_nodes) or
            type(target_difficulty) is not int or not 1 <= target_difficulty <= 3 or
            any(not isinstance(value, (int, float)) or isinstance(value, bool) or
                not math.isfinite(value) or not 0 <= value <= 100
                for value in (support_threshold, transfer_threshold)) or
            support_threshold >= transfer_threshold):
            raise AssessmentError("Invalid class milestone")
        try:
            date.fromisoformat(target_date)
        except ValueError as exc:
            raise AssessmentError("Milestone target date must be ISO YYYY-MM-DD") from exc
        milestone_id = _new("mile")
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            self._class_policy(db, tenant_id, class_id)
            version = db.execute(
                "SELECT COALESCE(MAX(version),0)+1 AS value FROM class_milestones WHERE tenant_id=? AND class_id=?",
                (tenant_id, class_id),
            ).fetchone()["value"]
            db.execute(
                "INSERT INTO class_milestones VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (milestone_id, tenant_id, class_id, self.teacher_id, capability_node,
                 _json(prerequisite_nodes), construct_ref, score_dimension,
                 target_difficulty, support_threshold, transfer_threshold,
                 target_date, version, _now()),
            )
            self._audit(db, tenant_id, class_id, "milestone.confirmed", milestone_id)
        return self.milestone(tenant_id, milestone_id)

    def _audit(self, db, tenant_id: str, class_id: str, event_type: str, object_ref: str) -> None:
        db.execute(
            "INSERT INTO alignment_audit VALUES (?,?,?,?,?,?,?)",
            (_new("evt"), tenant_id, class_id, self.teacher_id, event_type, object_ref, _now()),
        )

    def milestone(self, tenant_id: str, milestone_id: str) -> dict[str, Any]:
        with self.assessment._db() as db:
            row = db.execute(
                "SELECT * FROM class_milestones WHERE tenant_id=? AND milestone_id=?",
                (tenant_id, milestone_id),
            ).fetchone()
            if row is None:
                raise AssessmentError("Unknown class milestone")
            self._class_policy(db, tenant_id, row["class_id"])
            return {**dict(row), "prerequisite_nodes": _load(row["prerequisite_nodes_json"])}

    def class_milestones(self, tenant_id: str, class_id: str) -> list[dict[str, Any]]:
        """Read teacher-confirmed milestones for one authorized class."""
        with self.assessment._db() as db:
            self._class_policy(db, tenant_id, class_id)
            rows = db.execute(
                """SELECT milestone_id,capability_node,prerequisite_nodes_json,
                          construct_ref,score_dimension,target_difficulty,
                          support_threshold,transfer_threshold,target_date,
                          version,created_at
                   FROM class_milestones WHERE tenant_id=? AND class_id=?
                   ORDER BY version DESC LIMIT 100""",
                (tenant_id, class_id),
            ).fetchall()
            return [
                {
                    **{key: value for key, value in dict(row).items()
                       if key != "prerequisite_nodes_json"},
                    "prerequisite_nodes": _load(row["prerequisite_nodes_json"]),
                }
                for row in rows
            ]

    def class_runs(self, tenant_id: str, class_id: str) -> list[dict[str, Any]]:
        """Read recent immutable alignment snapshots for one authorized class."""
        with self.assessment._db() as db:
            self._class_policy(db, tenant_id, class_id)
            rows = db.execute(
                """SELECT r.run_id,r.milestone_id,r.body_json,r.created_at
                   FROM alignment_runs r JOIN class_milestones m
                     ON m.tenant_id=r.tenant_id AND m.milestone_id=r.milestone_id
                   WHERE r.tenant_id=? AND m.class_id=?
                   ORDER BY r.created_at DESC,r.run_id DESC LIMIT 50""",
                (tenant_id, class_id),
            ).fetchall()
            result = []
            for row in rows:
                snapshot = _load(row["body_json"])
                result.append({
                    "run_ref": row["run_id"],
                    "milestone_ref": row["milestone_id"],
                    "milestone_version": snapshot["milestone_version"],
                    "recommendation_count": len(snapshot["recommendations"]),
                    "created_at": row["created_at"],
                })
            return result

    def run(self, tenant_id: str, run_id: str) -> dict[str, Any]:
        """Read one snapshot with its teacher decisions; never recompute it."""
        with self.assessment._db() as db:
            row = db.execute(
                """SELECT r.body_json,r.created_at,m.class_id
                   FROM alignment_runs r JOIN class_milestones m
                     ON m.tenant_id=r.tenant_id AND m.milestone_id=r.milestone_id
                   WHERE r.tenant_id=? AND r.run_id=?""",
                (tenant_id, run_id),
            ).fetchone()
            if row is None:
                raise AssessmentError("Unknown alignment run")
            self._class_policy(db, tenant_id, row["class_id"])
            decisions = db.execute(
                """SELECT student_id,decision,override_group,reason,created_at
                   FROM alignment_decisions
                   WHERE tenant_id=? AND run_id=? ORDER BY created_at,student_id""",
                (tenant_id, run_id),
            ).fetchall()
            return {
                "run_ref": run_id,
                **_load(row["body_json"]),
                "created_at": row["created_at"],
                "decisions": [
                    {
                        "student_ref": decision["student_id"],
                        "decision": decision["decision"],
                        "override_group": decision["override_group"],
                        "reason": decision["reason"],
                        "created_at": decision["created_at"],
                    }
                    for decision in decisions
                ],
            }

    def propose_evidence(
        self, *, tenant_id: str, student_id: str, report_id: str,
        capability_node: str, construct_ref: str, score_dimension: str,
        difficulty: int, prompt_strength: int, agent_version: str,
    ) -> dict[str, Any]:
        profile = self._student(tenant_id, student_id)
        if (not capability_node or not construct_ref or not agent_version or
            score_dimension not in DIMENSIONS or
            type(difficulty) is not int or not 1 <= difficulty <= 3 or
            type(prompt_strength) is not int or not 0 <= prompt_strength <= 3):
            raise AssessmentError("Invalid capability evidence tag")
        report = self.assessment.report(tenant_id, student_id, report_id)
        score = report["breakdown"][score_dimension]
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            prior = db.execute(
                """SELECT * FROM alignment_evidence WHERE tenant_id=? AND student_id=?
                   AND report_id=? AND capability_node=? AND construct_ref=?""",
                (tenant_id, student_id, report_id, capability_node, construct_ref),
            ).fetchone()
            if prior is not None:
                if (prior["score_dimension"], prior["difficulty"],
                    prior["prompt_strength"], prior["agent_version"]) != (
                    score_dimension, difficulty, prompt_strength, agent_version,
                ):
                    raise AssessmentError("Evidence tag changed under same source")
                return {"evidence_ref": prior["evidence_id"], "status": prior["status"]}
            evidence_id = _new("evid")
            db.execute(
                "INSERT INTO alignment_evidence VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (evidence_id, tenant_id, student_id, report_id, capability_node,
                 construct_ref, score_dimension, difficulty, prompt_strength,
                 score, agent_version, "proposed", None, _now(), None),
            )
            self.assessment._event(
                db, tenant_id, student_id, None, "alignment.evidence_proposed",
                "agent", agent_version, evidence_id,
            )
        return {"evidence_ref": evidence_id, "status": "proposed",
                "class_ref": profile["class_id"]}

    def confirm_evidence(self, tenant_id: str, student_id: str, evidence_id: str) -> dict[str, str]:
        self._student(tenant_id, student_id)
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT * FROM alignment_evidence WHERE tenant_id=? AND student_id=? AND evidence_id=?",
                (tenant_id, student_id, evidence_id),
            ).fetchone()
            if row is None:
                raise AssessmentError("Evidence unavailable")
            if row["status"] == "confirmed":
                return {"evidence_ref": evidence_id, "status": "confirmed"}
            db.execute(
                """UPDATE alignment_evidence SET status='confirmed',confirmed_by=?,confirmed_at=?
                   WHERE evidence_id=?""",
                (self.teacher_id, _now(), evidence_id),
            )
            self.assessment._event(
                db, tenant_id, student_id, None, "alignment.evidence_confirmed",
                "teacher", self.teacher_id, evidence_id,
            )
        return {"evidence_ref": evidence_id, "status": "confirmed"}

    def student_evidence(self, tenant_id: str, student_id: str) -> list[dict[str, Any]]:
        self._student(tenant_id, student_id)
        with self.assessment._db() as db:
            rows = db.execute(
                """SELECT evidence_id,report_id,capability_node,construct_ref,
                          score_dimension,difficulty,prompt_strength,score,
                          status,confirmed_at
                   FROM alignment_evidence WHERE tenant_id=? AND student_id=?
                   ORDER BY created_at,evidence_id""",
                (tenant_id, student_id),
            ).fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def _recommend(mile: dict, evidence: list[dict]) -> dict[str, Any]:
        confirmed = [e for e in evidence if e["status"] == "confirmed"]
        prereq_refs = []
        for node in mile["prerequisite_nodes"]:
            node_evidence = [e for e in confirmed if e["capability_node"] == node]
            comparable = {}
            for item in node_evidence:
                comparable.setdefault(
                    (item["construct_ref"], item["score_dimension"], item["difficulty"]), []
                ).append(item)
            groups = [v for v in comparable.values()
                      if len({item["report_id"] for item in v}) >= 2]
            if not groups:
                return {"group": "待补证", "reason": "prerequisite_evidence_insufficient",
                        "evidence_refs": [e["evidence_id"] for e in node_evidence]}
            chosen = max(groups, key=lambda v: max(item["confirmed_at"] for item in v))
            prereq_refs += [e["evidence_id"] for e in chosen]
            latest_two = sorted(chosen, key=lambda e: e["confirmed_at"])[-2:]
            if sum(e["score"] for e in latest_two) / 2 < mile["support_threshold"]:
                return {"group": "前置支撑", "reason": "prerequisite_below_threshold",
                        "evidence_refs": prereq_refs}
        target = [e for e in confirmed
                  if e["capability_node"] == mile["capability_node"] and
                     e["construct_ref"] == mile["construct_ref"] and
                     e["score_dimension"] == mile["score_dimension"] and
                     e["difficulty"] >= mile["target_difficulty"]]
        independent = [e for e in target if e["prompt_strength"] == 0]
        by_difficulty = {}
        for item in independent:
            by_difficulty.setdefault(item["difficulty"], []).append(item)
        comparable_groups = [
            items for items in by_difficulty.values()
            if len({item["report_id"] for item in items}) >= 2
        ]
        if comparable_groups:
            latest_group = max(
                comparable_groups,
                key=lambda items: max(item["confirmed_at"] for item in items),
            )
            latest_two = sorted(latest_group, key=lambda e: e["confirmed_at"])[-2:]
            if all(e["score"] >= mile["transfer_threshold"] for e in latest_two):
                return {"group": "迁移挑战", "reason": "two_recent_independent_target_successes",
                        "evidence_refs": prereq_refs + [e["evidence_id"] for e in latest_two]}
        if target:
            return {"group": "核心练习", "reason": "target_evidence_needs_practice",
                    "evidence_refs": prereq_refs + [e["evidence_id"] for e in target]}
        return {"group": "待补证", "reason": "target_evidence_insufficient",
                "evidence_refs": prereq_refs}

    def preview(self, tenant_id: str, milestone_id: str, idempotency_key: str) -> dict[str, Any]:
        if not idempotency_key:
            raise AssessmentError("Alignment idempotency key required")
        mile = self.milestone(tenant_id, milestone_id)
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            self._class_policy(db, tenant_id, mile["class_id"])
            students = db.execute(
                """SELECT s.student_id FROM students s JOIN guardian_consents c
                   ON c.tenant_id=s.tenant_id AND c.student_id=s.student_id
                   WHERE s.tenant_id=? AND s.class_id=? AND c.active=1
                     AND c.scope='english_assessment' ORDER BY s.student_id""",
                (tenant_id, mile["class_id"]),
            ).fetchall()
            recommendations = []
            for student in students:
                ref = student["student_id"]
                evidence = self.student_evidence(tenant_id, ref)
                recommendations.append({
                    "student_ref": ref,
                    **self._recommend(mile, evidence),
                })
            snapshot = {
                "milestone_ref": milestone_id, "milestone_version": mile["version"],
                "rule_version": "alignment-v0.1",
                "class_ref": mile["class_id"], "recommendations": recommendations,
            }
            digest = hashlib.sha256(_json(snapshot).encode()).hexdigest()
            prior = db.execute(
                """SELECT * FROM alignment_runs WHERE tenant_id=? AND milestone_id=?
                   AND idempotency_key=?""",
                (tenant_id, milestone_id, idempotency_key),
            ).fetchone()
            if prior is not None:
                if prior["input_sha256"] != digest:
                    raise AssessmentError("Alignment key reused after evidence changed")
                return {"run_ref": prior["run_id"], **_load(prior["body_json"])}
            run_id = _new("align")
            db.execute(
                "INSERT INTO alignment_runs VALUES (?,?,?,?,?,?,?)",
                (run_id, tenant_id, milestone_id, idempotency_key,
                 digest, _json(snapshot), _now()),
            )
            self._audit(db, tenant_id, mile["class_id"], "alignment.previewed", run_id)
            return {"run_ref": run_id, **snapshot}

    def plan_draft(
        self, *, tenant_id: str, run_id: str, student_id: str,
        idempotency_key: str, plan: dict[str, Any], agent_version: str,
    ) -> dict[str, str]:
        self._student(tenant_id, student_id)
        if (not idempotency_key or not agent_version or
            not isinstance(plan, dict) or
            any(not isinstance(plan.get(k), str) or not plan[k].strip()
                for k in ("goal", "next_task", "review_date")) or
            not isinstance(plan.get("weekly_steps"), list) or
            len(plan["weekly_steps"]) != 4 or
            any(not isinstance(step, str) or not step.strip()
                for step in plan["weekly_steps"])):
            raise AssessmentError("Invalid four-week plan draft")
        try:
            date.fromisoformat(plan["review_date"])
        except ValueError as exc:
            raise AssessmentError("Plan review date must be ISO YYYY-MM-DD") from exc
        digest = hashlib.sha256(_json(plan).encode()).hexdigest()
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            run = db.execute(
                "SELECT body_json FROM alignment_runs WHERE tenant_id=? AND run_id=?",
                (tenant_id, run_id),
            ).fetchone()
            if run is None or student_id not in {
                rec["student_ref"] for rec in _load(run["body_json"])["recommendations"]
            }:
                raise AssessmentError("Student not in alignment run")
            decision = db.execute(
                """SELECT decision FROM alignment_decisions
                   WHERE tenant_id=? AND run_id=? AND student_id=?""",
                (tenant_id, run_id, student_id),
            ).fetchone()
            if decision is None or decision["decision"] == "reject":
                raise AssessmentError("Teacher must confirm or override alignment first")
            prior = db.execute(
                """SELECT plan_id,body_sha256,status FROM alignment_plan_drafts
                   WHERE tenant_id=? AND run_id=? AND student_id=? AND idempotency_key=?""",
                (tenant_id, run_id, student_id, idempotency_key),
            ).fetchone()
            if prior is not None:
                if prior["body_sha256"] != digest:
                    raise AssessmentError("Plan key reused with different content")
                return {"plan_ref": prior["plan_id"], "status": prior["status"]}
            plan_id = _new("plan")
            db.execute(
                "INSERT INTO alignment_plan_drafts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (plan_id, tenant_id, run_id, student_id, idempotency_key,
                 digest, _json(plan), "draft", agent_version, _now(), None, None),
            )
            self.assessment._event(
                db, tenant_id, student_id, None, "alignment.plan_drafted",
                "agent", agent_version, plan_id,
            )
            return {"plan_ref": plan_id, "status": "draft"}

    def decide(self, tenant_id: str, run_id: str, student_id: str,
               decision: str, reason: str,
               override_group: str | None = None) -> dict[str, str | None]:
        self._student(tenant_id, student_id)
        groups = {"前置支撑", "核心练习", "迁移挑战", "待补证"}
        if (decision not in {"confirm", "override", "reject"} or not reason.strip() or
            (decision == "override" and override_group not in groups) or
            (decision != "override" and override_group is not None)):
            raise AssessmentError("Teacher decision, reason and override group required")
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT body_json FROM alignment_runs WHERE tenant_id=? AND run_id=?",
                (tenant_id, run_id),
            ).fetchone()
            if row is None or student_id not in {
                rec["student_ref"] for rec in _load(row["body_json"])["recommendations"]
            }:
                raise AssessmentError("Student not in alignment run")
            recommendation = next(
                rec for rec in _load(row["body_json"])["recommendations"]
                if rec["student_ref"] == student_id
            )
            effective_group = override_group if decision == "override" else (
                recommendation["group"] if decision == "confirm" else None
            )
            prior = db.execute(
                """SELECT decision,override_group,reason FROM alignment_decisions
                   WHERE tenant_id=? AND run_id=? AND student_id=?""",
                (tenant_id, run_id, student_id),
            ).fetchone()
            if prior is not None:
                if (prior["decision"], prior["override_group"], prior["reason"]) != (
                    decision, override_group, reason,
                ):
                    raise AssessmentError("Alignment decision is immutable")
                return {"status": decision, "run_ref": run_id,
                        "student_ref": student_id, "effective_group": effective_group}
            db.execute(
                "INSERT INTO alignment_decisions VALUES (?,?,?,?,?,?,?,?,?)",
                (_new("dec"), tenant_id, run_id, student_id, decision,
                 override_group, reason, self.teacher_id, _now()),
            )
            self.assessment._event(
                db, tenant_id, student_id, None, "alignment.decision",
                "teacher", self.teacher_id, run_id,
            )
            return {"status": decision, "run_ref": run_id,
                    "student_ref": student_id, "effective_group": effective_group}

    def approve_plan(self, tenant_id: str, student_id: str,
                     plan_id: str, reason: str) -> dict[str, str]:
        self._student(tenant_id, student_id)
        if not reason.strip():
            raise AssessmentError("Plan approval reason required")
        with self.assessment._db() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                """SELECT p.*,d.decision FROM alignment_plan_drafts p
                   JOIN alignment_decisions d ON d.tenant_id=p.tenant_id
                    AND d.run_id=p.run_id AND d.student_id=p.student_id
                   WHERE p.tenant_id=? AND p.student_id=? AND p.plan_id=?""",
                (tenant_id, student_id, plan_id),
            ).fetchone()
            if row is None or row["decision"] == "reject":
                raise AssessmentError("Plan lacks teacher-confirmed alignment")
            if row["status"] == "approved":
                if row["approval_reason"] != reason.strip():
                    raise AssessmentError("Plan approval is immutable")
                return {"plan_ref": plan_id, "status": "approved"}
            other = db.execute(
                """SELECT plan_id FROM alignment_plan_drafts
                   WHERE tenant_id=? AND run_id=? AND student_id=?
                     AND status='approved' AND plan_id<>?""",
                (tenant_id, row["run_id"], student_id, plan_id),
            ).fetchone()
            if other is not None:
                raise AssessmentError("Another plan is already approved for this run")
            db.execute(
                """UPDATE alignment_plan_drafts
                   SET status='approved',approval_reason=?,approved_at=?
                   WHERE plan_id=?""",
                (reason.strip(), _now(), plan_id),
            )
            self.assessment._event(
                db, tenant_id, student_id, None, "alignment.plan_approved",
                "teacher", self.teacher_id, plan_id,
            )
            return {"plan_ref": plan_id, "status": "approved"}
