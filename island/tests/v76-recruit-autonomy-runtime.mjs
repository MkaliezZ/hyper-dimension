import {fixture} from './v76-autonomy-fixture.mjs';import {prepareRecruitment,bindRecruitment} from '../src/recruitment.js';
import {createRecruitmentStore} from '../server/recruitmentStore.mjs';import {proof,finishVisit} from './v72-recruitment-fixture.mjs';
import assert from 'node:assert/strict';import {createServer} from 'node:http';import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {createProject} from '../src/projectPlans.js';import {partyPlanningContext} from '../src/partyPlanning.js';import {legacySaveKey} from '../src/saveStorage.js';
await mkdir('qa/v76',{recursive:true});const directory=await mkdtemp(resolve('qa/v76/runtime-')),requests=[],report={directory,scope:'Actual autonomous Hermes patrol and parent/child recruitment engines; deterministic local provider and preloaded funds. No live provider or zero-start claim.'};let pause=false,held=false;
const provider=createServer(async(req,res)=>{try{
 if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({data:[{id:'deepseek-flash'}]}));return;}
 if(req.url!=='/chat/completions'){res.writeHead(404).end();return;}
 let raw='';for await(const c of req)raw+=c;const d=JSON.parse(raw),names=(d.tools||[]).map(t=>t.function.name),parent=names.includes('recruitment_delegate'),island=names.includes('island_party'),called=(d.messages||[]).flatMap(m=>m.tool_calls||[]).map(t=>t.function.name);
 requests.push({model:d.model,tools:names,called,priorVisit:(d.messages||[]).filter(m=>m.role==='tool').map(m=>{try{return JSON.parse(m.content).continuingVisit}catch{return null}}).filter(Boolean),results:(d.messages||[]).filter(m=>m.role==='tool').map(m=>String(m.content).slice(0,260))});if(pause){held=true;return;}
 let name,args,content;
 if(!names.length)content=JSON.stringify({guestId:4,reason:'莉安的花艺适合花园主题。'});
 else{
 const observe=island?'island_observe':parent?'recruitment_observe':'recruitment_observe_child',action=island?'island_recruit':parent?'recruitment_delegate':'recruitment_take_step';
 if(!called.includes(observe)){name=observe;args={};}
 else if(!called.includes(action)){name=action;if(island){const context=JSON.parse(d.messages.filter(m=>m.role==='tool').at(-1).content),o=context.recruitment.opportunities.find(o=>o.candidateId==='yan');args={projectId:o.projectId,candidateId:o.candidateId,reason:'木料准备存在缺口，木作匠可负责实际采集。'};}else{const context=JSON.parse(d.messages.filter(m=>m.role==='tool').at(-1).content);args={stepIds:[context.steps.find(s=>s.item==='wood').id],...(!parent?{intent:'实际采集木材再交付'}:{})};}}
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
 const f=await fixture('pixel');await f.policy();await f.service.close();service=await createLanHttpServer({directory:f.directory,port:0,enrollmentKey:'AUTONOMY-FIXTURE'});report.directory=f.directory;
 const user=f.user,c=await service.tenants.get(user.token),doc=await c.saves.current('pixel'),base='http://127.0.0.1:'+service.port;
 async function request(path,data){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Cookie:'hd_lan_session='+user.token,'X-HD-Island':c.accountId,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;}
 const result=await request('/api/hermes/plan',{theme:'pixel',saveSlot:doc.state.saveSlot});assert.equal(result.source,'hermes');const g=result.recruitmentOffers[0];assert(g);assert.equal(g.candidateId,'yan');
 const s=structuredClone((await c.saves.current('pixel')).state);assert(prepareRecruitment(s,g.id,g.projectId,g.candidateId).ok);await c.saves.save('pixel',{state:s,expectedVersion:(await c.saves.current('pixel')).version});
 await request('/api/recruitment/pixel/hire',{requestId:g.id,projectId:g.projectId,candidateId:g.candidateId,source:'primary'});
 const offer=await until(async()=>{const v=await request('/api/recruitment/pixel/status');if(v.history.some(h=>h.id===g.id&&h.phase==='failed'))throw Error(JSON.stringify(v.history.find(h=>h.id===g.id).runs));return v.active?.phase==='available'&&v.active;});
 assert.equal(requests.length,9);assert(requests.every(r=>r.model==='deepseek-flash'));
 const contract=(await request('/api/recruitment/pixel/activate',{id:g.id})).contract;const current=await c.saves.current('pixel'),bound=structuredClone(current.state);assert(bindRecruitment(bound,contract,'pixel').ok);await c.saves.save('pixel',{state:bound,expectedVersion:current.version});
 const ledger=await service.agents.work(user.token,'ledger',{}),patrol=ledger.runs.find(r=>r.id===result.ledgerRunId),negotiation=ledger.runs.find(r=>r.id===offer.runs[0].ledgerRunId);
 assert(patrol.automatic);assert(negotiation.automatic);assert.equal(negotiation.parentRunId,patrol.id);assert.equal(patrol.usage.calls,3);assert.equal(negotiation.usage.calls,6);assert.equal(negotiation.children.length,2);
 assert.equal((await c.saves.current('pixel')).state.coins,60);report.patrol=patrol.id;report.parent=offer.runs[0].parent.id;report.child=offer.runs[0].child.id;report.negotiation=negotiation.id;report.modelCalls=9;report.automaticUsageLinked=true;report.actualToolChoice=true;report.wageReserved=true;report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await service?.close();provider.closeAllConnections();await new Promise(r=>provider.close(r));await writeFile('qa/v76/runtime-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
