"""Pinned Keycloak signing-key source behavior without external network."""
import httpx
import pytest

from hyper_dimension.identity_runtime import PinnedJWKSSupplier

ISSUER = "https://id.example.test/realms/demo"
JWKS_URL = ISSUER + "/protocol/openid-connect/certs"


@pytest.mark.parametrize("url", [
    "http://id.example.test/realms/demo/protocol/openid-connect/certs",
    "https://other.example.test/realms/demo/protocol/openid-connect/certs",
    "https://id.example.test/realms/other/protocol/openid-connect/certs",
    "https://user:pass@id.example.test/realms/demo/protocol/openid-connect/certs",
    JWKS_URL + "?token=secret",
])
def test_refuses_unpinned_jwks_source(url):
    with pytest.raises(ValueError):
        PinnedJWKSSupplier(issuer=ISSUER, jwks_url=url)


def test_cache_refresh_failure_does_not_serve_stale_keys():
    calls = {"count": 0}

    def handler(request):
        assert str(request.url) == JWKS_URL
        calls["count"] += 1
        if calls["count"] == 1:
            return httpx.Response(200, json={"keys": [{"kid": "key-1"}]})
        return httpx.Response(503)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        supplier = PinnedJWKSSupplier(
            issuer=ISSUER, jwks_url=JWKS_URL, client=client,
        )
        assert supplier()["keys"][0]["kid"] == "key-1"
        assert supplier()["keys"][0]["kid"] == "key-1"
        assert calls["count"] == 1
        supplier._expires_at = 0
        with pytest.raises(httpx.HTTPStatusError):
            supplier()
        assert supplier._keys is None
        assert calls["count"] == 2


def test_empty_key_set_fails_startup():
    with httpx.Client(transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json={"keys": []})
    )) as client:
        supplier = PinnedJWKSSupplier(
            issuer=ISSUER, jwks_url=JWKS_URL, client=client,
        )
        with pytest.raises(ValueError, match="Invalid JWKS"):
            supplier()
