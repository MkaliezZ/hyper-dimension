"""Opt-in loopback A2A v1 JSON-RPC adapter for synthetic teacher data.

Only two read operations are implemented. All JSON-RPC methods, including
GetTask, require the same local teacher bearer token. This is not a
production identity gateway or a student-agent endpoint.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hmac
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

from a2a.helpers import new_data_part, new_task_from_user_message
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import create_agent_card_routes, create_jsonrpc_routes
from a2a.server.tasks import InMemoryTaskStore, TaskUpdater
from a2a.types import (
    AgentCapabilities, AgentCard, AgentInterface, AgentSkill,
    HTTPAuthSecurityScheme, SecurityRequirement, SecurityScheme, StringList,
)
from google.protobuf.json_format import MessageToDict
from jsonschema import Draft202012Validator, ValidationError
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from hyper_dimension.assessment_runtime import AssessmentError
from hyper_dimension.education_profile import (
    profile_from_a2a_part, validate_profile_result,
)
from hyper_dimension.student_records import StudentRecords

PROFILE_READ = "hd.education.student.profile.read.v1"
SHOWCASE_READ = "hd.education.showcase.public.read.v1"
SUPPORTED = {PROFILE_READ, SHOWCASE_READ}

CARD_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["entry_ref", "slot", "kind", "title", "summary",
                 "student_alias", "metrics"],
    "properties": {
        "entry_ref": {"type": "string", "minLength": 1},
        "slot": {"enum": ["learning", "portfolio", "honors"]},
        "kind": {"enum": ["improvement", "honor"]},
        "title": {"type": "string"}, "summary": {"type": "string"},
        "student_alias": {"type": "string"},
        "metrics": {"type": "object", "additionalProperties": False,
                    "properties": {
                        "before_score": {"type": "number"},
                        "after_score": {"type": "number"},
                        "unit": {"type": "string"}}},
    },
}
PROFILE_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["student_ref", "class_id", "age", "grade", "book_id",
                 "school_progress", "display_name", "public_alias",
                 "teacher_notes", "learning_goals", "version"],
    "properties": {
        "student_ref": {"type": "string", "pattern": r"^stu_[0-9a-f]{32}$"},
        "class_id": {"type": "string"}, "age": {"type": "integer"},
        "grade": {"type": "integer"}, "book_id": {"type": "string"},
        "school_progress": {"type": "string"}, "display_name": {"type": "string"},
        "public_alias": {"type": "string"}, "teacher_notes": {"type": "string"},
        "learning_goals": {"type": "string"}, "version": {"type": "integer"},
    },
}
CONTENT_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "urn:hyperdimension:education:a2a-read-content:1.2",
    "type": "object", "additionalProperties": False,
    "required": ["protocol_version", "request_id", "operation", "payload"],
    "properties": {
        "protocol_version": {"const": "1.2"},
        "request_id": {"type": "string", "minLength": 1},
        "operation": {"enum": [PROFILE_READ, SHOWCASE_READ]},
        "payload": {"type": "object"},
    },
    "oneOf": [
        {"properties": {
            "operation": {"const": PROFILE_READ},
            "payload": {"type": "object", "additionalProperties": False,
                        "required": ["profile"],
                        "properties": {"profile": PROFILE_SCHEMA}}}},
        {"properties": {
            "operation": {"const": SHOWCASE_READ},
            "payload": {"type": "object", "additionalProperties": False,
                        "required": ["entries", "has_more"],
                        "properties": {
                            "entries": {"type": "array", "maxItems": 20,
                                        "items": CARD_SCHEMA},
                            "has_more": {"type": "boolean"}}}}},
    ],
}
CONTENT_VALIDATOR = Draft202012Validator(CONTENT_SCHEMA)


def _audit(records: StudentRecords, tenant_id: str, request_id: str,
           operation: str, outcome: str, student_ref: str | None,
           task_id: str, context_id: str) -> str:
    """Persist an independent A2A interaction event, never the bearer token."""
    event_id = "a2aevt_" + uuid4().hex
    with records.assessment._db() as db:
        db.execute(
            """INSERT INTO a2a_read_events
               (event_id, tenant_id, request_id, operation, outcome,
                student_ref, actor_id, task_id, context_id, occurred_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (event_id, tenant_id, request_id, operation, outcome,
             student_ref, records.teacher_id, task_id, context_id,
             datetime.now(timezone.utc).isoformat()),
        )
    return event_id


def _ensure_audit_table(records: StudentRecords) -> None:
    with records.assessment._db() as db:
        db.execute(
            """CREATE TABLE IF NOT EXISTS a2a_read_events (
               event_id TEXT PRIMARY KEY,
               tenant_id TEXT NOT NULL,
               request_id TEXT NOT NULL,
               operation TEXT NOT NULL,
               outcome TEXT NOT NULL,
               student_ref TEXT,
               actor_id TEXT NOT NULL,
               task_id TEXT NOT NULL,
               context_id TEXT NOT NULL,
               occurred_at TEXT NOT NULL
            )"""
        )


class EducationReadExecutor(AgentExecutor):
    def __init__(self, records: StudentRecords, tenant_id: str):
        self.records = records
        self.tenant_id = tenant_id

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        message = context.message
        if message is None:
            raise ValueError("A2A message required")
        task = context.current_task or new_task_from_user_message(message)
        if context.current_task is None:
            await event_queue.enqueue_event(task)
        updater = TaskUpdater(event_queue, task.id, task.context_id)
        if context.current_task is not None:
            await updater.reject()
            return
        if len(message.parts) != 1:
            await updater.reject()
            return
        try:
            part = MessageToDict(message.parts[0], preserving_proto_field_name=False)
            command = profile_from_a2a_part(part)
        except (ValidationError, ValueError):
            await updater.reject()
            return

        op = command["operation"]
        student_ref = command.get("student_ref")
        reason = None
        content: dict[str, Any] | None = None
        refs: list[dict[str, str]] = []
        if command["island_id"] != self.tenant_id:
            reason = "NOT_FOUND"
        elif op not in SUPPORTED:
            reason = "POLICY_BLOCKED"
        else:
            try:
                if op == PROFILE_READ:
                    profile = self.records.profile(self.tenant_id, student_ref)
                    content = {"profile": {
                        "student_ref": profile["student_id"],
                        **{key: profile[key] for key in (
                            "class_id", "age", "grade", "book_id",
                            "school_progress", "display_name", "public_alias",
                            "teacher_notes", "learning_goals", "version")}}}
                    refs = [{"kind": "profile", "ref": student_ref}]
                else:
                    entries = self.records.public_showcase(
                        self.tenant_id, command["payload"].get("slot"))
                    content = {"entries": entries[:20], "has_more": len(entries) > 20}
                    refs = [{"kind": "showcase_entry", "ref": item["entry_ref"]}
                            for item in entries[:20]]
            except AssessmentError:
                reason = "NOT_FOUND"

        structured = None
        if content is not None:
            structured = {
                "protocol_version": "1.2",
                "request_id": command["request_id"],
                "operation": op,
                "payload": content,
            }
            CONTENT_VALIDATOR.validate(structured)

        outcome = "rejected" if reason else "completed"
        audit_id = _audit(self.records, self.tenant_id, command["request_id"],
                          op, outcome, student_ref, task.id, task.context_id)
        result = {
            "protocol_version": "1.2",
            "request_id": command["request_id"],
            "operation": op,
            "status": outcome,
            "reason_code": reason or "OK",
            "record_refs": [] if reason else refs,
            "audit_event_id": audit_id,
        }
        validate_profile_result(result, command)
        parts = [new_data_part(result, media_type="application/json")]
        if structured is not None:
            parts.append(new_data_part(structured, media_type="application/json"))
        await updater.add_artifact(parts=parts, name="hd.education.read.v1")
        if reason:
            await updater.reject()
        else:
            await updater.complete()

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        if context.task_id and context.context_id:
            await TaskUpdater(event_queue, context.task_id, context.context_id).cancel()


def _card(base_url: str) -> AgentCard:
    bearer = SecurityScheme(
        http_auth_security_scheme=HTTPAuthSecurityScheme(
            scheme="bearer", bearer_format="opaque"))
    requirement = SecurityRequirement(
        schemes={"teacherBearer": StringList(list=[])})
    return AgentCard(
        name="Hyper Dimension Local Education Read Agent",
        description="Loopback synthetic teacher read adapter; no student Agent or write operations.",
        version="0.1.0",
        supported_interfaces=[AgentInterface(
            protocol_binding="JSONRPC", url=base_url.rstrip("/") + "/a2a",
            protocol_version="1.0")],
        capabilities=AgentCapabilities(streaming=False, push_notifications=False),
        default_input_modes=["application/json"],
        default_output_modes=["application/json"],
        security_schemes={"teacherBearer": bearer},
        security_requirements=[requirement],
        skills=[
            AgentSkill(
                id=PROFILE_READ, name="Read teacher student profile",
                description="Read a synthetic student's private profile within the bound teacher island.",
                tags=["education", "teacher", "read"],
                input_modes=["application/json"], output_modes=["application/json"]),
            AgentSkill(
                id=SHOWCASE_READ, name="Read published showcase",
                description="Read currently published, consented showcase cards in the bound island.",
                tags=["education", "showcase", "read"],
                input_modes=["application/json"], output_modes=["application/json"]),
        ],
    )


def create_local_a2a_app(records: StudentRecords, *, tenant_id: str,
                         teacher_id: str, teacher_token: str,
                         base_url: str = "http://127.0.0.1:8770") -> Starlette:
    parsed = urlparse(base_url)
    if (not tenant_id or not teacher_id or records.teacher_id != teacher_id
            or len(teacher_token) < 24
            or parsed.scheme != "http"
            or parsed.hostname not in {"127.0.0.1", "localhost"}
            or parsed.path not in {"", "/"}
            or parsed.query or parsed.fragment):
        raise ValueError("Loopback URL and bound local teacher identity required")
    _ensure_audit_table(records)
    card = _card(base_url)
    handler = DefaultRequestHandler(
        agent_executor=EducationReadExecutor(records, tenant_id),
        task_store=InMemoryTaskStore(),
        agent_card=card,
    )
    routes = create_agent_card_routes(card)
    routes.extend(create_jsonrpc_routes(handler, "/a2a"))
    app = Starlette(routes=routes)

    async def require_teacher(request: Request, call_next):
        if request.url.path == "/a2a":
            header = request.headers.get("authorization", "")
            if (not header.startswith("Bearer ")
                    or not hmac.compare_digest(header[7:], teacher_token)):
                return JSONResponse({"error": "Teacher authentication required"},
                                    status_code=401)
        return await call_next(request)

    app.add_middleware(BaseHTTPMiddleware, dispatch=require_teacher)
    return app
