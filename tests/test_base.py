import json
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi.testclient import TestClient
from base.app.activities import prepare_activity
from base.core import Store
from base.web import create_app


def text_activity():
    return {**prepare_activity(), 'mode': 'text'}


def numeric():
    return {**prepare_activity(), 'name': '数值伴学', 'mode': 'numeric', 'expected': '1/2'}


def test_config_errors_point_to_editable_file(tmp_path, monkeypatch):
    from base.app import activities
    monkeypatch.setattr(activities, 'ROOT', tmp_path)
    with pytest.raises(ValueError, match='app/config.json'):
        activities.prepare_activity()
    (tmp_path / 'config.json').write_text('[]', encoding='utf-8')
    with pytest.raises(ValueError, match='顶层必须是对象'):
        activities.prepare_activity()


def test_names_isolation_and_manual_loop(tmp_path):
    service = Store(tmp_path)
    a, b = service.create('小林', text_activity()), service.create('小林', text_activity())
    assert a['learner_id'] != b['learner_id']
    submitted = service.submit(a['token'], '先试做，再记录观察。', 'one')
    assert submitted['evaluation']['status'] == 'pending'
    service.feedback(submitted['id'], '已写明行动，请增加观察时间。', '明天执行并记录。')
    assert Store(tmp_path).public_task(a['token'])['submissions'][0]['evaluation']['status'] == 'reviewed'
    assert service.public_task(b['token'])['submissions'] == []
    with service.db() as db:
        assert db.execute('SELECT count(*) FROM reviews').fetchone()[0] == 1


def test_numeric_snapshot_and_no_private_answer(tmp_path):
    service = Store(tmp_path)
    draft = numeric()
    task = service.create('测试', draft)
    draft['expected'] = '9'
    assert 'expected' not in service.public_task(task['token'])['activity']
    assert service.submit(task['token'], '0.5', 'a')['evaluation']['correct'] is True
    assert service.submit(task['token'], '2/3', 'b')['evaluation']['correct'] is False
    with pytest.raises(ValueError):
        service.submit(task['token'], '__import__("os")', 'c')


def test_idempotency_concurrent_and_conflict(tmp_path):
    service = Store(tmp_path)
    task = service.create('测试', text_activity(), request_key='create-one')
    assert service.create('测试', text_activity(), request_key='create-one')['id'] == task['id']
    with pytest.raises(ValueError):
        service.create('别人', text_activity(), request_key='create-one')
    with ThreadPoolExecutor(4) as pool:
        ids = list(pool.map(lambda _: service.submit(task['token'], '内容', 'same')['id'], range(4)))
    assert len(set(ids)) == 1
    with pytest.raises(ValueError):
        service.submit(task['token'], '改过的内容', 'same')


def test_validation_never_saves_invalid_task(tmp_path):
    service = Store(tmp_path)
    with pytest.raises(ValueError):
        service.create('测试', {'mode': 'numeric'})
    assert service.tasks() == []
    with pytest.raises(KeyError):
        service.task('unknown')


def test_http_roles_origin_and_complete_loop(tmp_path):
    app = create_app(tmp_path)
    owner, learner = TestClient(app), TestClient(app)
    assert owner.get('/api/manage').status_code == 403
    assert owner.post('/api/login', json={'token': {}}).status_code == 403
    assert owner.post('/api/login', json=[]).status_code == 400
    assert owner.post('/api/login', json={'token': app.state.store.owner_token}).status_code == 200
    task = owner.post('/api/tasks', json={'learner': '合成学习者', 'draft': text_activity()}).json()
    path = '/api/learn/' + task['token']
    assert learner.post('/api/tasks', json={'learner': '越权'}).status_code == 403
    assert owner.post('/api/tasks', headers={'Origin': 'https://wrong.invalid'}, json={'learner': '越权'}).status_code == 403
    submission = learner.post(path, json={'answer': '行动与观察', 'request_key': 'one'}).json()
    assert learner.post('/api/feedback/' + submission['id'], json={'comment': '越权', 'next_step': '越权'}).status_code == 403
    assert owner.post('/api/feedback/' + submission['id'], json={'comment': '补充具体观察。', 'next_step': '再做一次。'}).status_code == 200
    result = learner.get(path).json()
    assert result['submissions'][0]['evaluation']['next_step'] == '再做一次。'
    assert 'owner_token' not in json.dumps(result)
    assert learner.get('/learn/'+task['token']).status_code == 200
