"""Preflight explicit manual queues; the saved planning transaction remains authoritative."""
import re

LIVE = {'queued', 'running', 'waiting', 'paused'}
TASK_ID = re.compile(r'[-\w:.]{1,110}', re.ASCII)


def validate_dispatch_order(args, current, proposed, manual):
    dependencies = args.get('dependsOn', [])
    if (not isinstance(dependencies, list) or len(dependencies) > 20
            or any(not isinstance(i, str) or not TASK_ID.fullmatch(i) for i in dependencies)):
        return {'ok': False, 'error': '前置分工编号无效'}
    dependencies = list(dict.fromkeys(dependencies))
    if dependencies and not manual:
        return {'ok': False, 'error': '自动巡查不能追加顺序任务；请等待现有分工完成'}
    rows = {t['id']: t for t in current.get('taskBoard', [])
            if isinstance(t, dict) and isinstance(t.get('id'), str)}
    rows.update({t['id']: {**t, 'status': 'queued'} for t in proposed})
    if any(i not in rows for i in dependencies):
        return {'ok': False, 'error': '请从观察到的任务或本轮工具返回的编号选择前置分工'}
    npc_id = args.get('npcId', 15)
    active = [t for t in rows.values() if t.get('npcId') == npc_id and t.get('status') in LIVE]
    assignment = next((r.get('assignment') for r in current.get('residents', [])
                       if r.get('id') == npc_id and r.get('assignment')), None)
    if assignment and (not isinstance(assignment, dict) or assignment.get('id') not in rows):
        return {'ok': False, 'error': '居民已有分工，请重新观察完整任务后再安排'}
    if active and not manual:
        return {'ok': False, 'error': '居民已有分工'}
    if len(active) >= 4:
        return {'ok': False, 'error': '每位居民最多保留四项未完成分工'}
    ancestors = set()

    def visit(task_id, path):
        if task_id in path or len(path) >= 64:
            return False
        if task_id in ancestors:
            return True
        if not all(visit(i, path | {task_id}) for i in rows.get(task_id, {}).get('dependsOn') or []):
            return False
        ancestors.add(task_id)
        return True

    if not all(visit(i, set()) for i in dependencies):
        return {'ok': False, 'error': '前置分工存在循环或过长，请先整理原任务'}
    if any(t['id'] not in ancestors for t in active):
        return {'ok': False, 'error': '居民已有分工；顺序追加须等待其全部现有任务，使用最后一步的编号'}
    return {'ok': True, 'dependsOn': dependencies}
