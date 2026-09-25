import json

import httpx

from hyper_dimension.agent_deepseek import DeepSeekAssessmentAgent


def test_deepseek_adapter_minimizes_profile_and_requires_json():
    seen = {}

    def handler(request):
        body = json.loads(request.content)
        seen.update(body)
        assert request.headers["Authorization"] == "Bearer test-only-key"
        return httpx.Response(200, json={
            "choices": [{"finish_reason": "stop", "message": {"content": json.dumps({
                "questions": [
                    {"id": "r1", "kind": "mcq", "prompt": "Read a notice.",
                     "options": ["A", "B"]},
                    {"id": "r2", "kind": "mcq", "prompt": "Read a message.",
                     "options": ["A", "B"]},
                    {"id": "w1", "kind": "writing", "prompt": "Write a message."},
                ],
                "answer_key": {"r1": "A", "r2": "B"},
                "rubric": {"content": "Task", "communication": "Intent",
                           "organisation": "Order", "language": "English"},
            })}}]
        })

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        agent = DeepSeekAssessmentAgent("test-only-key", client=client)
        result = agent.generate(
            {"age": 12, "grade": 7, "book_id": "demo",
             "school_progress": "Unit 1", "recent_scores": [],
             "student_id": "must-not-be-sent", "guardian_id": "private"},
            {"version": 1, "teacher_id": "must-not-be-sent"},
        )
    assert result["agent_version"] == "deepseek-flash"
    assert seen["response_format"] == {"type": "json_object"}
    assert "# English Assessment" in seen["messages"][0]["content"]
    assert "# 原创英语题目生成流程" in seen["messages"][0]["content"]
    payload = json.loads(seen["messages"][1]["content"])
    assert "student_id" not in payload["profile"]
    assert "guardian_id" not in payload["profile"]
    assert "teacher_id" not in payload


def test_deepseek_json_output_retries_once_when_empty():
    calls = 0

    def handler(request):
        nonlocal calls
        calls += 1
        content = "" if calls == 1 else '{"ok": true}'
        return httpx.Response(200, json={
            "choices": [{"finish_reason": "stop", "message": {"content": content}}]
        })

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        agent = DeepSeekAssessmentAgent("test-only-key", client=client)
        result = agent._complete("Return JSON.", {"synthetic": True})
    assert result == {"ok": True}
    assert calls == 2
