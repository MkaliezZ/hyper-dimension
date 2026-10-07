import assert from 'node:assert/strict';import {createServer} from 'node:http';import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {createProject} from '../src/projectPlans.js';import {partyPlanningContext} from '../src/partyPlanning.js';import {legacySaveKey} from '../src/saveStorage.js';
await mkdir('qa/v71',{recursive:true});const directory=await mkdtemp(resolve('qa/v71/runtime-')),requests=[],report={directory,scope:'Real per-owner Node workers and Hermes parent/child engines with deterministic loopback model responses; no real provider quality claim, user save or personal document access.'};let pause=false,held=false;
const provider=createServer(async(req,res)=>{try{
 if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({data:[{id:'deepseek-flash'}]}));return;}
 if(req.url!=='/chat/completions'){res.writeHead(404).end();return;}
 let raw='';for await(const c of req)raw+=c;const d=JSON.parse(raw),names=(d.tools||[]).map(t=>t.function.name),parent=names.includes('recruitment_delegate'),island=names.includes('island_party'),called=(d.messages||[]).flatMap(m=>m.tool_calls||[]).map(t=>t.function.name);
 requests.push({model:d.model,tools:names,called,results:(d.messages||[]).filter(m=>m.role==='tool').map(m=>String(m.content).slice(0,260))});if(pause){held=true;return;}
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
 service=await createLanHttpServer({directory,port:0,enrollmentKey:'REAL-HERMES-TEST'});const users=[];
 for(let i=0;i<2;i++){const u=await service.identities.register({login:'runtime_'+i,password:'isolated-runtime-password',name:'运行测试'+i,islandName:'隔离验证岛'+i,avatar:'male_0',theme:'pixel'}),c=await service.tenants.get(u.token),state=hydrateTown(createZeroState());state.saveSlot=legacySaveKey('pixel')+'-restart-'+u.view.me.id;state.freshStartPending=false;state.coins=20;assert(createProject(state,{id:'welcome',title:'迎宾灯',targets:{lantern:1}}).ok);await c.saves.open('pixel',{legacyState:state});users.push({...u,c});}
 const req=async(n,path,data)=>{const r=await fetch('http://127.0.0.1:'+service.port+path,{method:data?'POST':'GET',headers:{Cookie:'hd_lan_session='+users[n].token,'X-HD-Island':users[n].view.me.id,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(240000)});const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));return result;};
 const hire=(op,data)=>req(0,'/api/recruitment/pixel/'+op,data);
 const custom=await hire('candidate',{requestId:'runtime-custom-candidate',input:{name:'青石',roleId:'yan',appearance:'male_2',personality:'细致务实，检查材料再开工',backstory:'乘船造访群岛的木作学者'}});await hire('hire',{requestId:'real-hire-one',projectId:'welcome',candidateId:custom.candidate.id});const active=await until(async()=>{const r=await hire('status');if(r.history?.[0]?.phase==='failed')throw Error(JSON.stringify(r.history[0].runs));return r.active?.phase==='available'&&r.active;});
 assert.equal(active.profile.name,"青石");assert.equal(active.context.candidate.roleId,"yan");assert.equal(active.profile.appearance,"male_2");report.customCandidate=active.profile.name;const run=active.runs[0];assert.equal(run.child.parentId,run.parent.id);assert.deepEqual(run.child.acceptedSteps,['welcome:wood']);assert.equal(requests.length,6);assert(requests.every(r=>r.model==='deepseek-flash'&&r.tools.length===2));report.parent=run.parent.id;report.child=run.child.id;report.recruitmentCalls=6;
 const ledger=await service.agents.work(users[0].token,'ledger',{}),record=ledger.runs.find(r=>r.id===run.ledgerRunId);assert.equal(record.usage.calls,6);assert.equal(record.children.length,2);report.recruitmentLedger=record.id;
 await hire('cancel',{id:'real-hire-one'});pause=true;await hire('hire',{requestId:'real-hire-cancel',projectId:'welcome'});await until(()=>held);await hire('cancel',{id:'real-hire-cancel'});await until(async()=>!(await hire('status')).active);pause=false;report.actualWorkerCancelled=true;
 const c=users[0].c;const manage=async(n,operation,data={})=>{const saves=users[n].c.saves,d=await saves.current('pixel');return saves.action('pixel',{kind:'commerce',operation,requestId:randomUUID(),expectedVersion:d.version,...data});};
 for(let i=0;i<2;i++)for(const op of ['enable','fish_enable'])await manage(i,op);
 const state=(await c.saves.current('pixel')).state;
 const answer=await req(0,'/api/hermes/command',{theme:'pixel',requestId:randomUUID(),message:'帮我办花园海风钓鱼活动，请观察后用工具创建派对。',party:partyPlanningContext(state),day:state.day,inventory:state.inventory,saveSlot:state.saveSlot});
 assert.equal(answer.source,'hermes',JSON.stringify(answer));assert.equal(answer.parties.length,1,JSON.stringify(answer));const proposal=answer.parties[0];
 const stored=JSON.parse(await readFile(resolve(c.directory,'_party_proposals',answer.runId+'.json'),'utf8'));assert.equal(stored.worldKey,state.saveSlot);assert.equal(stored.parties[0].id,proposal.id);
 const settled=await manage(0,'fish_steward',{day:state.day,runId:answer.runId,proposalId:proposal.id});assert(settled.receipt.details.ok,JSON.stringify(settled.receipt));assert.equal(settled.document.state.fishingParty.draft.source,'hermes');assert(settled.document.state.workProjects.some(p=>p.runId===answer.runId));
 await assert.rejects(manage(1,'fish_steward',{day:state.day,runId:answer.runId,proposalId:proposal.id}));const repeat=await manage(0,'fish_steward',{day:state.day,runId:answer.runId,proposalId:proposal.id});assert(repeat.receipt.details.replayed);assert.equal(repeat.document.state.workProjects.filter(p=>p.runId===answer.runId).length,1);
 report.partyProofAtOwnerSave=true;report.partyRegisteredOnce=true;report.otherOwnerRejected=true;report.partyRun=answer.runId;report.requests=requests.map(r=>({model:r.model,toolCount:r.tools.length}));report.passed=true;
}catch(e){report.failure=e.stack;report.requests=requests;process.exitCode=1;}finally{await service?.close();provider.closeAllConnections();await new Promise(r=>provider.close(r));await writeFile('qa/v71/runtime-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
