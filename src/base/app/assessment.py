"""Domain rules live here; the storage and access layer never knows the subject."""
from fractions import Fraction
import re


def number(value):
    text = str(value).strip()
    if len(text) > 64 or not re.fullmatch(r'[+-]?(?:\d+(?:\.\d+)?|\d+/[1-9]\d*)', text):
        raise ValueError('请输入整数、小数或分数，例如 0.5 或 1/2')
    return Fraction(text)


def validate_activity(draft):
    if not isinstance(draft, dict):
        raise ValueError('活动必须是一个对象')
    for field in ('name', 'activity_title', 'instructions', 'criteria', 'next_step', 'material'):
        if not isinstance(draft.get(field), str) or not draft[field].strip() or len(draft[field]) > 20000:
            raise ValueError(f'{field}：请填写非空文字，最长20000字')
    if draft.get('mode') not in ('text', 'numeric'):
        raise ValueError('mode：请选择 text 或 numeric')
    if draft['mode'] == 'numeric':
        number(draft.get('expected', ''))
    return draft


def evaluate_submission(activity, answer):
    if activity['mode'] == 'text':
        return {'status': 'pending', 'comment': '已收到，等待维护者依据活动要求反馈。', 'next_step': '收到反馈后可修订并再次提交。', 'correct': None}
    correct = number(answer) == number(activity['expected'])
    return {'status': 'reviewed', 'correct': correct, 'comment': '数值等值，符合要求。' if correct else '数值暂不相符，请重新检查计算。', 'next_step': activity['next_step']}
