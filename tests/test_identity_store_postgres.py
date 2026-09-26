"""Real PostgreSQL identity and delegation integration tests.

Set HD_TEST_PG_DSN to a disposable PostgreSQL database. CI supplies one.
"""
import asyncio
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
from uuid import uuid4

import jwt
import pytest
import httpx
from fastapi.testclient import TestClient
from cryptography.hazmat.primitives.asymmetric import rsa

if not os.getenv("HD_TEST_PG_DSN"):
    pytest.skip("HD_TEST_PG_DSN not set; real PostgreSQL required",
                allow_module_level=True)

psycopg = pytest.importorskip("psycopg")
from psycopg import sql
from psycopg.conninfo import make_conninfo

from hyper_dimension.agent_mcp_identity import AgentMCPTokenVerifier
from hyper_dimension.identity_store import (IdentityStore, apply_identity_migration,
                                            apply_teacher_class_migration)
from hyper_dimension.identity_runtime import build_synthetic_island_services
from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.student_records import StudentRecords
from hyper_dimension.teacher_identity import TeacherOIDCVerifier

ISSUER = "https://id.example.test/realms/demo"
RESOURCE = "https://mcp.example.test/mcp"
MIGRATION = Path(__file__).parents[1] / "migrations" / "0001_identity_gateway.sql"
CLASS_MIGRATION = Path(__file__).parents[1] / "migrations" / "0002_teacher_class_assignments.sql"


@pytest.fixture
def store():
    base_dsn = os.environ["HD_TEST_PG_DSN"]
    schema = "hd_test_" + uuid4().hex
    with psycopg.connect(base_dsn) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    dsn = make_conninfo(base_dsn, options="-c search_path=" + schema)
    try:
        apply_identity_migration(dsn, MIGRATION)
        apply_identity_migration(dsn, MIGRATION)
        apply_teacher_class_migration(dsn, CLASS_MIGRATION)
        apply_teacher_class_migration(dsn, CLASS_MIGRATION)
        yield IdentityStore(dsn, agent_client_id="teacher-runtime"), dsn
    finally:
        with psycopg.connect(base_dsn) as conn:
            conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(
                sql.Identifier(schema)))


def provision(store):
    repo, _ = store
    repo.register_teacher("teacher-1", ISSUER, "idp-teacher-1",
                          actor_ref="operator-test")
    repo.register_island("island-1", actor_ref="operator-test")
    repo.register_island("island-2", actor_ref="operator-test")
    repo.grant_teacher("island-1", "teacher-1", actor_ref="operator-test")
    repo.register_class("island-1", "class-1", actor_ref="operator-test")
    repo.grant_teacher_class("island-1", "class-1", "teacher-1",
                             actor_ref="operator-test")
    repo.register_agent("agent-1", ISSUER, "island-1", "teacher-1",
                        actor_ref="operator-test")
    repo.grant_delegation(
        "grant-1", "agent-1", "island-1", "teacher-1",
        datetime.now(timezone.utc) + timedelta(minutes=10),
        actor_ref="operator-test",
    )


def test_live_teacher_and_delegation_revocation_is_persistent(store):
    repo, dsn = store
    provision(store)
    assert repo.active_teacher(ISSUER, "idp-teacher-1", "island-1", "teacher-1")
    assert repo.active_teacher_class("island-1", "class-1", "teacher-1")
    assert not repo.active_teacher_class("island-1", "missing", "teacher-1")
    assert not repo.active_teacher(ISSUER, "idp-teacher-1", "island-2", "teacher-1")
    assert not repo.active_teacher(ISSUER, "other", "island-1", "teacher-1")
    assert repo.active_delegation(ISSUER, "agent-1", "grant-1",
                                  "island-1", "teacher-1")
    assert not repo.active_delegation(ISSUER, "agent-1", "grant-1",
                                      "island-2", "teacher-1")
    assert not repo.active_delegation(ISSUER, "other", "grant-1",
                                      "island-1", "teacher-1")
    reopened = IdentityStore(dsn, agent_client_id="teacher-runtime")
    assert reopened.active_delegation(ISSUER, "agent-1", "grant-1",
                                       "island-1", "teacher-1")
    assert repo.revoke_delegation("grant-1", actor_ref="operator-test")
    assert not repo.revoke_delegation("grant-1", actor_ref="operator-test")
    assert not reopened.active_delegation(ISSUER, "agent-1", "grant-1",
                                          "island-1", "teacher-1")
    assert repo.revoke_teacher("island-1", "teacher-1",
                               actor_ref="operator-test")
    assert not reopened.active_teacher(ISSUER, "idp-teacher-1",
                                        "island-1", "teacher-1")
    with psycopg.connect(dsn) as conn:
        events = conn.execute(
            "SELECT operation FROM auth_audit_events ORDER BY occurred_at"
        ).fetchall()
    assert len(events) == 10
    assert ("agent.delegation.revoke",) in events
    assert ("teacher.revoke",) in events


def test_class_assignment_revocation_is_live_and_audited(store):
    repo, dsn = store
    provision(store)
    repo.register_class("island-1", "class-2", actor_ref="operator-test")
    assert not repo.active_teacher_class("island-1", "class-2", "teacher-1")
    assert repo.revoke_teacher_class(
        "island-1", "class-1", "teacher-1", actor_ref="operator-test",
    )
    assert not repo.revoke_teacher_class(
        "island-1", "class-1", "teacher-1", actor_ref="operator-test",
    )
    assert not repo.active_teacher_class("island-1", "class-1", "teacher-1")
    with psycopg.connect(dsn) as conn:
        row = conn.execute(
            """SELECT class_id FROM auth_audit_events
               WHERE operation='teacher.class.revoke'""",
        ).fetchone()
    assert row == ("class-1",)


def test_signed_teacher_and_agent_verifiers_use_live_postgres(store):
    repo, _ = store
    provision(store)
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = jwt.algorithms.RSAAlgorithm.to_jwk(
        private.public_key(), as_dict=True,
    ) | {"kid": "key-1", "alg": "RS256", "use": "sig"}
    supplier = lambda: {"keys": [jwk]}
    teacher_verifier = TeacherOIDCVerifier(
        issuer=ISSUER, audience="hd-teacher-api", client_id="teacher-web",
        jwks_supplier=supplier, active_membership=repo.active_teacher,
    )
    agent_verifier = AgentMCPTokenVerifier(
        issuer=ISSUER, resource_url=RESOURCE, client_id="teacher-runtime",
        island_id="island-1", teacher_id="teacher-1",
        jwks_supplier=supplier, active_delegation=repo.active_delegation,
    )
    now = datetime.now(timezone.utc)
    base = {"iss": ISSUER, "iat": now, "nbf": now,
            "exp": now + timedelta(minutes=5), "jti": "test-jti"}
    teacher_token = jwt.encode(
        base | {"sub": "idp-teacher-1", "aud": "hd-teacher-api",
                "azp": "teacher-web", "scope": "hd.teacher"},
        private, algorithm="RS256", headers={"kid": "key-1"},
    )
    agent_token = jwt.encode(
        base | {"sub": "agent-1", "agent_id": "agent-1",
                "delegation_id": "grant-1", "aud": RESOURCE,
                "azp": "teacher-runtime", "scope": "hd.teacher.mcp",
                "island_id": "island-1", "teacher_id": "teacher-1"},
        private, algorithm="RS256", headers={"kid": "key-1"},
    )
    assert teacher_verifier.verify(
        teacher_token, tenant_id="island-1", teacher_id="teacher-1"
    ) == "idp-teacher-1"
    assert asyncio.run(agent_verifier.verify_token(agent_token)) is not None
    repo.revoke_delegation("grant-1", actor_ref="operator-test")
    assert asyncio.run(agent_verifier.verify_token(agent_token)) is None
    repo.revoke_teacher("island-1", "teacher-1", actor_ref="operator-test")
    from hyper_dimension.teacher_identity import TeacherAuthenticationError
    with pytest.raises(TeacherAuthenticationError):
        teacher_verifier.verify(
            teacher_token, tenant_id="island-1", teacher_id="teacher-1",
        )


def test_invalid_provisioning_is_atomic_and_not_audited(store):
    repo, dsn = store
    repo.register_teacher("teacher-1", ISSUER, "idp-teacher-1",
                          actor_ref="operator-test")
    with pytest.raises(ValueError):
        repo.grant_teacher("missing-island", "teacher-1",
                           actor_ref="operator-test")
    with pytest.raises(ValueError):
        repo.register_agent("agent-1", ISSUER, "missing-island",
                            "teacher-1", actor_ref="operator-test")
    with psycopg.connect(dsn) as conn:
        assert conn.execute("SELECT count(*) FROM auth_audit_events").fetchone()[0] == 1
        assert conn.execute("SELECT count(*) FROM teacher_memberships").fetchone()[0] == 0
        assert conn.execute("SELECT count(*) FROM agent_instances").fetchone()[0] == 0


def test_island_agent_and_teacher_revocation_all_stop_agent_access(store):
    repo, dsn = store
    provision(store)
    call = lambda: repo.active_delegation(
        ISSUER, "agent-1", "grant-1", "island-1", "teacher-1",
    )
    assert call()
    with psycopg.connect(dsn) as conn:
        conn.execute(
            "UPDATE identity_islands SET state = 'suspended' WHERE island_id = %s",
            ("island-1",),
        )
    assert not call()
    with psycopg.connect(dsn) as conn:
        conn.execute(
            "UPDATE identity_islands SET state = 'active' WHERE island_id = %s",
            ("island-1",),
        )
        conn.execute(
            "UPDATE agent_instances SET state = 'suspended' WHERE agent_id = %s",
            ("agent-1",),
        )
    assert not call()
    with psycopg.connect(dsn) as conn:
        conn.execute(
            "UPDATE agent_instances SET state = 'active' WHERE agent_id = %s",
            ("agent-1",),
        )
        conn.execute(
            """UPDATE agent_delegations
               SET valid_from = now() - interval '2 minutes',
                   valid_until = now() - interval '1 minute'
               WHERE delegation_id = %s""",
            ("grant-1",),
        )
    assert not call()
    with psycopg.connect(dsn) as conn:
        conn.execute(
            """UPDATE agent_delegations
               SET valid_from = now() - interval '1 minute',
                   valid_until = now() + interval '10 minutes'
               WHERE delegation_id = %s""",
            ("grant-1",),
        )
    assert call()
    assert repo.revoke_teacher("island-1", "teacher-1",
                               actor_ref="operator-test")
    assert not call()


def test_migration_checksum_rejects_changed_sql(store, tmp_path):
    _, dsn = store
    changed = tmp_path / "changed.sql"
    changed.write_text(MIGRATION.read_text(encoding="utf-8") + "\n-- drift\n",
                       encoding="utf-8")
    with pytest.raises(ValueError, match="checksum"):
        apply_identity_migration(dsn, changed)


def test_class_migration_checksum_rejects_changed_sql(store, tmp_path):
    _, dsn = store
    changed = tmp_path / "changed-class.sql"
    changed.write_text(
        CLASS_MIGRATION.read_text(encoding="utf-8") + "\n-- drift\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="checksum"):
        apply_teacher_class_migration(dsn, changed)


def test_http_teacher_and_mcp_use_same_live_postgres_acl(store, tmp_path):
    repo, dsn = store
    provision(store)
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = jwt.algorithms.RSAAlgorithm.to_jwk(
        private.public_key(), as_dict=True,
    ) | {"kid": "key-1", "alg": "RS256", "use": "sig"}
    jwks_url = ISSUER + "/protocol/openid-connect/certs"
    with httpx.Client(transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json={"keys": [jwk]})
    )) as jwks_client:
        assessment = AssessmentService(tmp_path / "synthetic.sqlite3", object())
        assessment.authorize_policy(
            tenant_id="island-1", class_id="class-1",
            teacher_id="teacher-1", policy_id="policy-1",
            weights={"reading": 0.5, "content": 0.125,
                     "communication": 0.125, "organisation": 0.125,
                     "language": 0.125},
        )
        records = StudentRecords(
            assessment, tmp_path / "archive", teacher_id="teacher-1",
        )
        student = records.create_student(
            tenant_id="island-1", class_id="class-1",
            display_name="Synthetic Learner", public_alias="Learner",
            age=12, grade=7, book_id="demo", school_progress="Unit 1",
            guardian_consent_ref="synthetic-consent",
        )
        services = build_synthetic_island_services(
            assessment, records, database_dsn=dsn,
            island_id="island-1", teacher_id="teacher-1",
            issuer=ISSUER, jwks_url=jwks_url,
            teacher_api_audience="hd-teacher-api",
            teacher_client_id="teacher-web",
            agent_client_id="teacher-runtime", mcp_resource_url=RESOURCE,
            jwks_client=jwks_client,
        )
        now = datetime.now(timezone.utc)
        common = {"iss": ISSUER, "iat": now, "nbf": now,
                  "exp": now + timedelta(minutes=5), "jti": "test-jti"}
        teacher_token = jwt.encode(
            common | {"sub": "idp-teacher-1", "aud": "hd-teacher-api",
                      "azp": "teacher-web", "scope": "hd.teacher"},
            private, algorithm="RS256", headers={"kid": "key-1"},
        )
        agent_token = jwt.encode(
            common | {"sub": "agent-1", "agent_id": "agent-1",
                      "delegation_id": "grant-1", "aud": RESOURCE,
                      "azp": "teacher-runtime", "scope": "hd.teacher.mcp",
                      "island_id": "island-1", "teacher_id": "teacher-1"},
            private, algorithm="RS256", headers={"kid": "key-1"},
        )
        profile_path = "/api/v1/teacher/students/" + student["student_ref"]
        teacher_headers = {"Authorization": "Bearer " + teacher_token}
        mcp_headers = {
            "Authorization": "Bearer " + agent_token,
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": "2025-06-18",
        }
        initialize = {
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18", "capabilities": {},
                "clientInfo": {"name": "postgres-integration", "version": "1"},
            },
        }
        with TestClient(services.teacher_api) as teacher_client, TestClient(
            services.teacher_mcp_http, base_url="https://mcp.example.test"
        ) as mcp_client:
            assert teacher_client.get(
                profile_path, headers=teacher_headers,
            ).status_code == 200
            assert mcp_client.post(
                "/mcp", json=initialize, headers=mcp_headers,
            ).status_code == 200
            profile_call = {
                "jsonrpc": "2.0", "id": 3, "method": "tools/call",
                "params": {
                    "name": "student_profile_read",
                    "arguments": {"student_ref": student["student_ref"]},
                },
            }
            tool_result = mcp_client.post(
                "/mcp", json=profile_call, headers=mcp_headers,
            )
            assert tool_result.status_code == 200
            assert tool_result.json()["result"].get("isError") is not True
            repo.revoke_teacher_class(
                "island-1", "class-1", "teacher-1",
                actor_ref="operator-test",
            )
            assert teacher_client.get(
                profile_path, headers=teacher_headers,
            ).status_code == 422
            denied_tool = mcp_client.post(
                "/mcp", json=profile_call, headers=mcp_headers,
            )
            assert denied_tool.status_code == 200
            assert denied_tool.json()["result"]["isError"] is True
            repo.revoke_delegation("grant-1", actor_ref="operator-test")
            assert mcp_client.post(
                "/mcp", json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
                headers=mcp_headers,
            ).status_code == 401
            repo.revoke_teacher("island-1", "teacher-1",
                                actor_ref="operator-test")
            assert teacher_client.get(
                profile_path, headers=teacher_headers,
            ).status_code == 401
