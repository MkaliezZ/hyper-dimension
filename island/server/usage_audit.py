"""Per-client usage only. Never retains prompts, responses or keys."""
import threading
def number(value):
 return value if isinstance(value,int) and not isinstance(value,bool) and value>=0 else None
def normalize(value):
 if value is None:return None
 if hasattr(value,'model_dump'):value=value.model_dump()
 if not isinstance(value,dict):return None
 data={k:number(value.get(src)) for k,src in [('input','prompt_tokens'),('output','completion_tokens'),('total','total_tokens'),('cacheRead','prompt_cache_hit_tokens'),('uncachedInput','prompt_cache_miss_tokens')]}
 if data['total'] is None and data['input'] is not None and data['output'] is not None:data['total']=data['input']+data['output']
 if data['total'] is not None and data['input'] is not None and data['output'] is not None and data['total']!=data['input']+data['output']:data['total']=None
 return data
class MeteredStream:
 def __init__(self,stream,meter,row):self.stream=stream;self.meter=meter;self.row=row
 def __iter__(self):
  try:
   for chunk in self.stream:
    self.meter.accept(self.row,getattr(chunk,'usage',None));yield chunk
  finally:self.row['finished']=True
 def __getattr__(self,name):return getattr(self.stream,name)
 def __enter__(self):self.stream.__enter__();return self
 def __exit__(self,*args):self.row['finished']=True;return self.stream.__exit__(*args)
 def close(self):self.row['finished']=True;return self.stream.close()
class UsageMeter:
 def __init__(self):self.rows=[];self.lock=threading.RLock();self.client=None;self.clients=[]
 def accept(self,row,raw):
  value=normalize(raw)
  if value is not None:
   with self.lock:row['usage']=value
 def attach(self,client):
  with self.lock:
   if any(c is client for c in self.clients):return self
   self.clients.append(client);self.client=client
  endpoint=client.chat.completions;original=endpoint.create
  def create(*args,**kwargs):
   row={'usage':None,'finished':False}
   with self.lock:self.rows.append(row)
   try:
    result=original(*args,**kwargs)
    if kwargs.get('stream'):return MeteredStream(result,self,row)
    self.accept(row,getattr(result,'usage',None));row['finished']=True;return result
   except Exception:row['finished']=True;raise
  endpoint.create=create
  return self
 def snapshot(self):
  with self.lock:
   values=[r['usage'] for r in self.rows]
   known=[r for r in values if r is not None and r['total'] is not None]
   result={k:sum(r[k] for r in values) if values and all(r is not None and r[k] is not None for r in values) else None for k in ['input','output','total','cacheRead','uncachedInput']}
   result.update(calls=len(values),knownTotal=sum(r['total'] for r in known),reportedCalls=len(known),unknownCalls=len(values)-len(known))
   return result
 def close(self):
  for client in self.clients:
   try:client.close()
   except Exception:pass
def attach_usage_meter(agent):
 meter=UsageMeter()
 # Current Hermes uses private request clients (and may reuse their pool).
 # Hook the instance factory so streaming, retries and rebuilt clients all
 # contribute to this agent only; never wrap a shared primary client.
 request_factory=getattr(agent,'_create_request_openai_client',None)
 if callable(request_factory):
  def create_request(*args,**kwargs):
   client=request_factory(*args,**kwargs);meter.attach(client);return client
  agent._create_request_openai_client=create_request
 else:
  factory=getattr(agent,'_create_openai_client',None)
  if callable(factory):agent.client=factory(dict(agent._client_kwargs),reason='hyper_dimension_usage',shared=False)
  meter.attach(agent.client)
 agent._hd_usage_meter=meter
 return meter
