"""HTTP adapter for a separately deployed assessment Agent.

The endpoint is a trusted service-to-service endpoint. It must implement the
documented generate and grade_writing operations, not accept student calls.
"""
from __future__ import annotations

from typing import Any

import httpx


class HTTPAssessmentAgent:
    def __init__(self, endpoint: str, api_key: str, timeout: float = 45.0):
        if not endpoint.startswith(("https://", "http://127.0.0.1:", "http://localhost:")):
            raise ValueError("Assessment Agent endpoint must use HTTPS or localhost")
        if not api_key:
            raise ValueError("Assessment Agent key is required")
        self.endpoint = endpoint
        self.api_key = api_key
        self.timeout = timeout

    def _call(self, operation: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = httpx.post(
            self.endpoint,
            json={"operation": operation, **payload},
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=self.timeout,
        )
        response.raise_for_status()
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError("Assessment Agent response must be a JSON object")
        return result

    def generate(self, profile: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
        return self._call("generate", {"profile": profile, "policy": policy})["bundle"]

    def grade_writing(self, bundle: dict[str, Any], answer: str) -> dict[str, Any]:
        return self._call("grade_writing", {"bundle": bundle, "answer": answer})["grade"]

    def draft_report(self, context: dict[str, Any]) -> dict[str, Any]:
        return self._call("draft_report", {"context": context})["report"]
