"""Opt-in OIDC teacher credential verification for synthetic API integration.

This verifies a signed bearer token and consults current membership on every
request. The membership provider must be backed by a trusted server-side store;
this module does not implement login, consent, or production relationship storage.
"""
from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

import jwt


class TeacherAuthenticationError(Exception):
    """A credential cannot be used for this teacher and island."""


class TeacherOIDCVerifier:
    def __init__(
        self, *, issuer: str, audience: str, client_id: str,
        jwks_supplier: Callable[[], Mapping[str, Any]],
        active_membership: Callable[[str, str, str, str], bool],
        max_token_seconds: int = 900,
    ) -> None:
        if (not issuer.startswith("https://") or not audience or not client_id
                or max_token_seconds < 1 or max_token_seconds > 3600):
            raise ValueError("Pinned HTTPS issuer, audience, client and token lifetime required")
        self.issuer = issuer
        self.audience = audience
        self.client_id = client_id
        self.jwks_supplier = jwks_supplier
        self.active_membership = active_membership
        self.max_token_seconds = max_token_seconds

    def verify(self, token: str, *, tenant_id: str, teacher_id: str) -> str:
        """Return signed subject only when token and live teacher binding pass."""
        if not token or len(token) > 16_384 or not tenant_id or not teacher_id:
            raise TeacherAuthenticationError("Teacher authentication required")
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") != "RS256" or not isinstance(header.get("kid"), str):
                raise ValueError("Disallowed signing algorithm or key")
            kid = header["kid"]
            try:
                keys = self.jwks_supplier().get("keys", [])
            except Exception as exc:
                raise ValueError("Trusted key source unavailable") from exc
            matches = [
                key for key in keys
                if isinstance(key, dict) and key.get("kid") == kid
                and key.get("kty") == "RSA"
                and key.get("use", "sig") == "sig"
                and key.get("alg", "RS256") == "RS256"
            ]
            if len(matches) != 1:
                raise ValueError("No unique trusted signing key")
            public_key = jwt.PyJWK.from_dict(matches[0], algorithm="RS256").key
            claims = jwt.decode(
                token, public_key, algorithms=["RS256"],
                audience=self.audience, issuer=self.issuer,
                options={"require": ["iss", "sub", "aud", "exp", "nbf", "iat", "jti", "azp", "scope"]},
            )
            if (not isinstance(claims["sub"], str) or not claims["sub"]
                    or not isinstance(claims["jti"], str) or not claims["jti"]
                    or claims["azp"] != self.client_id
                    or claims["aud"] != self.audience
                    or not isinstance(claims["scope"], str)
                    or "hd.teacher" not in claims["scope"].split()
                    or not isinstance(claims["exp"], int)
                    or not isinstance(claims["iat"], int)
                    or claims["exp"] <= claims["iat"]
                    or claims["exp"] - claims["iat"] > self.max_token_seconds):
                raise ValueError("Teacher claims invalid")
            try:
                active = self.active_membership(
                    self.issuer, claims["sub"], tenant_id, teacher_id,
                )
            except Exception as exc:
                raise ValueError("Membership source unavailable") from exc
            if active is not True:
                raise ValueError("Teacher binding inactive")
            return claims["sub"]
        except (jwt.PyJWTError, ValueError, TypeError, KeyError, AttributeError) as exc:
            raise TeacherAuthenticationError("Teacher authentication required") from exc
