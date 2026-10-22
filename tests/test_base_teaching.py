"""Generic educational contracts, evidence semantics and backward compatibility."""
import hashlib
import json
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from base.app.activities import prepare_activity
from base.app.profile import validate_profile
from base.core import Store
from base.teaching import check_activity, teaching_rules
from base.web import create_app


def test_profiles_reuse_stable_identity_and_isolate_same_names(tmp_path):
    s = Store(tmp_path)
    a = s.save_learner('小林', {'goal': '能解释过程'}, request_key='profile-one')
    assert s.save_learner('小林', {'goal': '能解释过程'}, request_key='profile-one')['id'] == a['id']
    b = s.save_learner('小林')
    assert a['id'] != b['id']
    first = s.create(a['name'], learner_id=a['id'])
    second = s.create(a['name'], learner_id=a['id'])
    other = s.create(b['name'], learner_id=b['id'])
    s.submit(first['token'], '观察记录', 'one')
    assert first['learner_id'] == second['learner_id'] == a['id']
    assert s.growth(a['id'])['encountered'] == 2
    assert s.growth(b['id'])['completed'] == 0
    assert not s.public_task(other['token'])['submissions']
    with pytest.raises(ValueError):
        s.create('另一个名字', learner_id=a['id'])
    with pytest.raises(ValueError):
        s.save_learner('小林', {'goal': '变化'}, request_key='profile-one')
    with pytest.raises(KeyError):
        Store(tmp_path / 'separate').create('小林', learner_id=a['id'])
    assert Store(tmp_path).instance_id == s.instance_id


def test_profile_schema_is_strict_and_subject_extension_has_clear_boundary():
    assert validate_profile({})['goal'] == ''
    for invalid in ({'age': 18}, {'goal': True}, {'resources': [1]}, {'extensions': {'subject_only': 'x'}}, {'resources': ['']}):
        with pytest.raises(ValueError):
            validate_profile(invalid)
    assert 'extensions' in __import__('base.app.profile', fromlist=['LearningProfile']).LearningProfile.model_json_schema()['properties']


def test_additive_migration_preserves_old_links_and_identity(tmp_path):
    db = sqlite3.connect(tmp_path / 'base.sqlite3')
    db.executescript('''
    CREATE TABLE tasks(id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, learner TEXT NOT NULL, token TEXT UNIQUE NOT NULL, snapshot TEXT NOT NULL, created TEXT NOT NULL);
    ''')
    draft = prepare_activity()
    db.execute('INSERT INTO tasks VALUES (?,?,?,?,?,?)', ('old-task', 'old-person', '历史称呼', 'old-link', json.dumps(draft), '2026-01-01'))
    db.commit()
    db.close()
    s = Store(tmp_path)
    assert s.public_task('old-link')['state'] == 'active'
    assert s.learner('old-person')['name'] == '历史称呼'
    assert s.create('历史称呼', learner_id='old-person')['learner_id'] == 'old-person'
    assert len(Store(tmp_path).learners()) == 1


def test_teaching_checks_warn_without_claiming_semantic_quality():
    draft = prepare_activity()
    review = check_activity(draft)
    assert review['valid'] and review['semantic_quality_verified'] is False
    assert draft['goal'] and draft['deliverable'] and draft['sources'][0]['sha256']
    old = {k: v for k,v in draft.items() if k not in ('goal', 'deliverable', 'sources')}
    assert len(check_activity(old)['warnings']) == 3
    for change in ({'goal': ''}, {'sources': [{}]}, {'sources': [{'title':'x','locator':'p1','version':'1','extraction_status':'readable','verification_status':'verified'}]}):
        with pytest.raises(ValueError):
            check_activity(draft | change)
    assert teaching_rules()['roles']['maintainer']


def test_material_change_invalidates_old_verification_and_hides_private_refs(tmp_path, monkeypatch):
    from base.app import activities
    folder = tmp_path/'app'
    shutil.copytree(activities.ROOT, folder, ignore=shutil.ignore_patterns('__pycache__'))
    config = json.loads((folder/'config.json').read_text(encoding='utf-8-sig'))
    config['sources'][0].update(sha256=hashlib.sha256((folder/'knowledge/material.txt').read_bytes()).hexdigest(), verification_status='verified', verified_by='合成核验者', verified_at='2026-10-23')
    (folder/'config.json').write_text(json.dumps(config), encoding='utf-8')
    monkeypatch.setattr(activities, 'ROOT', folder)
    assert activities.prepare_activity()['sources'][0]['verification_status'] == 'verified'
    (folder/'knowledge/material.txt').write_text('已替换的资料', encoding='utf-8')
    draft = activities.prepare_activity()
    assert draft['sources'][0]['verification_status'] == 'unverified'
    s = Store(tmp_path/'data')
    task = s.create('合成', draft)
    public = s.public_task(task['token'])['activity']['sources'][0]
    assert 'file' not in public and 'sha256' not in public and 'verified_by' not in public


def test_paused_and_archived_are_enforced_without_losing_receipts(tmp_path):
    s = Store(tmp_path)
    task = s.create('合成', request_key='task')
    row = s.submit(task['token'], '初稿', 'first')
    s.set_state(task['id'], 'paused')
    assert s.submit(task['token'], '初稿', 'first')['id'] == row['id']
    with pytest.raises(ValueError):
        s.submit(task['token'], '新稿', 'second')
    s.set_state(task['id'], 'active')
    assert s.submit(task['token'], '新稿', 'second')['id'] != row['id']
    s.set_state(task['id'], 'archived')
    assert s.create('合成', request_key='task')['task_version'] == task['task_version']
    assert s.public_task(task['token'])['state'] == 'archived'
    with pytest.raises(ValueError):
        s.feedback(row['id'], '反馈', '下一步')
    with pytest.raises(ValueError):
        s.set_state(task['id'], 'active')
    assert s.next_plan(task['learner_id'])['action'] == 'new_activity'


def test_feedback_retries_versions_and_evidence_do_not_imply_mastery(tmp_path):
    s = Store(tmp_path)
    task = s.create('合成')
    learner_id = task['learner_id']
    row = s.submit(task['token'], '完成格式但不代表达标', 'one')
    g = s.growth(learner_id)
    assert g['completed'] == 1 and g['meets_criteria'] == g['independent_transfer'] == 0
    result = s.feedback(row['id'], '有作品依据的具体反馈', '下一步', judgement='needs_revision', request_key='feedback')
    assert s.feedback(row['id'], '有作品依据的具体反馈', '下一步', judgement='needs_revision', request_key='feedback') == result
    assert result['reviewer_id'].startswith(s.instance_id) and result['evaluation_version'] == '1'
    with s.db() as db:
        assert db.execute('SELECT count(*) FROM reviews').fetchone()[0] == 1
    with pytest.raises(ValueError):
        s.feedback(row['id'], '不同内容', '下一步', request_key='feedback')
    assert s.next_plan(learner_id)['action'] == 'revise'
    with pytest.raises(ValueError):
        s.verify_transfer(row['id'], '新情境', True)
    s.feedback(row['id'], '依据充分，本次作品达标', '换情境', judgement='meets_criteria')
    assert s.next_plan(learner_id)['action'] == 'transfer'
    with pytest.raises(ValueError):
        s.verify_transfer(row['id'], '新情境', False)
    s.verify_transfer(row['id'], '另一项真实任务；维护者观察确认未给予提示', True)
    assert s.growth(learner_id)['independent_transfer'] == 1
    # Correction invalidates the corresponding current transfer count; history remains.
    s.feedback(row['id'], '复核发现依据不足', '补充依据', judgement='needs_revision')
    assert s.growth(learner_id)['independent_transfer'] == 0
    revised = s.submit(task['token'], '修订稿', 'two')
    assert s.growth(learner_id)['pending_submissions'] == 1
    assert s.growth(learner_id)['needs_revision'] == 0
    assert len(Store(tmp_path).public_task(task['token'])['submissions']) == 2
    assert revised['evaluation']['status'] == 'pending'
    assert not any('token' in json.dumps(e) or '初稿' in json.dumps(e) for e in s.growth(learner_id)['events'])


def test_new_web_services_require_maintainer_and_share_business_rules(tmp_path):
    app = create_app(tmp_path)
    owner, learner = TestClient(app), TestClient(app)
    for route, body in [('/api/learners', {'name':'越权'}), ('/api/tasks/unknown/state', {'state':'archived'}), ('/api/transfer/unknown', {'context':'x','independent':True})]:
        assert learner.post(route, json=body).status_code == 403
    assert learner.get('/api/growth/unknown').status_code == 403
    owner.post('/api/login', json={'token':app.state.store.owner_token})
    assert owner.post('/api/learners', content='bad json').status_code == 400
    assert owner.post('/api/learners', json={'name':'合成', 'profile':{'extensions':{'unconfigured':1}}}).status_code == 400
    p = owner.post('/api/learners', json={'name':'合成', 'profile':{'goal':'能解释'}, 'request_key':'person'}).json()
    task = owner.post('/api/tasks', json={'learner':p['name'], 'learner_id':p['id']}).json()
    route = '/api/learn/'+task['token']
    row = learner.post(route, json={'answer':'证据与观察', 'request_key':'one'}).json()
    owner.post('/api/feedback/'+row['id'], json={'comment':'证据充分', 'next_step':'新情境复做', 'judgement':'meets_criteria', 'request_key':'feedback'})
    assert owner.get('/api/growth/'+p['id']).json()['growth']['meets_criteria'] == 1
    owner.post('/api/transfer/'+row['id'], json={'context':'另一任务且观察确认独立完成', 'independent':True})
    assert owner.get('/api/growth/'+p['id']).json()['growth']['independent_transfer'] == 1
    assert 'profile' not in json.dumps(learner.get(route).json())
    owner.post('/api/tasks/'+task['id']+'/state', json={'state':'paused'})
    assert learner.post(route, json={'answer':'修订', 'request_key':'two'}).status_code == 400
    manage = owner.get('/api/manage').json()
    assert manage['teaching']['principles'] and manage['check']['semantic_quality_verified'] is False


def test_configure_script_validates_before_replacing_and_keeps_backup(tmp_path):
    root = Path(__file__).resolve().parents[1]
    shutil.copytree(root/'src/base', tmp_path/'src/base', ignore=shutil.ignore_patterns('__pycache__'))
    (tmp_path/'scripts').mkdir()
    helper = root/'base-starter/scripts/configure.py'
    shutil.copy(helper if helper.exists() else root/'scripts/configure.py', tmp_path/'scripts/configure.py')
    config = tmp_path/'src/base/app/config.json'
    original = config.read_bytes()
    result = subprocess.run([sys.executable, str(tmp_path/'scripts/configure.py'), '--name', '自定义伴学'], capture_output=True)
    assert result.returncode == 0
    assert json.loads(config.read_text(encoding='utf-8'))['name'] == '自定义伴学'
    backups = list(config.parent.glob('config.*.bak'))
    assert len(backups) == 1 and backups[0].read_bytes() == original
    valid = config.read_bytes()
    result = subprocess.run([sys.executable, str(tmp_path/'scripts/configure.py'), '--goal', ''], capture_output=True)
    assert result.returncode != 0 and config.read_bytes() == valid
    assert len(list(config.parent.glob('config.*.bak'))) == 1
