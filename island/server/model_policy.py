import json
from pathlib import Path
POLICY=json.loads(Path(__file__).with_name('model-policy.json').read_text(encoding='utf-8'))
if POLICY['apiModel']!='deepseek-flash' or POLICY['allowAutomaticModelFallback'] is not False:
 raise RuntimeError('Island NPC models must use DeepSeek V4.1 Flash without automatic model fallback')
DEEPSEEK_MODEL=POLICY['apiModel']
DEEPSEEK_MODEL_LABEL=POLICY['label']
