import asyncio

import pytest

from hyper_dimension.teacher_agent_binding import (
    hermes_pending_config, prepare_teacher_binding,
)
from hyper_dimension.teacher_mcp import TEACHER_MCP_TOOL_NAMES, create_teacher_mcp
from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.no_backend_model import NoBackendModel
from hyper_dimension.student_records import StudentRecords


def test_required_binding_and_hermes_candidate_match_real_tools(tmp_path):
    assessment = AssessmentService(tmp_path / "db.sqlite3", NoBackendModel())
    records = StudentRecords(assessment, tmp_path / "private", teacher_id="teacher-1")
    server = create_teacher_mcp(
        assessment, records, tenant_id="island-1", teacher_id="teacher-1",
    )
    real_names = {tool.name for tool in asyncio.run(server.list_tools())}
    assert real_names == set(TEACHER_MCP_TOOL_NAMES)
    binding = prepare_teacher_binding(
        island_id="island-1", teacher_id="teacher-1",
        mcp_url="https://mcp.example.test/teacher/mcp",
    )
    assert set(binding["mcp"]["required_tools"]) == real_names
    assert binding["required_on_activation"]
    assert binding["state"] == "pending_identity_gateway"
    config = hermes_pending_config(binding)["mcp_servers"]["hyper_dimension"]
    assert config["enabled"] is False
    assert set(config["tools"]["include"]) == real_names
    assert config["headers"]["Authorization"] == "Bearer ${HD_MCP_ACCESS_TOKEN}"
    assert "synthetic-token" not in str(binding) + str(config)


@pytest.mark.parametrize("url", [
    "http://mcp.example.test/mcp",
    "https://user:pass@mcp.example.test/mcp",
    "https://mcp.example.test/mcp?token=secret",
    "https://mcp.example.test/not-mcp",
])
def test_binding_rejects_unsafe_urls(url):
    with pytest.raises(ValueError):
        prepare_teacher_binding(island_id="i", teacher_id="t", mcp_url=url)
