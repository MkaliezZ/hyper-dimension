"""Teacher Agent workload authorization for an island-bound MCP endpoint.

The verified workload token is separate from a human teacher login. A trusted
relationship store must check the delegation on every HTTP request.
"""
from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any
from urllib.parse import urlsplit

import jwt
from mcp.server.auth.provider import AccessToken
from mcp.server.auth.settings import AuthSettings
from mcp.server.transport_security import TransportSecuritySettings

from hyper_dimension.teacher_mcp import create_teacher_mcp

MCP_SCOPE = "hd.teacher.mcp"


class AgentMCPTokenVerifier:
    def __init__(
        self, *, issuer: str, resource_url: str, client_id: str,
        island_id: str, teacher_id: str,
        jwks_supplier: Callable[[], Mapping[str, Any]],
        active_delegation: Callable[[str, str, str, str, str], bool],
        max_token_seconds: int = 900,
    ) -> None:
        issuer_parts = urlsplit(issuer)
        resource_parts = urlsplit(resource_url)
        if (issuer_parts.scheme != "https" or not issuer_parts.hostname
                or issuer_parts.username or issuer_parts.password
                or issuer_parts.query or issuer_parts.fragment
                or resource_parts.scheme != "https" or not resource_parts.hostname
                or resource_parts.username or resource_parts.password
                or resource_parts.query or resource_parts.fragment
                or not resource_parts.path.endswith("/mcp")
                or not client_id or not island_id or not teacher_id
                or max_token_seconds < 1 or max_token_seconds > 3600):
            raise ValueError("Pinned issuer, resource, client and binding required")
        self.issuer = issuer
        self.resource_url = resource_url
        self.client_id = client_id
        self.island_id = island_id
        self.teacher_id = teacher_id
        self.jwks_supplier = jwks_supplier
        self.active_delegation = active_delegation
        self.max_token_seconds = max_token_seconds

    async def verify_token(self, token: str) -> AccessToken | None:
        if not token or len(token) > 16_384:
            return None
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") != "RS256" or not isinstance(header.get("kid"), str):
                return None
            try:
                keys = self.jwks_supplier().get("keys", [])
            except Exception:
                return None
            matches = [
                key for key in keys
                if isinstance(key, dict) and key.get("kid") == header["kid"]
                and key.get("kty") == "RSA"
                and key.get("use", "sig") == "sig"
                and key.get("alg", "RS256") == "RS256"
            ]
            if len(matches) != 1:
                return None
            signing_key = jwt.PyJWK.from_dict(matches[0], algorithm="RS256").key
            claims = jwt.decode(
                token, signing_key, algorithms=["RS256"],
                audience=self.resource_url, issuer=self.issuer,
                options={"require": [
                    "iss", "sub", "aud", "azp", "scope", "exp", "nbf", "iat",
                    "jti", "agent_id", "delegation_id", "island_id", "teacher_id",
                ]},
            )
            agent_id = claims["agent_id"]
            delegation_id = claims["delegation_id"]
            if (not isinstance(agent_id, str) or not agent_id
                    or not isinstance(delegation_id, str) or not delegation_id
                    or claims["sub"] != agent_id
                    or claims["aud"] != self.resource_url
                    or claims["azp"] != self.client_id
                    or claims["island_id"] != self.island_id
                    or claims["teacher_id"] != self.teacher_id
                    or not isinstance(claims["jti"], str) or not claims["jti"]
                    or not isinstance(claims["scope"], str)
                    or MCP_SCOPE not in claims["scope"].split()
                    or not isinstance(claims["iat"], int)
                    or not isinstance(claims["exp"], int)
                    or claims["exp"] <= claims["iat"]
                    or claims["exp"] - claims["iat"] > self.max_token_seconds):
                return None
            try:
                active = self.active_delegation(
                    self.issuer, agent_id, delegation_id,
                    self.island_id, self.teacher_id,
                )
            except Exception:
                return None
            if active is not True:
                return None
            return AccessToken(
                token=token, client_id=self.client_id, scopes=[MCP_SCOPE],
                expires_at=claims["exp"], resource=self.resource_url,
                subject=agent_id, claims={
                    "agent_id": agent_id, "delegation_id": delegation_id,
                    "island_id": self.island_id, "teacher_id": self.teacher_id,
                    "jti": claims["jti"],
                },
            )
        except (jwt.PyJWTError, ValueError, TypeError, KeyError, AttributeError):
            return None


def create_teacher_remote_mcp(
    assessment, records, *, island_id: str, teacher_id: str,
    issuer: str, resource_url: str, client_id: str,
    jwks_supplier: Callable[[], Mapping[str, Any]],
    active_delegation: Callable[[str, str, str, str, str], bool],
    catalog=None,
):
    """Build one teacher's authenticated, stateless Streamable HTTP MCP server.

    Deployment must terminate TLS and supply a persistent delegation store.
    This factory alone does not activate an island or make student data safe.
    """
    verifier = AgentMCPTokenVerifier(
        issuer=issuer, resource_url=resource_url, client_id=client_id,
        island_id=island_id, teacher_id=teacher_id,
        jwks_supplier=jwks_supplier, active_delegation=active_delegation,
    )
    auth = AuthSettings(
        issuer_url=issuer, resource_server_url=resource_url,
        validate_token_resource=True, required_scopes=[MCP_SCOPE],
    )
    host = urlsplit(resource_url).netloc
    return create_teacher_mcp(
        assessment, records, tenant_id=island_id, teacher_id=teacher_id,
        catalog=catalog, remote_token_verifier=verifier, remote_auth=auth,
        remote_transport_security=TransportSecuritySettings(
            allowed_hosts=[host], allowed_origins=[],
        ),
    )
