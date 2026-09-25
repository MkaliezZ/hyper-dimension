"""Provider-neutral required MCP binding prepared during teacher-island onboarding.

This does not create a cloud island, issue credentials or authenticate a teacher.
A production identity gateway must verify discovery and activate the binding.
"""
from __future__ import annotations

from urllib.parse import urlsplit

from hyper_dimension.teacher_mcp import TEACHER_MCP_TOOL_NAMES


def prepare_teacher_binding(
    *, island_id: str, teacher_id: str, mcp_url: str,
) -> dict:
    if not island_id or not teacher_id:
        raise ValueError("Island and teacher identity are required")
    parsed = urlsplit(mcp_url)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or
        parsed.password or parsed.query or parsed.fragment or not parsed.path.endswith("/mcp")):
        raise ValueError("Production MCP URL must be HTTPS and end in /mcp")
    return {
        "schema_version": "hd.teacher-agent-binding.v1",
        "island_id": island_id,
        "teacher_id": teacher_id,
        "required_on_activation": True,
        "state": "pending_identity_gateway",
        "mcp": {
            "url": mcp_url,
            "transport": "streamable_http",
            "required_tools": list(TEACHER_MCP_TOOL_NAMES),
            "credential_env": "HD_MCP_ACCESS_TOKEN",
            "scope": "tenant_and_teacher",
        },
    }


def hermes_pending_config(binding: dict) -> dict:
    """Return a secret-free Hermes config fragment, disabled pending gateway activation."""
    if binding.get("schema_version") != "hd.teacher-agent-binding.v1":
        raise ValueError("Unsupported teacher binding")
    mcp = binding["mcp"]
    validated = prepare_teacher_binding(
        island_id=binding["island_id"],
        teacher_id=binding["teacher_id"],
        mcp_url=mcp["url"],
    )
    if (mcp["required_tools"] != validated["mcp"]["required_tools"] or
        mcp["credential_env"] != "HD_MCP_ACCESS_TOKEN" or
        binding.get("state") != "pending_identity_gateway"):
        raise ValueError("Untrusted teacher binding")
    return {
        "mcp_servers": {
            "hyper_dimension": {
                "url": mcp["url"],
                "enabled": False,
                "headers": {"Authorization": "Bearer ${HD_MCP_ACCESS_TOKEN}"},
                "tools": {
                    "include": list(mcp["required_tools"]),
                    "resources": False,
                    "prompts": False,
                },
            },
        },
    }
