"""Edit config/material/prompts first; change this function for a new workflow."""
import json
from pathlib import Path

ROOT = Path(__file__).parent


def prepare_activity():
    try:
        config = json.loads((ROOT / 'config.json').read_text(encoding='utf-8-sig'))
    except (ValueError, OSError) as error:
        raise ValueError(f'app/config.json 无法读取，请检查文件和JSON格式：{error}') from error
    if not isinstance(config, dict):
        raise ValueError('app/config.json：顶层必须是对象')
    try:
        config['material'] = (ROOT / 'knowledge' / 'material.txt').read_text(encoding='utf-8-sig')
    except OSError as error:
        raise ValueError(f'app/knowledge/material.txt 无法读取：{error}') from error
    return config


def generation_context():
    return {'activity': prepare_activity(), 'prompt': (ROOT / 'prompts' / 'activity.txt').read_text(encoding='utf-8-sig')}
