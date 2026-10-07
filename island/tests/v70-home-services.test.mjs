import {legacySaveKey} from '../src/saveStorage.js';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {createProject} from '../src/projectPlans.js';
export function proof(c){const id=randomUUID();return{source:'hermes',model:'deepseek-flash',parent:{id:'hd-parent-'+id,status:'completed',tools:['recruitment_delegate']},child:{id:'hd-child-'+id,parentId:'hd-parent-'+id,status:'completed',tools:['recruitment_take_step'],acceptedSteps:[c.steps.find(s=>s.item==='wood').id]},events:[{actor:'parent',tool:'recruitment_delegate',status:'done'},{actor:'child',tool:'recruitment_take_step',status:'done'}]};}
async function fixture(){
 await mkdir('qa/v70',{recursive:true});const directory=await mkdtemp(resolve('qa/v70/authority-')),calls=[],runtimes=[],gates=new Map();
 const s=await createLanHttpServer({directory,port:0,enrollmentKey:'HOME-SERVICE-TEST',agentRuntimeFactory:options=>{runtimes.push(options);return{documents:resolve(options.directory,'documents'),async call(method,args){calls.push({ownerId:options.ownerId,method,args});if(method==='status')return{};if(method==='cancelRecruit'){gates.get(options.ownerId)?.reject(Error('cancelled'));return{};}if(method==='recruit'){const gate=gates.get(options.ownerId);if(gate)await gate.promise;return proof(args.context);}if(method==='suggestParty'){const gate=gates.get(options.ownerId);if(gate)await gate.promise;return{guestId:4,reason:'莉安擅长花艺，适合花园主题。'};}return{};},async close(){gates.get(options.ownerId)?.reject(Error('closed'));}};}});
 const users=[];for(let i=0;i<2;i++){const a=await s.identities.register({login:'home_'+i,password:'private-fixture-password',name:'测试岛主'+i,islandName:'测试岛'+i,avatar:'male_0',theme:'pixel'});const c=await s.tenants.get(a.token);for(const theme of ['pixel','origami']){const state=hydrateTown(createZeroState());state.saveSlot=legacySaveKey(theme)+"-restart-"+a.view.me.id;state.freshStartPending=false;state.coins=20;assert(createProject(state,{id:'welcome',title:'迎宾灯',targets:{lantern:1}}).ok);await c.saves.open(theme,{legacyState:state});}users.push(a);}
 const req=async(n,path,data)=>{const r=await fetch('http://127.0.0.1:'+s.port+path,{method:data?'POST':'GET',headers:{Cookie:'hd_lan_session='+users[n].token,'X-HD-Island':users[n].view.me.id,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});return{status:r.status,data:await r.json()};};
 const hire=(n,op,data,theme='pixel')=>req(n,'/api/recruitment/'+theme+'/'+op,data);
 const draft=async(n,id=randomUUID())=>({requestId:id,worldKey:(await (await s.tenants.get(users[n].token)).saves.current('pixel')).state.saveSlot,expectedId:null,expectedVersion:null,input:{name:'花园海风小聚',description:'花园与海风的相聚',tags:['nature','sea'],difficulty:'easy'}});
 const hold=n=>{let accept,reject;const promise=new Promise((a,r)=>{accept=a;reject=r;});promise.catch(()=>{});const g={promise,accept,reject};gates.set(users[n].view.me.id,g);return g;};
 return{s,users,calls,runtimes,req,hire,draft,hold,gates,directory};
}
async function until(fn){for(let i=0;i<150;i++){const r=await fn();if(r)return r;await new Promise(r=>setTimeout(r,30));}throw Error('condition timed out');}
test('LAN hiring uses own disk plan, distinct runtimes, duplicate protection, actual registry and activation',async()=>{
 const f=await fixture();try{for(const theme of ['pixel','origami']){
 const input={requestId:'hire-'+theme,projectId:'welcome',context:{steps:[{id:'forged'}]},ownerId:f.users[1].view.me.id};
 const first=await f.hire(0,'hire',input,theme);assert.equal(first.status,200,JSON.stringify(first));assert.equal((await f.hire(0,'hire',input,theme)).data.replayed,true);
 const active=await until(async()=>{const r=await f.hire(0,'status',null,theme);return r.data.active?.phase==='available'&&r.data.active;});assert.equal(active.runs[0].child.acceptedSteps[0],'welcome:wood');
 assert.equal((await f.hire(1,'status',null,theme)).data.active,null);const wrong=await f.hire(1,'activate',{id:input.requestId},theme);assert.notEqual(wrong.status,200);
 assert.equal((await f.hire(0,'activate',{id:input.requestId},theme)).data.contract.phase,'active');
 const c=await f.s.tenants.get(f.users[0].token);const registry=JSON.parse(await readFile(resolve(c.directory,theme,'recruitment.json'),'utf8'));assert(JSON.stringify(registry).includes(active.runs[0].parent.id));assert.equal((await c.saves.current(theme)).state.coins,20);
 }assert.equal(f.calls.filter(c=>c.method==='recruit').length,2);for(const r of f.runtimes){assert(r.islandDirectory.includes('_lan'+String.fromCharCode(92)+'islands')||r.islandDirectory.includes('_lan/islands'));assert.notEqual(r.directory,r.islandDirectory);}
 }finally{await f.s.close();}
});
test('busy hiring excludes same-owner manual and theme planning; another owner proceeds; actual cancellation releases seat',async()=>{
 const f=await fixture();try{const gate=f.hold(0),body={requestId:'held-hire-one',projectId:'welcome'};assert.equal((await f.hire(0,'hire',body)).status,200);await until(()=>f.calls.some(c=>c.method==='recruit'));
 const busy=await f.req(0,'/api/parties/pixel/suggest',await f.draft(0));assert.equal(busy.data.code,'provider_busy');
 const manual=await f.req(0,'/api/lan/steward',{theme:'pixel',requestId:randomUUID(),message:'现在安排'});assert.equal(manual.status,409);
 const other=await f.req(1,'/api/parties/pixel/suggest',await f.draft(1));assert.equal(other.status,200);assert.equal(other.data.guestId,4);
 assert.equal((await f.hire(0,'cancel',{id:body.requestId})).data.contract.phase,'cancelling');await until(async()=>!(await f.hire(0,'status')).data.active);assert(f.calls.some(c=>c.method==='cancelRecruit'));
 f.gates.delete(f.users[0].view.me.id);assert.equal((await f.hire(0,'hire',{...body,requestId:'held-hire-two'})).status,200);await until(async()=>(await f.hire(0,'status')).data.active?.phase==='available');
 }finally{await f.s.close();}
});
test('party suggestions coalesce, use own world, reject changed input and cannot survive travel in flight',async()=>{
 const f=await fixture();try{const d=await f.draft(0);const [a,b]=await Promise.all([f.req(0,'/api/parties/pixel/suggest',d),f.req(0,'/api/parties/pixel/suggest',d)]);assert.equal(a.status,200);assert.equal(a.data.proposalId,b.data.proposalId);assert.equal(f.calls.filter(c=>c.method==='suggestParty').length,1);
 assert.equal((await f.req(0,'/api/parties/pixel/suggest',{...d,input:{...d.input,name:'不同活动'}})).status,409);
 const gate=f.hold(0),pending=f.req(0,'/api/parties/pixel/suggest',await f.draft(0));await until(()=>f.calls.filter(c=>c.method==='suggestParty').length===2);
 await f.s.identities.action(f.users[0].token,{operation:'room_create',requestId:randomUUID(),title:'临时会客',maxPlayers:2});gate.accept();assert.equal((await pending).data.code,'lan_travel_active');
 assert.equal((await f.hire(0,'hire',{requestId:'travel-hire',projectId:'welcome'})).data.code,'lan_travel_active');assert.equal((await f.hire(0,'status')).status,200);
 }finally{await f.s.close();}
});

test('candidate management is owner/theme scoped and recall cannot access another owner contract',async()=>{
 const f=await fixture();try{
 const input={name:'独立伙伴',roleId:'yan',appearance:'male_2',personality:'细致',backstory:'群岛来客'};
 const made=await f.hire(0,'candidate',{requestId:'owner-candidate',input});assert.equal(made.status,200);
 const edit={id:made.data.candidate.id,requestId:'owner-edit-one',expectedVersion:1,action:'edit',input:{...input,name:'甲岛伙伴'}};
 assert.equal((await f.hire(1,'candidate_manage',edit)).status,404);assert.equal((await f.hire(0,'candidate_manage',edit,'origami')).status,404);
 assert.equal((await f.hire(1,'candidate',{requestId:'owner-candidate',input})).status,200);
 assert.equal((await f.hire(0,'candidate_manage',edit)).status,200);
 assert.equal((await f.hire(0,'status')).data.candidateRecords[0].profile.name,'甲岛伙伴');
 assert.equal((await f.hire(1,'status')).data.candidateRecords[0].profile.name,'独立伙伴');
 const hire={requestId:'owner-hire-one',projectId:'welcome',candidateId:made.data.candidate.id};assert.equal((await f.hire(0,'hire',hire)).status,200);await until(async()=>(await f.hire(0,'status')).data.active?.phase==='available');
 const foreign=await f.hire(1,'recall',{id:hire.requestId,requestId:'foreign-recall',projectId:'welcome'});assert.equal(foreign.status,404);
 assert.equal(f.calls.filter(c=>c.method==='recruit').length,1);
 }finally{await f.s.close();}
});
