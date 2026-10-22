"""Run against an unpacked starter with its own installed virtual environment."""
import asyncio
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from uuid import uuid4
import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

root = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
prefix = uuid4().hex
python = root / '.venv/Scripts/python.exe'
env = {**os.environ, 'PYTHONPATH': str(root/'src'), 'PYTHONUTF8': '1', 'BASE_DATA': str(root/'data/base')}
evidence = {'kind': 'same-agent clean-copy engineering reproduction; not an independent student pilot', 'checks': []}


def passed(name):
    evidence['checks'].append(name)


@contextmanager
def running():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    with (root/'probe-server.log').open('a', encoding='utf-8') as log:
        process = subprocess.Popen([str(python), '-m', 'base', '--port', str(port)], cwd=root, env=env, stdout=log, stderr=log)
        url = f'http://127.0.0.1:{port}'
        try:
            for _ in range(100):
                if process.poll() is not None:
                    raise RuntimeError('服务退出，请看probe-server.log')
                try:
                    if httpx.get(url+'/healthz', timeout=.5).status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(.1)
            else:
                raise RuntimeError('服务启动超时')
            with httpx.Client(base_url=url) as client:
                assert client.post('/api/login', json={'token': (root/'data/base/owner-token.txt').read_text()}).status_code == 200
                yield client, url
        finally:
            process.terminate()
            process.wait(timeout=10)


def post(client, path, body):
    response = client.post(path, json=body)
    assert response.status_code == 200, response.text
    return response.json()


start = time.monotonic()
subprocess.run([str(python), 'scripts/check.py'], cwd=root, env=env, check=True)
passed('packaged self-check with temporary data')
hashes = {str(f.relative_to(root)): hashlib.sha256(f.read_bytes()).hexdigest() for f in (root/'src/base').glob('*.py')}
with running() as (client, url):
    baseline = len(client.get('/api/manage').json()['tasks'])
    first = post(client, '/api/tasks', {'learner': '合成同名学习者', 'request_key': prefix+'first'})
    second = post(client, '/api/tasks', {'learner': '合成同名学习者', 'request_key': prefix+'second'})
    assert first['learner_id'] != second['learner_id']
    assert post(client, '/api/tasks', {'learner': '合成同名学习者', 'request_key': prefix+'first'})['id'] == first['id']
    row = post(client, '/api/learn/'+first['token'], {'answer': '今天试做一个交接清单，记录接手者的问题。', 'request_key': 'one'})
    post(client, '/api/feedback/'+row['id'], {'comment': '行动具体，请加上记录时间。', 'next_step': '明天执行后记录结果。'})
    assert client.get('/api/learn/'+first['token']).json()['submissions'][0]['evaluation']['status'] == 'reviewed'
    assert not client.get('/api/learn/'+second['token']).json()['submissions']
passed('real HTTP default activity -> submission -> manual feedback -> next step; same-name isolation and create retry')

# Follow the guide: edit only app files, restart, create a new link.
config_path = root/'src/base/app/config.json'
config = json.loads((root/'examples/numeric/config.json').read_text(encoding='utf-8'))
config.update(name='我的分数换算伴学', activity_title='用小数表达一半')
config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding='utf-8')
(root/'src/base/app/knowledge/material.txt').write_text('把一个整体分为相等的两份，一份可写成二分之一。请换一种数值表示。', encoding='utf-8')
(root/'src/base/app/prompts/activity.txt').write_text('围绕分数与小数的等值关系设计原创练习，避免引入未经实现的单位换算。', encoding='utf-8')
with running() as (client, url):
    task = post(client, '/api/tasks', {'learner': '合成改版学习者', 'request_key': prefix+'numeric'})
    result = post(client, '/api/learn/'+task['token'], {'answer': '0.5', 'request_key': 'answer'})
    assert result['evaluation']['correct'] is True
    public = client.get('/api/learn/'+task['token']).json()
    assert public['activity']['name'] == '我的分数换算伴学' and 'expected' not in public['activity']
    old = client.get('/api/learn/'+first['token']).json()
    assert old['activity']['mode'] == 'text' and old['submissions'][0]['evaluation']['next_step'] == '明天执行后记录结果。'
passed('customized numeric companion using config/material/prompt edits only; core unchanged; old records survive restart')


async def mcp_probe():
    params = StdioServerParameters(command=str(python), args=['-m', 'base.mcp'], cwd=str(root), env=env)
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            listed = await session.list_tools()
            assert len(listed.tools) == 5
            async def call(name, arguments):
                result = await session.call_tool(name, arguments)
                assert not result.isError, result
                return result.structuredContent or json.loads(result.content[0].text)
            context = await call('get_context', {})
            assert (await call('check_activity', {'draft': {'mode': 'invalid'}}))['valid'] is False
            project = json.loads((root/'examples/project/config.json').read_text(encoding='utf-8'))
            project['material'] = (root/'examples/project/material.txt').read_text(encoding='utf-8')
            assert (await call('check_activity', {'draft': project}))['valid']
            task = await call('create_activity', {'learner': '合成项目学习者', 'draft': project, 'request_key': prefix+'mcp-project'})
            with running() as (client, url):
                submitted = post(client, '/api/learn/'+task['token'], {'answer': '现状：初稿完成。待办：同伴试用。验收：同伴能独立接手。', 'request_key': 'project-submit'})
                await call('record_feedback', {'submission_id': submitted['id'], 'comment': '补充交接截止时间。', 'next_step': '邀请同伴试用并修订。'})
                assert client.get('/api/learn/'+task['token']).json()['submissions'][0]['evaluation']['status'] == 'reviewed'
            assert len((await call('list_records', {}))['tasks']) == baseline+4
asyncio.run(mcp_probe())
passed('actual MCP stdio initialize/list/check/create/read/feedback; adult project no grade, exam or total score')
assert hashes == {p: hashlib.sha256((root/p).read_bytes()).hexdigest() for p in hashes}
subprocess.run([str(python), '-m', 'pytest', 'tests/test_base.py', '-q', '-p', 'no:cacheprovider'], cwd=root, env=env, check=True)
passed('unpacked source regression suite')
archive = root/('private-backup-'+prefix+'.zip')
restore = root/('restored-'+prefix)
subprocess.run([str(python), 'scripts/backup.py', 'backup', str(archive)], cwd=root, check=True)
subprocess.run([str(python), 'scripts/backup.py', 'restore', str(archive), str(restore)], cwd=root, check=True)
assert (restore/'data/base/base.sqlite3').read_bytes() == (root/'data/base/base.sqlite3').read_bytes()
assert (restore/'app/config.json').read_bytes() == config_path.read_bytes()
passed('stopped-service backup and empty-directory restore: database and app match')
evidence.update(seconds=round(time.monotonic()-start,2), core_unchanged=True, independent_student_pilot=False, real_model_generation=False, public_network=False, private_tokens_excluded=True)
output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(evidence, ensure_ascii=False))
