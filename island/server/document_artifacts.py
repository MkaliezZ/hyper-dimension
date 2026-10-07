"""Immutable snapshots of verified document saves, separate from the source file."""
import os,json,uuid,hashlib
from pathlib import Path
from datetime import datetime,timezone
def capture_saved(path,tool,changes,backup=None,expected_hash=None):
 root_raw=os.environ.get('HD_ARTIFACT_DIR')
 if not root_raw:return None
 if os.environ.get('HD_DOCUMENT_MODE')!='manual':raise RuntimeError('文档成果只能由手动委托产生')
 root=Path(root_raw).resolve();root.mkdir(parents=True,exist_ok=True)
 data=path.read_bytes()
 if expected_hash and hashlib.sha256(data).hexdigest()!=expected_hash:raise RuntimeError('回读后原文档已被更改，未登记为本次成果')
 if len(data)>25*1024*1024:raise ValueError('成果超过25MB')
 cid='capture-'+uuid.uuid4().hex;folder=root/'captures';folder.mkdir(exist_ok=True)
 target=folder/(cid+path.suffix.lower())
 with target.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 record={'schema':44,'id':cid,'sourcePath':str(path.resolve()),'name':path.name,'format':path.suffix.lower()[1:],
  'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'capturedAt':datetime.now(timezone.utc).isoformat(),
  'tool':tool,'changes':changes,'backupPath':backup,'theme':os.environ.get('HD_DOCUMENT_THEME') or None,
  'ledgerRunId':os.environ.get('HD_DOCUMENT_LEDGER_ID'),'providerRunId':os.environ.get('HD_DOCUMENT_RUN_ID'),
  'projectId':os.environ.get('HD_DOCUMENT_PROJECT_ID') or None,'mode':'manual'}
 temporary=folder/(cid+'.tmp')
 with temporary.open('x',encoding='utf-8') as f:json.dump(record,f,ensure_ascii=False);f.flush();os.fsync(f.fileno())
 os.replace(temporary,folder/(cid+'.json'))
 return {'id':cid,'sha256':record['sha256'],'bytes':record['bytes']}
