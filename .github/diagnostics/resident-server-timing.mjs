import {AsyncLocalStorage,createHook} from 'node:async_hooks';import {Session} from 'node:inspector';import {performance,monitorEventLoopDelay} from 'node:perf_hooks';import {writeFile,rename,mkdir} from 'node:fs/promises';import {join} from 'node:path';
export async function observeOwnedServer(service,out,{liveIntervalMs=5000,profileChunkMs=15000}={}){
 await mkdir(out,{recursive:true});
 const requests=new AsyncLocalStorage(),http=[],calls=[],slowFs=[],loops=[],wired=new WeakSet(),pendingFs=new Map();let id=0,lastUtil=performance.eventLoopUtilization();
 const hook=createHook({init(id,type){if(type==='FSREQPROMISE'||type==='FSREQCALLBACK')pendingFs.set(id,{type,start:performance.now()});},before(id){const f=pendingFs.get(id);if(!f)return;const ms=performance.now()-f.start;if(ms>=80)slowFs.push({at:Date.now(),type:f.type,ms});pendingFs.delete(id);},destroy(id){pendingFs.delete(id);}});hook.enable();
 const delay=monitorEventLoopDelay({resolution:10});delay.enable();const timer=setInterval(()=>{const util=performance.eventLoopUtilization(lastUtil);lastUtil=performance.eventLoopUtilization();loops.push({at:Date.now(),utilization:util.utilization,meanMs:delay.mean/1e6,p99Ms:delay.percentile(99)/1e6,maxMs:delay.max/1e6});delay.reset();},500);
 const session=new Session();session.connect();const command=(name,args={})=>new Promise((resolve,reject)=>session.post(name,args,(error,result)=>error?reject(error):resolve(result)));await command('Profiler.enable');await command('Profiler.setSamplingInterval',{interval:1000});await command('Profiler.start');
 const errors=[],profiles=[];let closing=false,finishFlight=null,chain=Promise.resolve(),serial=0;
 const report=()=>({scope:'Read-only owned fixture HTTP/store/FS/event-loop timing and actual Node CPU samples. No bodies,cookies,keys,real documents or game state edits. Controlled diagnostic,not performance or human acceptance.',http,calls,slowFs,loops,profiles,errors,wholeGoalComplete:false});
 const enqueue=task=>{const operation=chain.then(task);chain=operation.catch(error=>{errors.push({operation:'persist-diagnostic',code:error.code||null,name:error.name});});return operation;};
 const live=()=>enqueue(async()=>{const path=join(out,'backend-progress.json');await writeFile(path+'.tmp',JSON.stringify(report()));await rename(path+'.tmp',path);});
 const rotate=restart=>enqueue(async()=>{const {profile}=await command('Profiler.stop');const name='server-cpu-'+String(++serial).padStart(3,'0')+'.cpuprofile';await writeFile(join(out,name),JSON.stringify(profile));profiles.push(name);if(restart)await command('Profiler.start');});
 const liveTimer=setInterval(()=>{if(!closing)live().catch(()=>{});},liveIntervalMs),profileTimer=setInterval(()=>{if(!closing)rotate(true).catch(()=>{});},profileChunkMs);
 const restorers=[];
 const handlers=service.server.listeners('request');service.server.removeAllListeners('request');const observedRequest=(req,res)=>{
  const path=new URL(req.url,'http://owned').pathname;if(!path.startsWith('/api/saves/')&&!['/api/lan/view','/api/lan/action','/api/lan/me'].includes(path)){for(const handler of handlers)handler.call(service.server,req,res);return;}
  const row={id:++id,path,method:req.method,receivedAt:Date.now()};http.push(row);const originalEnd=res.end;
  res.end=function(...args){row.endCalledAt=Date.now();row.status=res.statusCode;return originalEnd.apply(this,args);};
  res.on('finish',()=>{row.finishedAt=Date.now();row.status=res.statusCode;});res.on('close',()=>{row.closedAt=Date.now();row.finishedBeforeClose=res.writableFinished;});
  requests.run(row,()=>{for(const handler of handlers)handler.call(service.server,req,res);});
 };service.server.on('request',observedRequest);
 const get=service.tenants.get;const observedGet=async function(...args){const tenant=await get.apply(this,args),store=tenant?.saves;if(!store||wired.has(store))return tenant;wired.add(store);
  for(const name of ['current','open','openClient','save','action']){const original=store[name];if(typeof original!=='function')continue;const observed=async function(...args){const req=requests.getStore(),input=args[1],row={httpId:req?.id??null,operation:name,theme:args[0],startedAt:Date.now()};if(name==='action')row.input={kind:input?.kind,operation:input?.operation,requestId:input?.requestId,actor:input?.actor,actorId:input?.actorId,index:input?.index,sequence:input?.sequence};calls.push(row);
   try{const result=await original.apply(this,args);row.replayed=result?.replayed===true;row.outcome=result?.receipt?.outcome;row.ticketId=result?.ticket?.requestId;return result;}catch(error){row.error={code:error.code,status:error.status,name:error.name};throw error;}finally{row.finishedAt=Date.now();row.elapsedMs=row.finishedAt-row.startedAt;}
  };store[name]=observed;restorers.push(()=>{if(store[name]===observed)store[name]=original;});}return tenant;};service.tenants.get=observedGet;
 return{finish(){if(finishFlight)return finishFlight;closing=true;clearInterval(timer);clearInterval(liveTimer);clearInterval(profileTimer);delay.disable();hook.disable();
  finishFlight=(async()=>{try{await chain;await rotate(false);await chain;await live();await chain;await writeFile(join(out,'backend-observation.json'),JSON.stringify(report(),null,2));return report();}finally{session.disconnect();if(service.tenants.get===observedGet)service.tenants.get=get;for(const restore of restorers)restore();const current=service.server.listeners('request');if(current.includes(observedRequest)){service.server.removeAllListeners('request');for(const handler of current)for(const original of handler===observedRequest?handlers:[handler])service.server.on('request',original);}}})();return finishFlight;
 }};
}
