"""PostgreSQL identity relationships used by teacher API and Agent MCP.

Write methods are internal provisioning operations: an authenticated gateway
must decide who may invoke them. Read methods fail closed on missing relations.
"""
from __future__ import annotations

from datetime import datetime
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

import psycopg


def apply_identity_migration(dsn: str, sql_path: Path) -> None:
    """Apply the initial schema once, atomically, to an empty database."""
    sql = sql_path.read_text(encoding="utf-8")
    digest = sha256(sql.encode("utf-8")).hexdigest()
    with psycopg.connect(dsn, connect_timeout=5) as conn:
        conn.execute("SELECT pg_advisory_xact_lock(hashtext('hd.identity.migration'))")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                   version TEXT PRIMARY KEY,
                   checksum TEXT NOT NULL,
                   applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
               )"""
        )
        row = conn.execute(
            "SELECT checksum FROM schema_migrations WHERE version = %s",
            ("0001_identity_gateway",),
        ).fetchone()
        if row is not None:
            if row[0] != digest:
                raise ValueError("Identity migration checksum mismatch")
            return
        conn.execute(sql)
        conn.execute(
            "INSERT INTO schema_migrations(version, checksum) VALUES (%s, %s)",
            ("0001_identity_gateway", digest),
        )


class IdentityStore:
    def __init__(self, dsn: str, *, agent_client_id: str) -> None:
        if not dsn or not agent_client_id:
            raise ValueError("Database connection and Agent client required")
        self.dsn = dsn
        self.agent_client_id = agent_client_id

    @staticmethod
    def _audit(conn, operation: str, actor_ref: str, *,
               island_id: str | None = None, teacher_id: str | None = None,
               agent_id: str | None = None,
               delegation_id: str | None = None) -> None:
        conn.execute(
            """INSERT INTO auth_audit_events
               (event_id, operation, outcome, actor_ref, island_id,
                teacher_id, agent_id, delegation_id)
               VALUES (%s,%s,'completed',%s,%s,%s,%s,%s)""",
            (str(uuid4()), operation, actor_ref, island_id,
             teacher_id, agent_id, delegation_id),
        )

    def register_teacher(self, teacher_id: str, issuer: str, subject: str,
                         *, actor_ref: str) -> None:
        with psycopg.connect(self.dsn, connect_timeout=5) as conn:
            conn.execute(
                """INSERT INTO identity_principals
                   (principal_id, kind, issuer, subject, state)
                   VALUES (%s, 'teacher', %s, %s, 'active')""",
                (teacher_id, issuer, subject),
            )
            self._audit(conn, "teacher.register", actor_ref, teacher_id=teacher_id)

    def register_island(self, island_id: str, *, actor_ref: str) -> None:
        with psycopg.connect(self.dsn, connect_timeout=5) as conn:
            conn.execute(
                "INSERT INTO identity_islands(island_id, state) VALUES (%s, 'active')",
                (island_id,),
            )
            self._audit(conn, "island.register", actor_ref, island_id=island_id)

    def grant_teacher(self, island_id: str, teacher_id: str,
                      *, actor_ref: str) -> None:
        with psycopg.connect(self.dsn, connect_timeout=5) as conn:
            row = conn.execute(
                """INSERT INTO teacher_memberships
                   (island_id, teacher_id, state)
                   SELECT i.island_id, p.principal_id, 'active'
                   FROM identity_islands i JOIN identity_principals p
                     ON p.principal_id = %s
                   WHERE i.island_id = %s AND i.state = 'active'
                     AND p.kind = 'teacher' AND p.state = 'active'
                   RETURNING teacher_id""",
                (teacher_id, island_id),
            ).fetchone()
            if row is None:
                raise ValueError("Teacher or island inactive")
            self._audit(conn, "teacher.grant", actor_ref,
                        island_id=island_id, teacher_id=teacher_id)

    def revoke_teacher(self, island_id: str, teacher_id: str,
                       *, actor_ref: str) -> bool:
        with psycopg.connect(self.dsn, connect_timeout=5) as conn:
            row = conn.execute(
                """UPDATE teacher_memberships
                   SET state = 'revoked', revoked_at = now(),
                       version = version + 1
                   WHERE island_id = %s AND teacher_id = %s
                     AND state = 'active'
                   RETURNING teacher_id""",
                (island_id, teacher_id),
            ).fetchone()
            if row is None:
                return False
            self._audit(conn, "teacher.revoke", actor_ref,
                        island_id=island_id, teacher_id=teacher_id)
            return True

    def register_agent(self, agent_id: str, issuer: str, island_id: str,
                       teacher_id: str, *, actor_ref: str) -> None:
        with psycopg.connect(self.dsn, connect_timeout=5) as conn:
            row = conn.execute(
                """INSERT INTO agent_instances
                   (agent_id, issuer, client_id, island_id, teacher_id, state)
                   SELECT %s, %s, %s, m.island_id, m.teacher_id, 'active'
                   FROM teacher_memberships m JOIN identity_islands i
                     ON i.island_id = m.island_id
                   JOIN identity_principals p
                     ON p.principal_id = m.teacher_id
                   WHERE m.island_id = %s AND m.teacher_id = %s
                     AND m.state = 'active' AND i.state = 'active'
                     AND p.kind = 'teacher' AND p.state = 'active'
                   RETURNING agent_id""",
                (agent_id, issuer, self.agent_client_id, island_id, teacher_id),
            ).fetchone()
            if row is None:
                raise ValueError("Teacher membership inactive")
            self._audit(conn, "agent.register", actor_ref, island_id=island_id,
                        teacher_id=teacher_id, agent_id=agent_id)

    def grant_delegation(self, delegation_id: str, agent_id: str,
                         island_id: str, teacher_id: str,
                         valid_until: datetime, *, actor_ref: str) -> None:
        if valid_until.tzinfo is None:
            raise ValueError("Delegation expiry must have timezone")
        with psycopg.connect(self.dsn, connect_timeout=5) as conn:
            row = conn.execute(
                """INSERT INTO agent_delegations
                   (delegation_id, agent_id, island_id, teacher_id,
                    scope, valid_until)
                   SELECT %s, a.agent_id, a.island_id, a.teacher_id,
                          'hd.teacher.mcp', %s
                   FROM agent_instances a
                   JOIN teacher_memberships m
                     ON m.island_id = a.island_id
                    AND m.teacher_id = a.teacher_id
                   JOIN identity_islands i ON i.island_id = a.island_id
                   JOIN identity_principals p
                     ON p.principal_id = a.teacher_id
                   WHERE a.agent_id = %s AND a.island_id = %s
                     AND a.teacher_id = %s AND a.state = 'active'
                     AND m.state = 'active' AND i.state = 'active'
                     AND p.kind = 'teacher' AND p.state = 'active'
                   RETURNING delegation_id""",
                (delegation_id, valid_until, agent_id, island_id, teacher_id),
            ).fetchone()
            if row is None:
                raise ValueError("Agent or teacher inactive")
            self._audit(conn, "agent.delegate", actor_ref, island_id=island_id,
                        teacher_id=teacher_id, agent_id=agent_id,
                        delegation_id=delegation_id)

    def revoke_delegation(self, delegation_id: str, *, actor_ref: str) -> bool:
        with psycopg.connect(self.dsn, connect_timeout=5) as conn:
            row = conn.execute(
                """UPDATE agent_delegations
                   SET revoked_at = now(), version = version + 1
                   WHERE delegation_id = %s AND revoked_at IS NULL
                   RETURNING island_id, teacher_id, agent_id""",
                (delegation_id,),
            ).fetchone()
            if row is None:
                return False
            self._audit(conn, "agent.delegation.revoke", actor_ref,
                        island_id=row[0], teacher_id=row[1],
                        agent_id=row[2], delegation_id=delegation_id)
            return True

    def active_teacher(self, issuer: str, subject: str,
                       island_id: str, teacher_id: str) -> bool:
        with psycopg.connect(self.dsn, connect_timeout=5) as conn:
            row = conn.execute(
                """SELECT 1 FROM identity_principals p
                   JOIN teacher_memberships m ON m.teacher_id = p.principal_id
                   JOIN identity_islands i ON i.island_id = m.island_id
                   WHERE p.principal_id = %s AND p.kind = 'teacher'
                     AND p.issuer = %s AND p.subject = %s
                     AND p.state = 'active'
                     AND m.island_id = %s AND m.state = 'active'
                     AND i.state = 'active'""",
                (teacher_id, issuer, subject, island_id),
            ).fetchone()
            return row is not None

    def active_delegation(self, issuer: str, agent_id: str,
                          delegation_id: str, island_id: str,
                          teacher_id: str) -> bool:
        with psycopg.connect(self.dsn, connect_timeout=5) as conn:
            row = conn.execute(
                """SELECT 1 FROM agent_delegations d
                   JOIN agent_instances a ON a.agent_id = d.agent_id
                   JOIN teacher_memberships m
                     ON m.island_id = d.island_id
                    AND m.teacher_id = d.teacher_id
                   JOIN identity_principals p
                     ON p.principal_id = d.teacher_id
                   JOIN identity_islands i ON i.island_id = d.island_id
                   WHERE d.delegation_id = %s AND d.agent_id = %s
                     AND d.island_id = %s AND d.teacher_id = %s
                     AND d.scope = 'hd.teacher.mcp'
                     AND d.revoked_at IS NULL
                     AND d.valid_from <= now() AND d.valid_until > now()
                     AND a.island_id = d.island_id
                     AND a.teacher_id = d.teacher_id
                     AND a.issuer = %s AND a.client_id = %s
                     AND a.state = 'active'
                     AND m.state = 'active' AND p.kind = 'teacher'
                     AND p.state = 'active' AND i.state = 'active'""",
                (delegation_id, agent_id, island_id, teacher_id,
                 issuer, self.agent_client_id),
            ).fetchone()
            return row is not None
