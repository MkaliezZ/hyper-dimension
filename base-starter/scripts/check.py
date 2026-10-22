import json
import tempfile
from base.core import Store
from base.app.activities import prepare_activity
with tempfile.TemporaryDirectory(prefix='base-check-') as folder:
    service = Store(folder)
    task = service.create('合成自检学习者')
    draft = prepare_activity()
    answer = str(draft['expected']) if draft['mode'] == 'numeric' else '先完成一个小任务，再记录反馈。'
    row = service.submit(task['token'], answer, 'self-check')
    service.feedback(row['id'], '目标明确，请增加观察指标。', '记录一次实际结果。')
    assert Store(folder).public_task(task['token'])['submissions'][0]['evaluation']['status'] == 'reviewed'
print(json.dumps({'ok': True, 'checks': ['创建活动', '提交', '人工反馈', '重启读取'], 'real_data_modified': False}, ensure_ascii=False))
