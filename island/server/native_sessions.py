"""Canonical Hermes sessions; local persistence never enables automatic recall."""
import os, re, sqlite3, uuid
from pathlib import Path
from datetime import datetime, timezone

class SessionRestoreError(ValueError):
    code = 'hermes_resume_unavailable'

class NativeSessions:
    def __init__(self, home):
        from hermes_state import SessionDB
        self.path = Path(home).resolve() / "state.db"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.is_symlink():
            raise RuntimeError("Hermes session database cannot be a symbolic link")
        if self.path.exists():
            with sqlite3.connect(self.path.as_uri() + "?mode=ro", uri=True) as connection:
                if connection.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
                    raise RuntimeError("Hermes session database integrity check failed; original preserved")
        self.db = SessionDB(db_path=self.path)
        self.closed = False
        with sqlite3.connect(str(self.path), timeout=10) as connection:
            connection.execute("PRAGMA foreign_keys=ON")
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS hd_session_scopes (
                    session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
                    mode TEXT NOT NULL CHECK(mode IN ('manual','island','recruit','a2a')),
                    theme TEXT NOT NULL, world_key TEXT, workdir TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS hd_session_runs (
                    id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                    ledger_run_id TEXT, phase TEXT NOT NULL, completed_at TEXT NOT NULL
                );
            """)

    def restore(self, packet):
        sid = packet.get("resumeSessionId")
        if sid is None:
            return None, None
        if packet.get("mode") != "manual" or not isinstance(sid, str) or not re.fullmatch(r"[A-Za-z0-9_-]{6,100}", sid):
            raise SessionRestoreError("只能在手动对话中明确选择要继续的工作")
        with sqlite3.connect(str(self.path), timeout=10) as connection:
            row = connection.execute("SELECT mode, theme, world_key FROM hd_session_scopes WHERE session_id=?", (sid,)).fetchone()
            last = connection.execute("SELECT phase FROM hd_session_runs WHERE session_id=? ORDER BY rowid DESC LIMIT 1", (sid,)).fetchone()
        if row != ("manual", packet.get("theme") or "", packet.get("worldKey")):
            raise SessionRestoreError("所选工作记录不属于当前小岛，或尚未保存；可以新开一条委托")
        if not last or last[0] != "completed":
            raise SessionRestoreError("上次执行结果尚未确认，请先检查文档成果再继续")
        meta = self.db.get_session(sid)
        if not meta or meta.get("end_reason") == "compression":
            raise SessionRestoreError("这项工作已产生新的记录，请从最新回复继续")
        history = self.db.get_messages_as_conversation(sid, repair_alternation=True)
        if not history:
            raise SessionRestoreError("所选工作没有可恢复的上下文，可以新开一条委托")
        return sid, history

    def finish(self, packet, records, phase):
        if not records:
            return None
        if not self.db.flush_token_counts(timeout=5):
            raise RuntimeError("Hermes session usage has not reached durable storage")
        workdir = str(Path(os.environ.get("TERMINAL_CWD") or self.path.parent).resolve())
        stamp = datetime.now(timezone.utc).isoformat()
        summaries = []
        for record in records:
            agent = record["agent"]
            sid = agent.session_id
            if getattr(agent, "_session_db", None) is not self.db or getattr(agent, "_persist_disabled", False):
                raise RuntimeError("Hermes session persistence boundary mismatch")
            meta = self.db.get_session(sid)
            if not meta:
                if phase == "completed":
                    raise RuntimeError("Hermes returned without a durable session")
                continue
            messages = self.db.get_messages_as_conversation(sid)
            if phase == "completed" and (not messages or messages[-1].get("role") != "assistant" or messages[-1].get("tool_calls")):
                raise RuntimeError("Hermes final reply has not reached durable storage")
            self.db.update_session_cwd(sid, workdir)
            self.db.end_session(sid, phase)
            with sqlite3.connect(str(self.path), timeout=10) as connection:
                connection.execute("PRAGMA foreign_keys=ON")
                previous = connection.execute("SELECT mode, theme, world_key FROM hd_session_scopes WHERE session_id=?", (sid,)).fetchone()
                scope = (packet.get("mode") or "island", packet.get("theme") or "", packet.get("worldKey"))
                if previous and previous != scope:
                    raise RuntimeError("Hermes session scope changed")
                connection.execute("INSERT OR IGNORE INTO hd_session_scopes VALUES(?,?,?,?,?,?)",
                    (sid, *scope, workdir, stamp))
                connection.execute("INSERT INTO hd_session_runs VALUES(?,?,?,?,?)",
                    (uuid.uuid4().hex, sid, packet.get("ledgerRunId"), phase, stamp))
            summaries.append({"id": sid, "parentId": meta.get("parent_session_id"),
                              "persisted": True, "canResume": phase == "completed" and scope[0] == "manual",
                              "mode": scope[0], "messages": len(messages)})
        return summaries[0] if summaries else None

    def close(self):
        if not self.closed:
            self.closed = True
            self.db.close()
