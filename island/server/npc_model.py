from model_policy import DEEPSEEK_MODEL
import os,json,urllib.request,urllib.error,threading,time
from usage_audit import normalize
class ModelError(RuntimeError):pass
class ResidentModel:
 def __init__(self):
  self.key=os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("HD_MODEL_KEY","")
  self.endpoint=os.environ.get("HD_MODEL_ENDPOINT","https://api.deepseek.com").rstrip("/")
  self.model=DEEPSEEK_MODEL
  self.calls=0;self.tokens=0;self.last_success=0;self.lock=threading.Lock();self.local=threading.local()
 @property
 def available(self):return bool(self.key)
 def current_usage(self):return getattr(self.local,'usage',None)
 def complete(self,system,payload,max_tokens=1200):
  self.local.usage=None
  if not self.available:raise ModelError("尚未配置 DeepSeek")
  body={"model":self.model,"messages":[{"role":"system","content":system+" 输出一个 JSON 对象。"},{"role":"user","content":json.dumps(payload,ensure_ascii=False)}],"response_format":{"type":"json_object"},"max_tokens":max_tokens,"stream":False,"thinking":{"type":"disabled"}}
  req=urllib.request.Request(self.endpoint+"/chat/completions",json.dumps(body).encode(),headers={"Content-Type":"application/json","Authorization":"Bearer "+self.key})
  self.local.usage={'input':None,'output':None,'total':None,'knownTotal':0,'calls':1,'reportedCalls':0,'unknownCalls':1}
  try:
   with urllib.request.urlopen(req,timeout=45) as r:result=json.load(r)
  except urllib.error.HTTPError as e:raise ModelError("模型服务返回 HTTP "+str(e.code)) from None
  except Exception as e:raise ModelError("模型暂时无法连接："+type(e).__name__) from None
  reported=normalize(result.get('usage'))
  self.local.usage={**(reported or {}),'knownTotal':reported['total'] if reported and reported['total'] is not None else 0,'calls':1,'reportedCalls':1 if reported and reported['total'] is not None else 0,'unknownCalls':0 if reported and reported['total'] is not None else 1}
  choice=result.get("choices",[{}])[0]
  if choice.get("finish_reason")!="stop":raise ModelError("模型回复未完整结束")
  try:
   answer=json.loads(choice["message"]["content"])
   if not isinstance(answer,dict):raise ValueError()
  except (ValueError,KeyError,TypeError):raise ModelError("模型回复格式无效") from None
  with self.lock:self.calls+=1;self.tokens+=self.local.usage.get('knownTotal',0);self.last_success=time.time()
  return answer
