"""Replaceable guardian-authorization decision for the local teacher demo.

The default grants every demo purpose without asserting that a real guardian
was contacted. Production authorization must come from the identity gateway.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


DEMO_CONSENT_REF = "demo-assumed-guardian-full-v1"
DEMO_GUARDIAN_REF = "demo-assumed-guardian"
DEMO_SHOWCASE_FIELDS = ("alias", "improvement", "score", "honor")


@dataclass(frozen=True)
class GuardianAuthorization:
    consent_ref: str
    assurance: str
    showcase_guardian_ref: str | None = None
    showcase_evidence_ref: str | None = None
    showcase_fields: tuple[str, ...] = ()


class GuardianAuthorizationProvider(Protocol):
    def resolve_enrollment(self, supplied_ref: str | None) -> GuardianAuthorization:
        """Return a decision for student enrollment; raise to deny it."""


class DemoGuardianAuthorizationProvider:
    """Assume full consent for synthetic data, with explicit low assurance."""

    def resolve_enrollment(self, supplied_ref: str | None) -> GuardianAuthorization:
        if supplied_ref is not None:
            return GuardianAuthorization(
                consent_ref=supplied_ref,
                assurance="unverified_supplied_reference",
            )
        return GuardianAuthorization(
            consent_ref=DEMO_CONSENT_REF,
            assurance="unverified_demo_default",
            showcase_guardian_ref=DEMO_GUARDIAN_REF,
            showcase_evidence_ref=DEMO_CONSENT_REF,
            showcase_fields=DEMO_SHOWCASE_FIELDS,
        )
