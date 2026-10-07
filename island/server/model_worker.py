import sys,json,threading
from npc_model import ResidentModel
model=ResidentModel();lock=threading.Lock()
def run(packet):
 try:
  answer=model.complete(packet['system'],packet['payload'],packet.get('maxTokens',1800))
  result={'id':packet['id'],'answer':answer,'usage':model.current_usage(),'metrics':{'calls':model.calls,'tokens':model.tokens,'lastSuccess':model.last_success,'model':model.model}}
 except Exception as e:result={'id':packet.get('id'),'error':str(e)[:180],'usage':model.current_usage()}
 with lock:print(json.dumps(result,ensure_ascii=False),flush=True)
for line in sys.stdin:
 try:packet=json.loads(line);threading.Thread(target=run,args=(packet,),daemon=True).start()
 except ValueError:pass
