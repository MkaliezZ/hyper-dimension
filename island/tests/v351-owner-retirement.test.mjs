import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {resolve} from 'node:path';

// Execute the actual production factory with controlled IPC and timers. No copy
// of its lifecycle logic, provider call, document operation or three-minute wait.
const source=await readFile(new URL('../server/lanAgentService.mjs',import.meta.url),'utf8');
const factoryText=source.slice(source.indexOf('export function createOwnerRuntime'),source.indexOf('export function createLanAgentService')).replace(/^export /,'');
const turn=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const timers=new Set(),processes=[],live=new Set();let autoExit=false,mkdirGate=null;
 const setTimer=(fn,ms)=>{const t={fn,ms,active:true,unref(){return t;}};timers.add(t);return t;};
 const clearTimer=t=>{if(t)t.active=false;};
 const fork=()=>{
  const proc=new EventEmitter();Object.assign(proc,{pid:1000+processes.length,connected:true,sent:[],reply:true,closing:false});
  proc.finish=()=>{if(!proc.connected)return;proc.connected=false;proc.emit('exit',0,null);};
  proc.send=(message,callback)=>{proc.sent.push(message);callback?.(null);if(message.method==='close'){proc.closing=true;if(autoExit)queueMicrotask(proc.finish);}
   else if(proc.reply&&!proc.closing)queueMicrotask(()=>proc.emit('message',{id:message.id,value:{method:message.method,worker:processes.indexOf(proc)}}));};
  processes.push(proc);return proc;
 };
 const make=Function('fork','mkdir','resolve','root','fail','liveOwnerProcesses','setTimeout','clearTimeout',factoryText+'\nreturn createOwnerRuntime;')(fork,async()=>{if(mkdirGate)await mkdirGate;},resolve,resolve('owned-fixture'),(message,code,status)=>Object.assign(Error(message),{code,status}),live,setTimer,clearTimer);
 const runtimes=[];
 return {processes,live,timers,make(){const r=make({directory:resolve('owned-fixture'),ownerId:'fictional-owner'});runtimes.push(r);return r;},holdMkdir(p){mkdirGate=p;},fire(ms){const t=[...timers].find(t=>t.active&&t.ms===ms);assert(t,'Expected original '+ms+'ms timer');t.active=false;t.fn();},async cleanup(){autoExit=true;const closing=runtimes.map(r=>r.close());for(const p of processes)p.finish();await Promise.allSettled(closing);}};
}

test('a new ledger waits for idle retirement and uses one fresh worker',async()=>{
 const f=fixture(),r=f.make();let next;
 try{
  assert.equal((await r.call('ledger')).worker,0);f.fire(180000);const old=f.processes[0];assert(old.closing);
  next=r.call('ledger');next.catch(()=>{});await turn();
  assert.equal(old.sent.filter(m=>m.method==='ledger').length,1,'Never send a new request to a retiring worker');assert.equal(f.processes.length,1);assert.equal(f.live.size,1);
  old.finish();assert.equal((await next).worker,1);assert.equal(f.processes.length,2);assert.equal(f.live.size,1);
 }finally{await f.cleanup();await next?.catch(()=>{});}
});

test('interrupted document work stays uncertain without replay; old events cannot reject a new worker',async()=>{
 const f=fixture(),r=f.make();let work,next;
 try{
  await r.call('ledger');const old=f.processes[0];old.reply=false;work=r.call('command',{message:'Owned fictional file work'});const interrupted=assert.rejects(work,e=>e.code==='lan_agent_interrupted');await turn();old.finish();await interrupted;
  assert.equal(f.processes.length,1,'Interrupted file work must not restart automatically');assert.equal(old.sent.filter(m=>m.method==='command').length,1);
  next=r.call('ledger');await turn();const fresh=f.processes[1];assert(fresh);old.emit('error',Error('Late old IPC error'));assert.equal((await next).worker,1);
 }finally{await f.cleanup();await Promise.allSettled([work,next].filter(Boolean));}
});

test('retiring workers retain all four capacity slots until actual exit',async()=>{
 const f=fixture(),owners=Array.from({length:4},()=>f.make());let waiting;
 try{
  await Promise.all(owners.map(r=>r.call('ledger')));assert.equal(f.live.size,4);f.fire(180000);
  const fifth=f.make();await assert.rejects(fifth.call('ledger'),e=>e.code==='lan_agent_capacity');
  waiting=owners[0].call('ledger');waiting.catch(()=>{});await turn();assert.equal(f.processes.length,4);f.processes[0].finish();await waiting;assert.equal(f.live.size,4);assert.equal(f.processes.length,5);
 }finally{await f.cleanup();await waiting?.catch(()=>{});}
});

test('the original request deadline includes retirement and prevents late dispatch after timeout',async()=>{
 const f=fixture(),r=f.make();let waiting;
 try{
  await r.call('ledger');f.fire(180000);waiting=r.call('command',{message:'Do not dispatch after expiry'});const expired=assert.rejects(waiting,e=>e.code==='lan_agent_timeout');await turn();f.fire(260000);await expired;
  f.processes[0].finish();await turn();assert.equal(f.processes.length,1);assert.equal(f.processes[0].sent.filter(m=>m.method==='command').length,0);
 }finally{await f.cleanup();}
});

test('explicit close shares retirement and never starts a worker for a waiting request',async()=>{
 const f=fixture(),r=f.make();let waiting;
 try{
  await r.call('ledger');f.fire(180000);waiting=r.call('ledger');const rejected=assert.rejects(waiting,e=>e.code==='lan_agent_closed');await turn();const a=r.close(),b=r.close();assert.equal(a,b);
  f.processes[0].finish();await Promise.all([a,b,rejected]);assert.equal(f.processes.length,1);assert.equal(f.processes[0].sent.filter(m=>m.method==='close').length,1);await assert.rejects(r.call('ledger'),e=>e.code==='lan_agent_closed');
 }finally{await f.cleanup();}
});

test('closing during workspace preparation cannot create a late worker',async()=>{
 const f=fixture(),r=f.make();let release,waiting;f.holdMkdir(new Promise(r=>release=r));
 try{
  waiting=r.call('command');const rejected=assert.rejects(waiting,e=>e.code==='lan_agent_closed');await turn();await r.close();release();await rejected;await turn();assert.equal(f.processes.length,0);
 }finally{release();await f.cleanup();await waiting?.catch(()=>{});}
});

test('an IPC error keeps the dying process capacity slot until exit',async()=>{
 const f=fixture(),r=f.make();let work,next;
 try{
  await r.call('ledger');const old=f.processes[0];old.reply=false;work=r.call('command');const rejected=assert.rejects(work,e=>e.code==='lan_agent_interrupted');await turn();old.emit('error',Error('Owned IPC failure'));await rejected;
  assert.equal(f.live.size,1);assert(old.closing);next=r.call('ledger');next.catch(()=>{});await turn();assert.equal(f.processes.length,1);old.finish();assert.equal((await next).worker,1);
 }finally{await f.cleanup();await Promise.allSettled([work,next].filter(Boolean));}
});

test('concurrent first requests share one worker and receive their own results',async()=>{
 const f=fixture(),r=f.make();try{const results=await Promise.all([r.call('ledger'),r.call('status')]);assert.deepEqual(results.map(r=>r.method),['ledger','status']);assert.equal(f.processes.length,1);assert.equal(f.live.size,1);}finally{await f.cleanup();}
});
