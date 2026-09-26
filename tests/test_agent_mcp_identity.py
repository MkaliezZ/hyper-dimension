"""Synthetic workload tokens and real MCP HTTP authorization checks."""
import asyncio
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from starlette.testclient import TestClient

from hyper_dimension.agent_mcp_identity import (
    AgentMCPTokenVerifier, MCP_SCOPE, create_teacher_remote_mcp,
)
from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.student_records import StudentRecords


class NoModel:
    pass


@pytest.fixture
def setup(tmp_path):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = jwt.algorithms.RSAAlgorithm.to_jwk(
        private_key.public_key(), as_dict=True,
    )
    jwk.update({"kid": "agent-key-1", "alg": "RS256", "use": "sig"})
    keys = {"keys": [jwk]}
    delegation = {"active": True}
    issuer = "https://id.example.test/realms/demo"
    resource = "https://mcp.example.test/mcp"
    verifier = AgentMCPTokenVerifier(
        issuer=issuer, resource_url=resource, client_id="teacher-runtime",
        island_id="island-1", teacher_id="teacher-1",
        jwks_supplier=lambda: keys,
        active_delegation=lambda iss, agent, grant, island, teacher: (
            delegation["active"] and iss == issuer and agent == "agent-1"
            and grant == "grant-1" and island == "island-1"
            and teacher == "teacher-1"
        ),
    )
    assessment = AssessmentService(tmp_path / "synthetic.sqlite3", NoModel())
    records = StudentRecords(assessment, tmp_path / "archive", teacher_id="teacher-1")
    return private_key, keys, delegation, verifier, assessment, records


def token(private_key, **changes):
    now = datetime.now(timezone.utc)
    claims = {
        "iss": "https://id.example.test/realms/demo",
        "sub": "agent-1", "agent_id": "agent-1", "delegation_id": "grant-1",
        "aud": "https://mcp.example.test/mcp",
        "azp": "teacher-runtime", "scope": MCP_SCOPE,
        "island_id": "island-1", "teacher_id": "teacher-1",
        "iat": now, "nbf": now, "exp": now + timedelta(minutes=5),
        "jti": "agent-jti-1",
    }
    claims.update(changes)
    return jwt.encode(
        claims, private_key, algorithm="RS256", headers={"kid": "agent-key-1"},
    )


@pytest.mark.parametrize("changed", [
    {"aud": "https://other.example.test/mcp"},
    {"aud": ["https://mcp.example.test/mcp", "https://other.example.test/mcp"]},
    {"scope": "hd.teacher"},
    {"azp": "other-runtime"},
    {"sub": "teacher-1"},
    {"agent_id": "other-agent"},
    {"delegation_id": "other-grant"},
    {"island_id": "island-2"},
    {"teacher_id": "teacher-2"},
    {"exp": datetime(2020, 1, 1, tzinfo=timezone.utc)},
    {"nbf": datetime(2099, 1, 1, tzinfo=timezone.utc)},
    {"exp": datetime(2099, 1, 1, tzinfo=timezone.utc)},
])
def test_workload_token_requires_exact_signed_claims(setup, changed):
    private_key, _, _, verifier, _, _ = setup
    assert asyncio.run(verifier.verify_token(token(private_key, **changed))) is None


def test_live_delegation_revocation_key_rotation_and_wrong_signer(setup):
    private_key, keys, delegation, verifier, _, _ = setup
    valid = token(private_key)
    principal = asyncio.run(verifier.verify_token(valid))
    assert principal is not None
    assert principal.subject == "agent-1"
    assert principal.claims["delegation_id"] == "grant-1"
    delegation["active"] = False
    assert asyncio.run(verifier.verify_token(valid)) is None
    delegation["active"] = True
    keys["keys"] = []
    assert asyncio.run(verifier.verify_token(valid)) is None
    keys["keys"] = [jwt.algorithms.RSAAlgorithm.to_jwk(
        private_key.public_key(), as_dict=True,
    ) | {"kid": "agent-key-1", "alg": "RS256", "use": "sig"}]
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert asyncio.run(verifier.verify_token(token(other_key))) is None


def test_real_mcp_http_route_refuses_missing_and_revoked_workload(setup):
    private_key, keys, delegation, _, assessment, records = setup
    with pytest.raises(ValueError, match="live class assignment"):
        create_teacher_remote_mcp(
            assessment, records, island_id="island-1", teacher_id="teacher-1",
            issuer="https://id.example.test/realms/demo",
            resource_url="https://mcp.example.test/mcp",
            client_id="teacher-runtime", jwks_supplier=lambda: keys,
            active_delegation=lambda *_: delegation["active"],
        )
    server = create_teacher_remote_mcp(
        assessment, records, island_id="island-1", teacher_id="teacher-1",
        issuer="https://id.example.test/realms/demo",
        resource_url="https://mcp.example.test/mcp",
        client_id="teacher-runtime", jwks_supplier=lambda: keys,
        active_delegation=lambda iss, agent, grant, island, teacher: (
            delegation["active"] and agent == "agent-1" and grant == "grant-1"
            and island == "island-1" and teacher == "teacher-1"
        ),
        class_assignment_check=lambda island, class_id, teacher: (
            island == "island-1" and class_id == "class-1"
            and teacher == "teacher-1"
        ),
    )
    assert server.settings.stateless_http is True
    request = {
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18", "capabilities": {},
            "clientInfo": {"name": "synthetic-test", "version": "1"},
        },
    }
    headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-06-18",
    }
    with TestClient(server.streamable_http_app(), base_url="https://mcp.example.test") as client:
        assert client.post("/mcp", json=request, headers=headers).status_code == 401
        authorized = headers | {"Authorization": "Bearer " + token(private_key)}
        response = client.post("/mcp", json=request, headers=authorized)
        assert response.status_code == 200, response.text
        assert response.json()["result"]["serverInfo"]["name"] == "Hyper Dimension Teacher Education"
        tools_request = {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
        listed = client.post("/mcp", json=tools_request, headers=authorized)
        assert listed.status_code == 200, listed.text
        assert any(
            item["name"] == "student_profile_read"
            for item in listed.json()["result"]["tools"]
        )
        delegation["active"] = False
        assert client.post("/mcp", json=tools_request, headers=authorized).status_code == 401
