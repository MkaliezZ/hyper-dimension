// Real Hermes engines against a deterministic local model endpoint.
// This verifies actual wire requests, tool isolation, cancellation, and HTTP persistence.
// It is not a live-provider quality test; v28-hermes-live.mjs supplies that evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSaveStore} from '../server/saveStore.mjs';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createProject} from '../src/projectPlans.js';
await mkdir('qa/v28',{recursive:true});

test('HTTP recruitment uses two real Hermes engines, saves proof, stops an actual pending worker and retries',{timeout:90000},async()=>{
 const directory=await mkdtemp(resolve('qa/v28/http-')),requests=[],children=[];
 let pause=false,observedHold=false;
 const mock=createServer(async(req,res)=>{
  if(req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({data:[{id:'deepseek-flash'}]}));return}
  if(req.url!=='/chat/completions'){res.writeHead(404).end();return}
  let raw='';for await(const c of req)raw+=c;
  const data=JSON.parse(raw),names=(data.tools||[]).map(t=>t.function.name);
  requests.push({model:data.model,tools:names,thinking:data.thinking||null});
  if(pause){observedHold=true;return}
  const parent=names.includes('recruitment_delegate'),observe=parent?'recruitment_observe':'recruitment_observe_child',action=parent?'recruitment_delegate':'recruitment_take_step';
  const messages=data.messages||[],results=messages.filter(m=>m.role==='tool'),called=messages.flatMap(m=>m.tool_calls||[]).map(t=>t.function.name);
  let name,args,content;
  if(!called.includes(observe)){name=observe;args={}}
  else if(!called.includes(action)){
   const context=JSON.parse(results.at(-1).content);
   const step=context.steps.find(s=>s.item==='wood')||context.steps[0];
   name=action;args={stepIds:[step.id],...(!parent?{intent:'先收集木材，真实动作后交付'}:{})};
  }else content='伙伴已接受筹备步骤，等待到岛后实际执行。';
  const usage={prompt_tokens:100,completion_tokens:10,total_tokens:110,prompt_cache_hit_tokens:20,prompt_cache_miss_tokens:80};
  const id='call-'+requests.length;
  if(data.stream){
   res.writeHead(200,{'content-type':'text/event-stream'});
   const delta=name?{role:'assistant',tool_calls:[{index:0,id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{role:'assistant',content};
   res.write('data: '+JSON.stringify({id,object:'chat.completion.chunk',model:'deepseek-flash',choices:[{index:0,delta,finish_reason:null}]})+'\n\n');
   res.write('data: '+JSON.stringify({id,object:'chat.completion.chunk',model:'deepseek-flash',choices:[{index:0,delta:{},finish_reason:name?'tool_calls':'stop'}],usage})+'\n\n');
   res.end('data: [DONE]\n\n');
  }else res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({id,model:'deepseek-flash',choices:[{index:0,message:name?{role:'assistant',content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{role:'assistant',content},finish_reason:name?'tool_calls':'stop'}],usage}));
 });
 await new Promise(r=>mock.listen(0,'127.0.0.1',r));
 const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const s=hydrateTown(createState());for(const k of Object.keys(s.inventory))s.inventory[k]=0;s.coins=20;
 assert(createProject(s,{id:'http-plan',title:'迎宾灯',targets:{lantern:1}}).ok);
 const saves=createSaveStore({directory:resolve(directory,'saves')});await saves.open('pixel',{legacyState:s,clientId:'test'});
 const child=spawn(process.execPath,[resolve('server.mjs'),'--theme=pixel','--port='+port],{cwd:resolve('.'),windowsHide:true,
  env:{...process.env,DEEPSEEK_API_KEY:'fixture-key-not-secret',HD_MODEL_ENDPOINT:'http://127.0.0.1:'+mock.address().port,
   HD_SAVE_DIR:resolve(directory,'saves'),HD_HERMES_HOME:resolve(directory,'home'),HD_STEWARD_WORKDIR:resolve(directory,'documents')},stdio:['ignore','pipe','pipe']});children.push(child);
 child.stderr.resume();child.stdout.resume();
 const base='http://127.0.0.1:'+port;
 async function call(operation,body){
  const r=await fetch(base+'/api/recruitment/pixel/'+operation,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:base},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});return {status:r.status,data:await r.json()};
 }
 async function waitFor(check,ms=45000){const start=Date.now();while(Date.now()-start<ms){const r=await check();if(r)return r;await new Promise(r=>setTimeout(r,100))}throw Error('wait timed out')}
 const report={directory,endpoint:'local deterministic fixture',liveProvider:false,requests};
 try{
  await waitFor(async()=>{try{return (await fetch(base+'/api/status')).ok}catch{return false}},10000);
  const body={requestId:'http-recruit-1',projectId:'http-plan'};
  const start=await call('hire',body);assert.equal(start.status,200);assert.equal(start.data.contract.phase,'planning');
  const duplicate=await call('hire',body);assert.equal(duplicate.data.replayed,true);
  const ready=await waitFor(async()=>{const r=await call('status');assert.equal(r.status,200);if(r.data.history?.[0]?.phase==='failed')throw Error(JSON.stringify(r.data.history[0]));return r.data.active?.phase==='available'&&r.data.active});
  assert.equal(ready.runs.length,1);const run=ready.runs[0];
  assert.notEqual(run.parent.id,run.child.id);assert.equal(run.child.parentId,run.parent.id);
  assert.deepEqual(run.child.acceptedSteps,['http-plan:wood']);
  assert.equal(run.parent.usage.input+run.parent.usage.output,run.parent.usage.total);
  assert.equal(run.child.usage.input+run.child.usage.output,run.child.usage.total);
  assert.equal(requests.length,6,JSON.stringify(requests));
  assert(requests.every(r=>r.model==='deepseek-flash'));
  assert(requests.every(r=>r.tools.length===2&&r.tools.every(t=>t.startsWith('recruitment_'))));
  await call('cancel',{id:body.requestId});assert.equal((await call('status')).data.active,null);
  pause=true;
  const next=await call('hire',{requestId:'http-recruit-2',projectId:'http-plan'});assert.equal(next.status,200);
  await waitFor(()=>observedHold);
  const cancelled=await call('cancel',{id:'http-recruit-2'});assert.equal(cancelled.data.contract.phase,'cancelling');
  await waitFor(async()=>!(await call('status')).data.active);
  const history=(await call('status')).data.history;assert.equal(history[0].phase,'cancelled');
  pause=false;
  await call('hire',{requestId:'http-recruit-3',projectId:'http-plan'});
  const after=await waitFor(async()=>{const r=(await call('status')).data;return r.active?.phase==='available'&&r.active});
  assert.equal(after.runs[0].child.acceptedSteps[0],'http-plan:wood');
  // Different origins cannot trigger hiring, and arbitrary caller context is not used.
  const bad=await fetch(base+'/api/recruitment/pixel/hire',{method:'POST',headers:{Origin:'https://other.invalid','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(bad.status,403);
  report.passed=true;report.requests=requests;report.parent=run.parent;report.child=run.child;report.cancelled=history[0].phase;report.newWorkerRun=after.runs[0].parent.id;
 }catch(e){report.failure=e.stack;throw e}
 finally{
  await writeFile('qa/v28/http-report.json',JSON.stringify(report,null,2));
  for(const p of children){p.kill();await new Promise(r=>p.once('exit',r))}
  mock.closeAllConnections();await new Promise(r=>mock.close(r));
 }
});
