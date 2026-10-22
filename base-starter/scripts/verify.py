"""Business HTTP acceptance: isolated data, real start.ps1, no MCP or model."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from uuid import uuid4
import httpx

ROOT = Path(__file__).resolve().parents[1]


def run():
    fixture = json.loads((ROOT/'src/base/app/acceptance.json').read_text(encoding='utf-8-sig'))
    run_id = uuid4().hex[:12]
    data = ROOT/'data/verify'/run_id
    data.mkdir(parents=True)
    env = {**os.environ, 'PYTHONPATH': str(ROOT/'src'), 'PYTHONUTF8': '1'}
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    command = ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(ROOT/'scripts/start.ps1'), '-Port', str(port), '-DataPath', str(data)]
    checks = []
    def check(value, label):
        if not value:
            raise ValueError(label)
        checks.append(label)
    def request(client, method, route, body=None):
        response = client.request(method, route, json=body) if body is not None else client.request(method, route)
        if response.status_code != 200:
            raise ValueError('HTTP请求未成功，状态：'+str(response.status_code))
        return response.json()
    started = time.monotonic()
    with (data/'server.log').open('w', encoding='utf-8') as log:
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=log)
        try:
            url = f'http://127.0.0.1:{port}'
            with httpx.Client(base_url=url, trust_env=False, timeout=5) as owner, httpx.Client(base_url=url, trust_env=False, timeout=5) as learner:
                for _ in range(150):
                    if process.poll() is not None:
                        raise ValueError('启动退出，请查看本次隔离目录server.log')
                    try:
                        if owner.get('/healthz').status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    time.sleep(.1)
                else:
                    raise ValueError('启动超时')
                check(True, '通过start.ps1启动真实服务，独立端口与数据目录')
                check(owner.get('/').status_code == 200, '维护者页面可访问（非浏览器点击验证）')
                request(owner, 'POST', '/api/login', {'token': (data/'owner-token.txt').read_text(encoding='utf-8')})
                preview = request(owner, 'GET', '/api/manage')['preview']
                check(preview['mode'] == fixture['mode'], '验收样例与当前业务mode对应')
                task = request(owner, 'POST', '/api/tasks', {'learner': '合成业务验收学习者', 'request_key': run_id})
                check(request(owner, 'POST', '/api/tasks', {'learner': '合成业务验收学习者', 'request_key': run_id})['id'] == task['id'], '创建重试不重复')
                route = '/api/learn/'+task['token']
                public = request(learner, 'GET', route)
                check(learner.get('/learn/'+task['token']).status_code == 200, '学习者页面可访问（非浏览器点击验证）')
                check(all(public['activity'][k] == preview[k] for k in ('name','material','instructions','criteria','next_step')), '发布内容与修改后的配置资料一致')
                row = request(learner, 'POST', route, {'answer': fixture['answer'], 'request_key': 'sample'})
                evaluation = row['evaluation']
                for field in ('status','correct'):
                    if 'expected_'+field in fixture:
                        check(evaluation.get(field) == fixture['expected_'+field], '业务样例评价：'+field)
                check(fixture.get('expected_comment_contains','') in evaluation['comment'], '业务反馈包含样例预期')
                check(request(learner, 'POST', route, {'answer': fixture['answer'], 'request_key': 'sample'})['id'] == row['id'], '提交重试不重复')
                check(learner.get('/api/manage').status_code == 403, '学习者不能读取管理资料')
                feedback = {'comment': '合成验收反馈：请补充具体观察。', 'next_step': '修订后再提交一次。'}
                rubric = public['activity'].get('rubric', [])
                if rubric:
                    feedback['scores'] = [{'label': r['label'], 'score': r['max_score']} for r in rubric]
                request(owner, 'POST', '/api/feedback/'+row['id'], feedback)
                result = request(learner, 'GET', route)['submissions'][0]['evaluation']
                check(result['status']=='reviewed' and result['next_step']==feedback['next_step'], '维护者反馈与下一步可读取')
                if rubric:
                    check(result['total']==sum(r['max_score'] for r in rubric), '分项得分与服务端汇总')
                other = request(owner, 'POST', '/api/tasks', {'learner': '合成业务验收学习者'})
                check(not request(learner, 'GET', '/api/learn/'+other['token'])['submissions'], '同名学习链接隔离')
        finally:
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    process.terminate()
            process.wait(timeout=10)
    # Restart persistence independently from UI; only count/feedback, never print credentials.
    sys.path.insert(0, str(ROOT/'src'))
    from base.core import Store
    check(Store(data).submissions()[0]['evaluation']['status']=='reviewed', '停止后重新读取持久化反馈')
    with socket.socket() as sock:
        check(sock.connect_ex(('127.0.0.1',port)) != 0, '已停止自身服务，不遗留监听')
    report = {'ok':True, 'scope':'business-example-and-real-http', 'checks':checks, 'seconds':round(time.monotonic()-started,3), 'mcp_used':False,'model_used':False,'teaching_quality_verified':False,'ui_clicks_verified':False,'cross_instance_http_verified':False,'scoring_note':'量规满分是合成字段/汇总/保存测试，不代表教学评分质量','data_dir':str(data.relative_to(ROOT))}
    (data/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        # Never print request URLs, bodies, cookies, tokens, or an httpx traceback.
        message = str(error) if isinstance(error, ValueError) else type(error).__name__
        print(json.dumps({'ok':False,'error':message,'hint':'检查app/acceptance.json与业务内容；运行check.ps1可单独检查管线'},ensure_ascii=False))
        sys.exit(1)

