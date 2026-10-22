"""Small shared store: snapshots, scoped access and idempotent submissions."""
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import hmac
import json
from pathlib import Path
import secrets
import sqlite3
from uuid import uuid4
from base.app.activities import prepare_activity
from base.app.assessment import validate_activity, evaluate_submission


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, folder):
        self.folder = Path(folder).resolve()
        self.folder.mkdir(parents=True, exist_ok=True)
        self.path = self.folder / 'base.sqlite3'
        with self.db() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, learner TEXT NOT NULL, token TEXT UNIQUE NOT NULL, snapshot TEXT NOT NULL, created TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), request_key TEXT NOT NULL, answer TEXT NOT NULL, evaluation TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(task_id,request_key));
            CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), evaluation TEXT NOT NULL, created TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS task_requests(key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, task_id TEXT NOT NULL REFERENCES tasks(id));
            ''')
            db.execute('INSERT OR IGNORE INTO settings VALUES (?,?)', ('owner_token', secrets.token_urlsafe(32)))
            self.owner_token = db.execute('SELECT value FROM settings WHERE key=?', ('owner_token',)).fetchone()[0]

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def authorize(self, token):
        if not isinstance(token, str) or not token or not hmac.compare_digest(token, self.owner_token):
            raise PermissionError('请先登录维护者入口')

    def create(self, learner, draft=None, request_key=None):
        if not isinstance(learner, str) or not learner.strip() or len(learner) > 80:
            raise ValueError('学习者称呼：请填写1至80字')
        snapshot = validate_activity(prepare_activity() if draft is None else draft)
        if request_key is not None and (not isinstance(request_key, str) or not 0 < len(request_key) <= 128):
            raise ValueError('创建操作标识无效')
        fingerprint = hashlib.sha256(json.dumps([learner.strip(), snapshot], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        task = {'id': uuid4().hex, 'learner_id': uuid4().hex, 'learner': learner.strip(), 'token': secrets.token_urlsafe(24), 'created': now()}
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            if request_key:
                previous = db.execute('SELECT * FROM task_requests WHERE key=?', (request_key,)).fetchone()
                if previous:
                    if previous['fingerprint'] != fingerprint:
                        raise ValueError('创建操作已保存；内容变化请使用新的操作标识')
                    return dict(db.execute('SELECT id,learner_id,learner,token,created FROM tasks WHERE id=?', (previous['task_id'],)).fetchone())
            db.execute('INSERT INTO tasks VALUES (?,?,?,?,?,?)', (task['id'], task['learner_id'], task['learner'], task['token'], json.dumps(snapshot, ensure_ascii=False), task['created']))
            if request_key:
                db.execute('INSERT INTO task_requests VALUES (?,?,?)', (request_key, fingerprint, task['id']))
        return task

    def task(self, token):
        with self.db() as db:
            row = db.execute('SELECT * FROM tasks WHERE token=?', (token,)).fetchone()
        if row is None:
            raise KeyError('学习链接不存在')
        result = dict(row)
        result['snapshot'] = json.loads(result['snapshot'])
        return result

    def public_task(self, token):
        task = self.task(token)
        allowed = ('name', 'activity_title', 'instructions', 'criteria', 'next_step', 'material', 'mode')
        return {'learner': task['learner'], 'activity': {k: task['snapshot'][k] for k in allowed}, 'submissions': self.submissions(task['id'])}

    def submissions(self, task_id=None):
        with self.db() as db:
            rows = db.execute('SELECT * FROM submissions' + (' WHERE task_id=?' if task_id else '') + ' ORDER BY created', (task_id,) if task_id else ()).fetchall()
        return [{**dict(row), 'evaluation': json.loads(row['evaluation'])} for row in rows]

    def submit(self, token, answer, request_key):
        task = self.task(token)
        if not isinstance(answer, str) or not answer.strip() or len(answer) > 20000:
            raise ValueError('请填写1至20000字的提交内容')
        if not isinstance(request_key, str) or not request_key or len(request_key) > 128:
            raise ValueError('提交标识无效，请刷新页面后重试')
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            previous = db.execute('SELECT * FROM submissions WHERE task_id=? AND request_key=?', (task['id'], request_key)).fetchone()
            if previous:
                if previous['answer'] != answer:
                    raise ValueError('这次提交已保存；修改内容请发起新一次提交')
                return {**dict(previous), 'evaluation': json.loads(previous['evaluation'])}
            evaluation = evaluate_submission(task['snapshot'], answer)
            result = {'id': uuid4().hex, 'task_id': task['id'], 'request_key': request_key, 'answer': answer, 'evaluation': evaluation, 'created': now()}
            db.execute('INSERT INTO submissions VALUES (?,?,?,?,?,?)', (result['id'], task['id'], request_key, answer, json.dumps(evaluation, ensure_ascii=False), result['created']))
        return result

    def feedback(self, submission_id, comment, next_step):
        if not all(isinstance(x, str) and 0 < len(x.strip()) <= 20000 for x in (comment, next_step)):
            raise ValueError('反馈和下一步均须填写1至20000字')
        result = {'status': 'reviewed', 'comment': comment, 'next_step': next_step, 'correct': None}
        with self.db() as db:
            if not db.execute('SELECT 1 FROM submissions WHERE id=?', (submission_id,)).fetchone():
                raise KeyError('找不到这次提交')
            db.execute('INSERT INTO reviews(submission_id,evaluation,created) VALUES (?,?,?)', (submission_id, json.dumps(result, ensure_ascii=False), now()))
            db.execute('UPDATE submissions SET evaluation=? WHERE id=?', (json.dumps(result, ensure_ascii=False), submission_id))
        return result

    def tasks(self):
        with self.db() as db:
            return [dict(row) for row in db.execute('SELECT id,learner_id,learner,token,created FROM tasks ORDER BY created')]
