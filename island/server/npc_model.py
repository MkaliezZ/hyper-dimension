from model_policy import DEEPSEEK_MODEL
import os,json,re,urllib.request,urllib.error,threading,time
from usage_audit import normalize
class ModelError(RuntimeError):
 def __init__(self,message,code="model_error"):
  super().__init__(message);self.code=code

def parse_model_reply(content,finish_reason):
 if finish_reason!="stop":raise ModelError("模型回复未完整结束","model_response_incomplete")
 if not isinstance(content,str):raise ModelError("模型回复格式无效","model_response_format")
 text=content.strip().lstrip("\ufeff").strip()
 # Accept only a complete object, optionally wrapped in one standard JSON fence.
 # Never extract braces from surrounding prose or attempt to repair truncated content.
 if text.startswith("```"):
  fenced=re.fullmatch(r"```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```",text,re.IGNORECASE)
  if not fenced:raise ModelError("模型回复格式无效","model_response_format")
  text=fenced.group(1).strip()
 def unique(pairs):
  result={}
  for key,value in pairs:
   if key in result:raise ValueError("duplicate key")
   result[key]=value
  return result
 def reject_constant(value):raise ValueError("non-finite constant")
 try:
  answer=json.loads(text,object_pairs_hook=unique,parse_constant=reject_constant)
  if not isinstance(answer,dict):raise ValueError("object required")
  return answer
 except (ValueError,TypeError):raise ModelError("模型回复格式无效","model_response_format") from None

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
  if not self.available:raise ModelError("尚未配置 DeepSeek","model_unconfigured")
  body={"model":self.model,"messages":[{"role":"system","content":system+" 输出一个 JSON 对象。"},{"role":"user","content":json.dumps(payload,ensure_ascii=False)}],"response_format":{"type":"json_object"},"max_tokens":max_tokens,"stream":False,"thinking":{"type":"disabled"}}
  req=urllib.request.Request(self.endpoint+"/chat/completions",json.dumps(body).encode(),headers={"Content-Type":"application/json","Authorization":"Bearer "+self.key})
  self.local.usage={'input':None,'output':None,'total':None,'knownTotal':0,'calls':1,'reportedCalls':0,'unknownCalls':1}
  try:
   with urllib.request.urlopen(req,timeout=45) as r:
    try:result=json.load(r)
    except (ValueError,TypeError):raise ModelError("模型服务回复格式无效","model_response_format") from None
  except ModelError:raise
  except urllib.error.HTTPError as e:raise ModelError("模型服务返回 HTTP "+str(e.code),"model_http_"+str(e.code)) from None
  except Exception as e:raise ModelError("模型暂时无法连接："+type(e).__name__,"model_connection") from None
  if not isinstance(result,dict):raise ModelError("模型服务回复格式无效","model_response_format")
  reported=normalize(result.get('usage'))
  self.local.usage={**(reported or {}),'knownTotal':reported['total'] if reported and reported['total'] is not None else 0,'calls':1,'reportedCalls':1 if reported and reported['total'] is not None else 0,'unknownCalls':0 if reported and reported['total'] is not None else 1}
  choices=result.get("choices")
  if not isinstance(choices,list) or not choices or not isinstance(choices[0],dict):raise ModelError("模型回复格式无效","model_response_format")
  choice=choices[0];message=choice.get("message")
  if not isinstance(message,dict):raise ModelError("模型回复格式无效","model_response_format")
  answer=parse_model_reply(message.get("content"),choice.get("finish_reason"))
  with self.lock:self.calls+=1;self.tokens+=self.local.usage.get('knownTotal',0);self.last_success=time.time()
  return answer
