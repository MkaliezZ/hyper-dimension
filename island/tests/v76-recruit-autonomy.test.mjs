
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {hydrateTown} from '../src/townSimulation.js';import {createZeroState} from '../src/freshStart.js';
import {createLanHttpServer} from '../server/lanServer.mjs';import {createRecruitmentStore} from '../server/recruitmentStore.mjs';import {createProject,syncProjects} from '../src/projectPlans.js';import {beginTaskStep} from '../src/taskBoard.js';import {prepareRecruitment,bindRecruitment} from '../src/recruitment.js';import {RESIDENTS,setWorldTheme} from '../src/world.js';import {createResidentRuntime} from '../src/residentRuntime.js';import {createRecruitmentRuntime} from '../src/recruitmentRuntime.js';import {followPath} from '../src/movement.js';import {proof,finishVisit} from './v72-recruitment-fixture.mjs';
export async function fixture(theme='pixel'){
 await mkdir('qa/v76',{recursive:true});const directory=await mkdtemp(resolve('qa/v76/autonomy-')),calls=[];let clock=Date.now();
 const service=await createLanHttpServer({directory,port:0,enrollmentKey:'AUTONOMY-FIXTURE',now:()=>clock,agentRuntimeFactory:()=>({documents:'fixture',async call(method,data){calls.push({method,data});if(method==='status')return{hermes:{configured:true}};if(method==='recruit')return proof(data.context);assert.equal(method,'steward');const o=data.recruitment.opportunities[0];return {source:'hermes',model:'deepseek-flash',runId:'hd-island-'+randomUUID().replaceAll('-',''),ledgerRunId:'run-'+randomUUID(),answer:'为木料缺口邀请合适的工匠，等待主子协商。',recruitments:o?[{id:randomUUID(),projectId:o.projectId,candidateId:o.candidateId,reason:'码头筹备还缺六份木料，工匠熟悉木材采集。'}]:[]};},async close(){}})});
 // Declared synthetic starting capital is admitted before authority opens.
 // Every later plan,hold,binding and delivery uses the current server commands.
 try{
 const user=await service.identities.register({login:'auto_'+theme,password:'fixture-password',name:'招聘岛主',islandName:'筹备岛',theme,avatar:'male_0'});
 const c=await service.tenants.get(user.token),seed=hydrateTown(createZeroState());seed.coins=60;seed.freshStartPending=false;seed.saveSlot='autonomy-'+c.accountId;await c.saves.open(theme,{legacyState:seed,protect:true});
 const store=createRecruitmentStore({directory:c.directory,now:()=>clock});
 const read=()=>c.saves.current(theme),update=async fn=>{const d=await read(),s=structuredClone(d.state);await fn(s);return c.saves.save(theme,{state:s,expectedVersion:d.version});};
 const action=async(kind,operation,args={})=>{const d=await read();return c.saves.action(theme,{kind,operation,requestId:randomUUID(),expectedVersion:d.version,expectedSequence:d.actions?.sequence||0,epoch:d.actions?.epoch||null,day:d.state.day,...args});};
 for(const op of ['enable','hire_enable','plan_enable'])await action('commerce',op);
 await action('commerce','plan_create',{project:{id:'auto-plan',title:'客运木料筹备',targets:{wood:6}}});
 const authority=await read();assert(authority.actions.resources&&authority.actions.planning&&authority.actions.hire);
 const policy=async(input={})=>{const d=await read(),a=await store.autonomy_observe(theme,d);return store.policy(theme,d,{requestId:randomUUID(),expectedVersion:a.policy.version,input:{enabled:true,dailyBudget:8,maxContractsPerDay:1,coinFloor:20,candidateIds:['yan'],...input}});};
 const prepare=(id,projectId='auto-plan',candidateId='yan',source='primary')=>action('commerce','hire_prepare',{contractId:id,projectId,candidateId,mode:'hire',source});
 return{service,user,c,store,read,update,policy,action,prepare,calls,theme,directory,advance:ms=>clock+=ms};
 }catch(error){await service.close();throw error;}

}
async function wait(f,id){for(let i=0;i<100;i++){const r=await f.service.homeServices.recruitment(f.user.token,f.theme,'status');if(r.active?.phase==='available')return r.active;if(r.history.some(c=>c.id===id&&c.phase==='failed'))throw Error('recruitment failed');await new Promise(r=>setTimeout(r,10));}throw Error('recruitment timeout');}
for(const theme of ['pixel','origami'])test(theme+' autonomous patrol to real recruitment, arrival, receipt-backed work and one fee',{timeout:60000},async()=>{
 const f=await fixture(theme);try{
 assert.equal((await f.store.autonomy_observe(theme,await f.read())).eligible,false);await f.policy();const d=await f.read(),result=await f.service.agents.automatic(f.user.token,'steward',{theme,saveSlot:d.state.saveSlot,recruitment:{eligible:true,policy:{dailyBudget:10000}}});
 const g=result.recruitmentOffers[0];assert(g);assert.equal(g.candidateId,'yan');assert.equal(f.calls.find(c=>c.method==='steward').data.recruitment.policy.dailyBudget,8);
 await f.prepare(g.id,g.projectId,g.candidateId);
 const request={requestId:g.id,projectId:g.projectId,candidateId:g.candidateId,source:'primary'};
 await f.service.homeServices.recruitment(f.user.token,theme,'hire',request);await f.service.homeServices.recruitment(f.user.token,theme,'hire',request);
 const offer=await wait(f,g.id);assert.equal(f.calls.filter(c=>c.method==='recruit').length,1);assert.equal(offer.source,'primary');assert.equal(offer.autonomousDecision.runId,result.runId);assert.equal(offer.context.autonomousDecision.ledgerRunId,result.ledgerRunId);
 const contract=(await f.service.homeServices.recruitment(f.user.token,theme,'activate',{id:g.id})).contract;
 for(const operation of ['enable','hire_enable'])await f.action('commerce',operation);
 await f.action('commerce','hire_bind',{contractId:contract.id});
 await f.update(s=>{assert.equal(s.recruitment.active.id,contract.id);setWorldTheme(theme);const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0})),resident=createResidentRuntime({npcs,getState:()=>s,profile:i=>i===16?s.recruitment.active.profile:RESIDENTS[i],followPath,onChange(){},onEvent(){}}),runtime=createRecruitmentRuntime({state:()=>s,npcs,followPath,resident:()=>resident,visitors:()=>({boats:[],guests:[]}),onChange(){},onEvent(){}});
 runtime.reset();for(let i=0;i<9000&&!s.recruitment.active.hasArrived;i++)runtime.update(.1);assert(s.recruitment.active.hasArrived);
 });
 for(let i=0;i<5&&(await f.read()).state.agentTaskLedger.find(t=>t.npcId===16)?.remaining>0;i++){
  const d=await f.read(),t=d.state.agentTaskLedger.find(t=>t.npcId===16&&t.remaining>0);
  const start=await f.action('resident','begin',{actorId:16,gameTime:0,intent:{goal:'forest',action:'work',resource:'wood',buildingId:null,assignmentId:t.id,operationId:t.operationId}});
  f.advance(20000);await f.c.saves.action(theme,{kind:'resident',operation:'finish',requestId:start.ticket.requestId,epoch:start.ticket.epoch,sequence:start.ticket.sequence,expectedVersion:start.document.version});
 }
 const paid=await f.action('commerce','hire_handover',{contractId:contract.id});assert.equal(paid.receipt.details.fee,8);assert.equal(paid.document.state.inventory.wood,6);assert.equal(paid.document.state.coins,52);
 const final=await f.read();await finishVisit(f.store,final,contract);await f.update(s=>Object.assign(s,final.state));
 const observation=await f.store.autonomy_observe(theme,await f.read());assert.equal(observation.stats.attempts,1);assert.equal(observation.stats.committed,8);assert(!observation.eligible);
 await writeFile('qa/v76/'+theme+'-autonomy-proof.json',JSON.stringify({passed:true,decisionRunId:result.runId,decisionLedger:result.ledgerRunId,contractId:contract.id,parent:offer.runs[0].parent.id,child:offer.runs[0].child.id,modelNegotiationOnce:true,actualArrival:true,actualWork:6,fee:8,actualDeparture:true,quotaPersistent:true,scope:'Isolated owner, preloaded 60 coins, deterministic model runtime; actual actions and paths.'},null,2));
 }finally{await f.service.close();}
});
test('policy CAS, client forgery, stale plan, disabling and persistent expired-grant attempt quota',async()=>{
 const f=await fixture();try{await f.policy();
 const d=await f.read();await assert.rejects(f.service.homeServices.recruitment(f.user.token,'pixel','hire',{source:'primary',requestId:randomUUID(),projectId:'auto-plan',candidateId:'yan'}),e=>e.code==='recruitment_autonomy_stale');
 const result=await f.service.agents.automatic(f.user.token,'steward',{theme:'pixel',saveSlot:d.state.saveSlot}),g=result.recruitmentOffers[0];await f.prepare(g.id,g.projectId,g.candidateId);
 await f.policy({enabled:false});await assert.rejects(f.service.homeServices.recruitment(f.user.token,'pixel','hire',{source:'primary',requestId:g.id,projectId:g.projectId,candidateId:g.candidateId}),e=>e.code==='recruitment_autonomy_stale');
 const a=await f.store.autonomy_observe('pixel',await f.read());await assert.rejects(f.store.policy('pixel',await f.read(),{requestId:randomUUID(),expectedVersion:a.policy.version-1,input:{...a.policy,enabled:true}}),e=>e.code==='recruitment_conflict');
 const restored=createRecruitmentStore({directory:f.c.directory,now:()=>Date.now()+700000});const persisted=await restored.autonomy_observe('pixel',await f.read());assert.equal(persisted.policy.enabled,false);assert.equal(persisted.stats.attempts,1);assert.equal(persisted.stats.pending,0);
 }finally{await f.service.close();}
});

test('concurrent patrol decisions reserve one quota; altered project and stale policy cannot launch a child',async()=>{
 const f=await fixture();try{await f.policy();const doc=await f.read(),make=()=>({source:'hermes',model:'deepseek-flash',runId:'hd-island-'+randomUUID().replaceAll('-',''),ledgerRunId:'run-'+randomUUID(),recruitments:[{id:randomUUID(),projectId:'auto-plan',candidateId:'yan',reason:'仍缺六份木料，邀请职业合适的伙伴。'}]});
 const decisions=await Promise.all([f.store.autonomy_decide('pixel',doc,make()),f.store.autonomy_decide('pixel',doc,make())]);assert.equal(decisions.flatMap(d=>d.offers).length,1);const g=decisions.flatMap(d=>d.offers)[0];
 await f.prepare(g.id,g.projectId,g.candidateId);
 // An actual delivery changes the promised remaining work and invalidates the offer.
 const initial=await f.read(),job=await f.action('resident','begin',{actorId:0,gameTime:0,intent:{goal:'forest',action:'work',resource:'wood',buildingId:null}});f.advance(20000);
 await f.c.saves.action('pixel',{kind:'resident',operation:'finish',requestId:job.ticket.requestId,epoch:job.ticket.epoch,sequence:job.ticket.sequence,expectedVersion:job.document.version});assert((await f.read()).state.inventory.wood>initial.state.inventory.wood);

 await assert.rejects(f.service.homeServices.recruitment(f.user.token,'pixel','hire',{source:'primary',requestId:g.id,projectId:g.projectId,candidateId:g.candidateId}),e=>e.code==='recruitment_autonomy_stale');assert.equal(f.calls.filter(c=>c.method==='recruit').length,0);assert.equal((await f.read()).state.coins,60);
 f.advance(700000);const v=await f.store.autonomy_observe('pixel',await f.read());assert.equal(v.stats.attempts,1);assert.equal(v.stats.pending,0);
 }finally{await f.service.close();}
});
test('budget and operating floor refuse autonomous offers without changing manual recruitment',async()=>{
 const f=await fixture();try{await f.policy({coinFloor:55});const view=await f.store.autonomy_observe('pixel',await f.read());assert(!view.eligible);assert.match(view.reason,/底金/);
 const requestId=randomUUID();await f.prepare(requestId,'auto-plan','yan','user');await f.service.homeServices.recruitment(f.user.token,'pixel','hire',{requestId,projectId:'auto-plan',candidateId:'yan'});await wait(f,requestId);assert.equal(f.calls.filter(c=>c.method==='recruit').length,1);
 }finally{await f.service.close();}
});
