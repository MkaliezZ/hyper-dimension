"""DeepSeek adapter for the teacher-approved reading and writing assessment slice.

The API key is accepted at runtime, never saved or logged by this module.
Only minimized profile fields are sent to the provider.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx


class DeepSeekAssessmentAgent:
    def __init__(self, api_key: str, model: str = "deepseek-flash",
                 client: httpx.Client | None = None,
                 skill_root: str | Path | None = None):
        if not api_key:
            raise ValueError("DeepSeek API key is required")
        self._api_key = api_key
        self.model = model
        self._client = client or httpx.Client(timeout=90)
        root = Path(skill_root) if skill_root else Path(__file__).resolve().parents[2] / "skills" / "english-assessment"
        self._skill_context = "\n\n".join(
            (root / relative).read_text(encoding="utf-8")
            for relative in (
                "SKILL.md", "references/item-generation-workflow.md",
                "references/assessment-design.md", "references/output-contract.md",
            )
        )

    def _complete(self, instructions: str, payload: dict[str, Any]) -> dict[str, Any]:
        for _ in range(2):
            response = self._client.post(
                "https://api.deepseek.com/chat/completions",
                headers={"Authorization": "Bearer " + self._api_key},
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": instructions},
                        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                    ],
                    "response_format": {"type": "json_object"},
                    "max_tokens": 3000,
                    "stream": False,
                },
            )
            response.raise_for_status()
            try:
                choice = response.json()["choices"][0]
                if choice["finish_reason"] != "stop" or not choice["message"]["content"]:
                    continue
                result = json.loads(choice["message"]["content"])
                if isinstance(result, dict):
                    return result
            except (KeyError, IndexError, TypeError, ValueError):
                pass
        raise ValueError("Assessment Agent returned incomplete or invalid JSON twice")

    def generate(self, profile: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
        safe_profile = {key: profile[key] for key in
                        ("age", "grade", "book_id", "school_progress", "recent_scores")}
        instructions = (
            "You are a teacher-approved English assessment item writer for ages 6-15. "
            "Return one original JSON object only, using age, school grade, current "
            "textbook progress and prior scores as task-design context. Never claim "
            "Cambridge certification or quote textbook text. Create two short "
            "reading MCQs with one unambiguous answer each and one writing task "
            "that asks the learner to communicate an intention. The reading "
            "stimulus must be included in the question prompt, so students can "
            "answer without outside material. Return exactly these keys: "
            "questions (array of objects with id, kind, prompt; each mcq also has "
            "options), answer_key (MCQ id to correct option), rubric (content, "
            "communication, organisation, language; each a nonempty criterion). "
            "MCQ kinds are mcq; the writing kind is writing. "
            "Do not include answer keys or model answers in question prompts. "
            "Each answer_key value MUST be exactly one string from that question's "
            "options list; never use an index, letter label or paraphrase unless "
            "that exact string is one of the options. "
            "JSON example: {\"questions\":[{\"id\":\"r1\",\"kind\":\"mcq\","
            "\"prompt\":\"Read: ... Question: ...\",\"options\":[\"A\",\"B\",\"C\"]},"
            "{\"id\":\"r2\",\"kind\":\"mcq\",\"prompt\":\"Read: ... Question: ...\","
            "\"options\":[\"A\",\"B\",\"C\"]},{\"id\":\"w1\",\"kind\":\"writing\","
            "\"prompt\":\"Write a message ...\"}],\"answer_key\":{\"r1\":\"A\","
            "\"r2\":\"B\"},\"rubric\":{\"content\":\"...\",\"communication\":\"...\","
            "\"organisation\":\"...\",\"language\":\"...\"}}"
        )
        result = self._complete(
            instructions + "\nApply the following project assessment skill and workflow. "
            "For this API call, the strict JSON shape above is the output contract:\n"
            + self._skill_context,
            {
            "profile": safe_profile, "teacher_policy_version": policy["version"],
            "assessment_scope": "reading_and_writing",
        })
        result["agent_version"] = self.model
        return result

    def grade_writing(self, bundle: dict[str, Any], answer: str) -> dict[str, Any]:
        instructions = (
            "You are a cautious English writing assessor. Return JSON only. "
            "Use the supplied task and rubric. Score content, communication, "
            "organisation and language separately from 0 to 100; cite an exact "
            "short passage from the student's answer in evidence. Do not infer "
            "age, personality or stable ability from one answer. Use confidence "
            "0 to 1; lower it when evidence is thin or the task is ambiguous. "
            "JSON example: {\"scores\":{\"content\":70,\"communication\":75,"
            "\"organisation\":65,\"language\":60},\"confidence\":0.8,"
            "\"evidence\":\"student phrase and reason\"}."
        )
        return self._complete(instructions, {
            "questions": bundle["questions"], "rubric": bundle["rubric"],
            "writing_answer": answer,
        })


    def draft_report(self, context: dict[str, Any]) -> dict[str, Any]:
        instructions = (
            "Write a cautious personalized English learning report in simplified "
            "Chinese. Return JSON only with exactly summary (string), strengths "
            "(nonempty string list), needs_work (nonempty string list), and "
            "next_steps (nonempty string list). Base every observation on the "
            "provided answers, answer key, rubric scores and evidence. Refer to the school "
            "grade and textbook progress only as context. Describe wrong MCQs "
            "as task-level errors, not stable deficits. Give 2-3 specific next "
            "steps including a new-context retest. Never claim official KET/PET, "
            "CEFR or national exam levels. JSON example: "
            "{\"summary\":\"本次任务...\",\"strengths\":[\"...\"],"
            "\"needs_work\":[\"...\"],\"next_steps\":[\"...\"]}."
        )
        return self._complete(instructions, context)
