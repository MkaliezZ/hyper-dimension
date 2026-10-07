import {fixture} from './v74-travel-fixture.mjs';import {prepareRecruitmentRenewal} from '../src/recruitmentRenewal.js';
import {createRecruitmentStore} from '../server/recruitmentStore.mjs';import {proof,finishVisit} from './v72-recruitment-fixture.mjs';
import assert from 'node:assert/strict';import {createServer} from 'node:http';import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {createProject} from '../src/projectPlans.js';import {partyPlanningContext} from '../src/partyPlanning.js';import {legacySaveKey} from '../src/saveStorage.js';
await mkdir('qa/v75',{recursive:true});const directory=await mkdtemp(resolve('qa/v75/runtime-')),requests=[],report={directory,scope:'Actual Hermes parent and child engines for an in-place renewal, deterministic local provider; prior contract and funds fixture. No live provider or zero-start claim.'};let pause=false,held=false;
const provider=createServer(async(req,res)=>{try{
 if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({data:[{id:'deepseek-flash'}]}));return;}
 if(req.url!=='/chat/completions'){res.writeHead(404).end();return;}
 let raw='';for await(const c of req)raw+=c;const d=JSON.parse(raw),names=(d.tools||[]).map(t=>t.function.name),parent=names.includes('recruitment_delegate'),island=names.includes('island_party'),called=(d.messages||[]).flatMap(m=>m.tool_calls||[]).map(t=>t.function.name);
 requests.push({model:d.model,tools:names,called,priorVisit:(d.messages||[]).filter(m=>m.role==='tool').map(m=>{try{return JSON.parse(m.content).continuingVisit}catch{return null}}).filter(Boolean),results:(d.messages||[]).filter(m=>m.role==='tool').map(m=>String(m.content).slice(0,260))});if(pause){held=true;return;}
 let name,args,content;
 if(!names.length)content=JSON.stringify({guestId:4,reason:'莉安的花艺适合花园主题。'});
 else{
 const observe=island?'observe':parent?'recruitment_observe':'recruitment_observe_child',action=island?'island_party':parent?'recruitment_delegate':'recruitment_take_step';
 if(!called.includes(observe)){name=observe;args={};}
 else if(!called.includes(action)){name=action;if(island)args={name:'花园海风小聚',description:'花园与海风',tags:['nature','sea'],difficulty:'easy',guestId:4,guestReason:'莉安擅长花艺。'};else{const context=JSON.parse(d.messages.filter(m=>m.role==='tool').at(-1).content);args={stepIds:[context.steps.find(s=>s.item==='wood').id],...(!parent?{intent:'实际采集木材再交付'}:{})};}}
 else content='已通过工具提交方案，等待游戏确认与实际执行。';
 }
 const id='local-'+requests.length,usage={prompt_tokens:100,completion_tokens:10,total_tokens:110};
 const message=name?{role:'assistant',content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{role:'assistant',content};
 if(d.stream){res.writeHead(200,{'content-type':'text/event-stream'});const delta=name?{role:'assistant',tool_calls:[{index:0,...message.tool_calls[0]}]}:message;for(const chunk of [{choices:[{index:0,delta,finish_reason:null}]},{choices:[{index:0,delta:{},finish_reason:name?'tool_calls':'stop'}],usage}])res.write('data: '+JSON.stringify({id,model:'deepseek-flash',object:'chat.completion.chunk',...chunk})+'\n\n');res.end('data: [DONE]\n\n');}
 else res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({id,model:'deepseek-flash',choices:[{index:0,message,finish_reason:name?'tool_calls':'stop'}],usage}));
}catch(e){res.writeHead(500).end(JSON.stringify({error:e.message}));}});
await new Promise(r=>provider.listen(0,'127.0.0.1',r));Object.assign(process.env,{DEEPSEEK_API_KEY:'local-fixture-no-secret',HD_MODEL_ENDPOINT:'http://127.0.0.1:'+provider.address().port});
let service;
async function until(fn,ms=60000){const start=Date.now();while(Date.now()-start<ms){const r=await fn();if(r)return r;await new Promise(r=>setTimeout(r,100));}throw Error('condition timeout');}

try{
 const f=await fixture('pixel');await f.service.close();service=await createLanHttpServer({directory:f.directory,port:0,enrollmentKey:'TEMP-TRAVEL-FIXTURE'});report.directory=f.directory;
 const user=f.accounts[1],c=await service.tenants.get(user.token),d=await c.saves.current('pixel'),s=structuredClone(d.state),requestId='real-renew-'+randomUUID();
 assert(prepareRecruitmentRenewal(s,{id:requestId,oldId:f.contract.id,projectId:'travel-plan'}).ok);await c.saves.save('pixel',{state:s,expectedVersion:d.version});
 const request=async(op,data)=>{const r=await fetch('http://127.0.0.1:'+service.port+'/api/recruitment/pixel/'+op,{method:data?'POST':'GET',headers:{Cookie:'hd_lan_session='+user.token,'X-HD-Island':user.view.me.id,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const v=await r.json();assert.equal(r.status,200,JSON.stringify(v));return v;};
 await request('renew',{id:f.contract.id,requestId,projectId:'travel-plan'});const proposal=await until(async()=>{const v=await request('status');const bad=v.history.find(c=>c.id===requestId&&['failed','interrupted'].includes(c.phase));if(bad)throw Error(JSON.stringify(bad.runs));return v.renewal?.phase==='available'&&v.renewal;});
 const run=proposal.runs.at(-1);assert(run.parent.id.startsWith('hd-parent-'));assert.equal(run.child.parentId,run.parent.id);assert.equal(requests.length,6);assert(requests.some(r=>r.tools.includes('recruitment_take_step')&&r.priorVisit.some(p=>p.contractId===f.contract.id)));assert(requests.every(r=>r.model==='deepseek-flash'));
 let current=await c.saves.current('pixel');for(const operation of ['enable','hire_enable']){await c.saves.action('pixel',{kind:'commerce',operation,requestId:randomUUID(),expectedVersion:current.version});current=await c.saves.current('pixel');}
 const applied=await c.saves.action('pixel',{kind:'commerce',operation:'hire_renew',contractId:f.contract.id,renewalId:requestId,requestId:randomUUID(),expectedVersion:current.version,day:current.state.day});assert.equal(applied.document.state.recruitment.active.phase,'working');assert.equal(applied.receipt.details.oldSettlement.fee,0);
 const status=await request('status');assert.equal(status.active.id,requestId);assert.equal(status.history.find(c=>c.id===f.contract.id).phase,'renewed');
 const ledger=await service.agents.work(user.token,'ledger',{}),record=ledger.runs.find(r=>r.id===run.ledgerRunId);assert.equal(record.usage.calls,6);assert.equal(record.children.length,2);
 report.parent=run.parent.id;report.child=run.child.id;report.modelCalls=6;report.continuingVisitVisibleToChild=true;report.ledger=record.id;report.atomicApply=true;report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await service?.close();provider.closeAllConnections();await new Promise(r=>provider.close(r));await writeFile('qa/v75/runtime-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
