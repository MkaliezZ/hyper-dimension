import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,unlink,rmdir,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {createLanAgentService} from '../server/lanAgentService.mjs';

// macOS /var and configured temporary roots may be links. Canonicalize the
// owned fixture root; production data-path link checks remain unchanged.
const temporaryRoot=await realpath(tmpdir());
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};

for(const theme of ['pixel','origami'])test(`${theme}: graceful shutdown persists accepted background work before closing its runtime`,async()=>{
 const directory=await mkdtemp(resolve(temporaryRoot,'hd-agent-shutdown-')),started=deferred(),finish=deferred();
 let service,reopened,stopping,finished=false,runtimeClosed=false,prematureClose=false,calls=0;
 const factory=({directory})=>({documents:resolve(directory,'documents'),async call(method){
  if(method!=='command')return{hermes:{configured:true}};
  calls++;started.resolve();await finish.promise;finished=true;
  return{source:'hermes',answer:'Fictional owned work completed once',operations:[],ledgerRunId:'fictional-shutdown-run'};
 },async close(){runtimeClosed=true;if(!finished){prematureClose=true;finish.reject(Error('Owned runtime closed before accepted work finished'));}}});
 try{
  service=await createLanHttpServer({directory,port:0,enrollmentKey:'OWNED-SHUTDOWN',agentRuntimeFactory:factory});
  const account=await service.identities.register({login:'shutdown_'+theme,password:'fictional-password',name:'Fictional owner',islandName:'Owned shutdown fixture',avatar:'male_0',theme});
  await service.tenants.open(account.token,theme,{});
  const request={theme,requestId:randomUUID(),message:'Complete this fictional owned task once'};
  assert.equal((await service.agents.submit(account.token,request)).status,'running');
  await started.promise;
  let stopped=false;stopping=service.agents.close().then(()=>{stopped=true;});
  await nextTurn();await nextTurn();
  assert.equal(prematureClose,false,'Shutdown must not interrupt accepted background work');
  assert.equal(runtimeClosed,false,'Runtime must remain open until the result is durable');
  assert.equal(stopped,false,'Shutdown must wait for accepted work');
  finish.resolve();await stopping;await service.close();
  assert.equal(runtimeClosed,true);
  const file=resolve(directory,'_lan/agents',account.view.me.id,'conversation.json');
  const journal=JSON.parse(await readFile(file,'utf8'));
  assert.equal(journal.jobs.length,1);assert.equal(journal.jobs[0].status,'completed');
  assert.equal(journal.jobs[0].result.answer,'Fictional owned work completed once');
  reopened=await createLanHttpServer({directory,port:0,enrollmentKey:'OWNED-SHUTDOWN',agentRuntimeFactory:factory});
  const login=await reopened.identities.login({login:'shutdown_'+theme,password:'fictional-password'});
  const replay=await reopened.agents.submit(login.token,request);
  assert.equal(replay.status,'completed');assert.equal(calls,1,'Restart/replay must not execute real work again');
 }finally{finish.resolve();await stopping?.catch(()=>{});await reopened?.close();await service?.close();}
});

test('shutdown during owner lookup rejects work that was never accepted',async()=>{
 const directory=await mkdtemp(resolve(temporaryRoot,'hd-agent-shutdown-race-')),lookup=deferred();let created=0;
 const service=createLanAgentService({directory,identities:{},tenants:{get:()=>lookup.promise},runtimeFactory:()=>{created++;throw Error('Must not create a runtime after shutdown');}});
 const submitting=service.submit('fictional-session',{theme:'pixel',requestId:randomUUID(),message:'Unaccepted fictional work'});
 const rejected=assert.rejects(submitting,e=>e.code==='lan_agent_closed');
 await service.close();lookup.resolve({accountId:'fictional-owner',account:{profile:{theme:'pixel'}},saves:{current:async()=>null}});
 await rejected;assert.equal(created,0);
});

test('HTTP shutdown drains an already accepted job after its202response',async()=>{
 const directory=await mkdtemp(resolve(temporaryRoot,'hd-agent-http-shutdown-')),started=deferred(),finish=deferred();
 let service,stopping,completed=false,closedEarly=false,calls=0;
 try{
  service=await createLanHttpServer({directory,port:0,enrollmentKey:'OWNED-HTTP-SHUTDOWN',agentRuntimeFactory:()=>({documents:directory,async call(method){
   if(method!=='command')return{};calls++;started.resolve();await finish.promise;completed=true;return{source:'hermes',answer:'Owned HTTP task completed once',operations:[]};
  },async close(){closedEarly=!completed;}})});
  const account=await service.identities.register({login:'http_shutdown',password:'fictional-password',name:'Fictional owner',islandName:'HTTP shutdown fixture',avatar:'female_0',theme:'pixel'});
  await service.tenants.open(account.token,'pixel',{});
  const request={theme:'pixel',requestId:randomUUID(),message:'Fictional asynchronous HTTP work'};
  const response=await fetch('http://127.0.0.1:'+service.port+'/api/lan/steward',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'hd_lan_session='+account.token,'X-HD-Island':account.view.me.id},body:JSON.stringify(request)});
  assert.equal(response.status,202);assert.equal((await response.json()).job.status,'running');await started.promise;
  const httpClosed=new Promise(r=>service.server.once('close',r));let stopped=false;
  stopping=service.close().then(()=>{stopped=true;});await httpClosed;await nextTurn();
  assert.equal(stopped,false);assert.equal(closedEarly,false);finish.resolve();await stopping;
  const journal=JSON.parse(await readFile(resolve(directory,'_lan/agents',account.view.me.id,'conversation.json'),'utf8'));
  assert.equal(journal.jobs[0].status,'completed');assert.equal(calls,1);assert.equal(closedEarly,false);
 }finally{finish.resolve();await stopping;await service?.close();}
});

test('failed result persistence keeps shutdown failed instead of releasing the data lease',async()=>{
 const directory=await mkdtemp(resolve(temporaryRoot,'hd-agent-persist-shutdown-')),started=deferred(),finish=deferred();
 let service,stopping,file,before,obstructed=false,runtimeClosed=false;
 try{
  service=await createLanHttpServer({directory,port:0,enrollmentKey:'OWNED-PERSIST-SHUTDOWN',agentRuntimeFactory:()=>({documents:directory,async call(method){
   if(method!=='command')return{};started.resolve();await finish.promise;return{source:'hermes',answer:'Fictional result whose journal is temporarily blocked',operations:[]};
  },async close(){runtimeClosed=true;}})});
  const account=await service.identities.register({login:'persist_shutdown',password:'fictional-password',name:'Fictional owner',islandName:'Owned blocked journal',avatar:'male_0',theme:'pixel'});
  await service.tenants.open(account.token,'pixel',{});
  await service.agents.submit(account.token,{theme:'pixel',requestId:randomUUID(),message:'Fictional durable-result check'});await started.promise;
  file=resolve(directory,'_lan/agents',account.view.me.id,'conversation.json');assert(file.startsWith(directory+'/')||file.startsWith(directory+'\\'));
  before=await readFile(file);await unlink(file);await mkdir(file);obstructed=true;
  stopping=service.close();const rejected=assert.rejects(stopping,e=>e instanceof AggregateError&&e.errors.some(x=>x instanceof AggregateError));
  finish.resolve();await rejected;assert.equal(runtimeClosed,false,'Do not claim a clean runtime stop when the result is not durable');
 }finally{
  finish.resolve();await stopping?.catch(()=>{});
  if(obstructed){await rmdir(file);await writeFile(file,before);}
  await service?.close().catch(()=>{});
 }
});
