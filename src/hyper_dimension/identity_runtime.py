"""Assemble synthetic teacher HTTP API and Agent MCP with live PostgreSQL ACLs.

This still uses local SQLite business records and demo guardian assumptions.
It is not a production service for real student data.
"""
from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Any
from urllib.parse import urlsplit

import httpx

from hyper_dimension.agent_mcp_identity import create_teacher_remote_mcp
from hyper_dimension.identity_store import IdentityStore
from hyper_dimension.local_education_api import create_local_education_app
from hyper_dimension.teacher_identity import TeacherOIDCVerifier


class PinnedJWKSSupplier:
    """Fetch only a configured HTTPS Keycloak JWKS endpoint, with a short cache."""

    def __init__(
        self, *, issuer: str, jwks_url: str,
        client: httpx.Client | None = None, ttl_seconds: int = 60,
    ) -> None:
        issuer_parts = urlsplit(issuer)
        parts = urlsplit(jwks_url)
        if (issuer_parts.scheme != "https" or not issuer_parts.hostname
                or issuer_parts.username or issuer_parts.password
                or issuer_parts.query or issuer_parts.fragment
                or parts.scheme != "https" or parts.netloc != issuer_parts.netloc
                or parts.username or parts.password or parts.query or parts.fragment
                or not jwks_url.startswith(issuer.rstrip("/") + "/")
                or not parts.path.endswith("/protocol/openid-connect/certs")
                or ttl_seconds < 1 or ttl_seconds > 300):
            raise ValueError("Pinned same-realm HTTPS Keycloak JWKS URL required")
        self.url = jwks_url
        self.client = client or httpx.Client()
        self.ttl_seconds = ttl_seconds
        self._lock = Lock()
        self._keys: dict[str, Any] | None = None
        self._expires_at = 0.0

    def __call__(self) -> dict[str, Any]:
        with self._lock:
            if self._keys is not None and monotonic() < self._expires_at:
                return self._keys
            # Failure never extends a stale key cache.
            self._keys = None
            self._expires_at = 0.0
            response = self.client.get(
                self.url, timeout=3.0, follow_redirects=False,
            )
            response.raise_for_status()
            if len(response.content) > 65_536:
                raise ValueError("JWKS response too large")
            document = response.json()
            if (not isinstance(document, dict)
                    or not isinstance(document.get("keys"), list)
                    or not 1 <= len(document["keys"]) <= 32
                    or not all(isinstance(key, dict) for key in document["keys"])):
                raise ValueError("Invalid JWKS document")
            self._keys = document
            self._expires_at = monotonic() + self.ttl_seconds
            return document


@dataclass(frozen=True)
class SyntheticIslandServices:
    teacher_api: Any
    teacher_mcp_http: Any


def build_synthetic_island_services(
    assessment, records, *, database_dsn: str, island_id: str,
    teacher_id: str, issuer: str, jwks_url: str,
    teacher_api_audience: str, teacher_client_id: str,
    agent_client_id: str, mcp_resource_url: str,
    catalog=None, jwks_client: httpx.Client | None = None,
) -> SyntheticIslandServices:
    """Wire both HTTP surfaces to the same live relationship store.

    Provisioning, token issuance, login, HTTPS hosting, guardian verification
    and business-data migration remain separate unfinished gates.
    """
    store = IdentityStore(database_dsn, agent_client_id=agent_client_id)
    jwks = PinnedJWKSSupplier(
        issuer=issuer, jwks_url=jwks_url, client=jwks_client,
    )
    jwks()  # Fail service startup if trusted signing keys are unavailable.
    teacher_verifier = TeacherOIDCVerifier(
        issuer=issuer, audience=teacher_api_audience,
        client_id=teacher_client_id, jwks_supplier=jwks,
        active_membership=store.active_teacher,
    )
    teacher_api = create_local_education_app(
        assessment, records, tenant_id=island_id, teacher_id=teacher_id,
        teacher_verifier=teacher_verifier, agent_native=True, catalog=catalog,
    )
    remote_mcp = create_teacher_remote_mcp(
        assessment, records, island_id=island_id, teacher_id=teacher_id,
        issuer=issuer, resource_url=mcp_resource_url,
        client_id=agent_client_id, jwks_supplier=jwks,
        active_delegation=store.active_delegation, catalog=catalog,
    )
    return SyntheticIslandServices(
        teacher_api=teacher_api,
        teacher_mcp_http=remote_mcp.streamable_http_app(),
    )
