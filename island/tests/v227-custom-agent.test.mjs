import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCoCreationStore} from '../server/cocreationStore.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,purposeOptions,career,needs} from '../src/townSimulation.js';
import {BUILDINGS} from '../src/world.js';
import {catalogRecipe,catalogItem,ALL_RECIPES,RAW_MATERIALS} from '../src/contentCatalog.js';
import {taskDecision} from '../server/planningAuthority.mjs';
import {customItemId,customRecipeId} from '../src/customContent.js';
import {pack,image} from './v224-content-fixtures.mjs';
import {RESIDENTS} from '../src/world.js';
import {agentCatalogContext} from '../server/agentCatalogContext.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {resolve} from 'node:path';

async function fixture(theme='pixel'){
 const directory=await mkdtemp(join(tmpdir(),'hd-agent-catalog-'));let clock=1000000,attached=true,saves;
 const co=createCoCreationStore({directory,now:()=>clock,catalogBaseline:async t=>(await saves.current(t))?.state.customCatalog||null,worldExists:async(t,key)=>(await saves.current(t))?.state.saveSlot===key});
 saves=createSaveStore({directory,now:()=>clock,contentProvider:(t,world)=>attached?co.catalog(t,world):null});
 const seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.saveSlot='hyper-dimension-'+theme+'-v3-restart-'+randomUUID();Object.assign(seed.inventory,{wood:50,resin:50,fiber:50});
 await saves.open(theme,{legacyState:seed,protect:true});
 const current=()=>saves.current(theme),call=async(kind,operation,fields={})=>{const d=await current();return saves.action(theme,{kind,operation,requestId:randomUUID(),day:d.state.day,expectedVersion:d.version,expectedSequence:d.actions.sequence,epoch:d.actions.epoch,...fields});};
 const manage=async(operation,fields={})=>co.action(theme,{operation,requestId:randomUUID(),expectedVersion:(await co.current(theme)).version,...fields});
 const publish=async(p=pack())=>{const c=await co.current(theme);await manage(c.packages[p.id]?'edit':'import',{packageId:p.id,pack:p});const v=(await co.current(theme)).packages[p.id].versions.at(-1);await co.assets.put(image);await manage('submit',{packageId:p.id,version:v.number,hash:v.hash});await manage('review',{packageId:p.id,version:v.number,hash:v.hash,decision:'approve',note:'核对配套双风格素材与材料链。'});await manage('activate',{packageId:p.id,version:v.number,hash:v.hash,worldKey:(await current()).state.saveSlot});return v;};
 const finish=async r=>{clock=Math.max(clock,r.ticket.readyAt)+1;return call('resident','finish',{requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence});};
 return{directory,co,saves,theme,current,call,publish,finish,detach:()=>{attached=false;},reattach:()=>{attached=true;},reopen:()=>createSaveStore({directory,now:()=>clock,contentProvider:(t,world)=>attached?co.catalog(t,world):null})};
}
const work=(f,recipeId,extra={})=>f.call('resident','begin',{actorId:1,intent:{goal:BUILDINGS[11].kind,buildingId:11,action:'work',recipeId,source:'deepseek',...extra}});
async function runProject(f,id,limit=40){
 for(let round=0;round<limit;round++){
  const d=await f.current(),p=d.state.workProjects.find(p=>p.id===id);if(p.status==='ready')return d;
  const task=d.state.agentTaskLedger.find(t=>t.projectId===id&&t.status==='queued'&&!t.blocked&&t.dependsOn.every(id=>d.state.agentTaskLedger.find(x=>x.id===id)?.status==='done'));assert(task,'The authoritative plan must provide an executable physical prerequisite');
  const decision=taskDecision(d.state,task,{reserve:false}),started=await f.call('resident','begin',{actorId:task.npcId,intent:{...decision,action:'work',assignmentId:task.id}});await f.finish(started);
 }
 throw Error('Custom project did not become ready');
}

for(const theme of ['pixel','origami'])test(theme+' NPC accepts the reviewed custom recipe, pins its bill and settles once after republish/reopen',async()=>{
 const f=await fixture(theme);await f.publish();const id=customRecipeId(pack().id,'seal'),item=customItemId(pack().id,'seal');
 const begun=await work(f,id);assert.equal(begun.ticket.recipeContract.version,2);assert.equal(begun.ticket.mode,'craft');assert.equal(begun.ticket.item,item);
 const revised=pack();revised.content.recipes[0].cost.wood=5;await f.publish(revised);const reopened=await f.reopen().current(theme);assert.equal(reopened.actions.resident.leases[begun.ticket.requestId].recipeContract.definition.cost.wood,2);
 const done=await f.finish(begun);assert.equal(done.receipt.cost.wood,2);assert.equal(done.document.state.inventory.wood,48);assert.equal(done.document.state.inventory[item],1);assert.equal(done.document.state.craftHistory[id],1);
 const replay=await f.call('resident','finish',{requestId:begun.ticket.requestId,epoch:begun.ticket.epoch,sequence:begun.ticket.sequence});assert.equal(replay.replayed,true);assert.equal(replay.document.version,done.document.version);
 assert.equal(done.document.state.coins,0);assert.equal(ALL_RECIPES.length,308);assert.equal(RAW_MATERIALS.length,58);
});

test('a Hermes assignment prepares the custom prerequisite/component before crediting the requested product',async()=>{
 const f=await fixture();await f.publish();await f.call('commerce','plan_enable');const recipeId=customRecipeId(pack().id,'letter'),seal=customRecipeId(pack().id,'seal'),item=customItemId(pack().id,'letter');
 let r=await f.call('commerce','plan_batch',{commands:[{id:'custom-letter-order',npcId:1,goal:BUILDINGS[11].kind,buildingId:11,recipeId,intent:'准备一封旅人问候信',quantity:1}]});
 let task=r.document.state.agentTaskLedger.find(t=>t.id==='custom-letter-order');assert(task,'An eligible prerequisite chain must be accepted as a task, without granting its output');
 let decision=taskDecision(r.document.state,task,{reserve:false});assert.equal(decision.recipeId,seal);assert.equal(decision.preparing,true);
 r=await f.call('resident','begin',{actorId:1,intent:{...decision,action:'work',assignmentId:task.id}});r=await f.finish(r);task=r.document.state.agentTaskLedger.find(t=>t.id==='custom-letter-order');assert.equal(task.completed,0);assert.equal(r.document.state.inventory[item]||0,0);
 decision=taskDecision(r.document.state,task,{reserve:false});assert.equal(decision.recipeId,recipeId);r=await f.call('resident','begin',{actorId:1,intent:{...decision,action:'work',assignmentId:task.id}});r=await f.finish(r);
 task=r.document.state.agentTaskLedger.find(t=>t.id==='custom-letter-order');assert.equal(task.status,'done');assert.equal(task.completed,1);assert.equal(r.document.state.inventory[item],1);assert.equal(r.document.state.inventory[customItemId(pack().id,'seal')],0);
 assert.equal(r.document.state.inventory.wood,48);assert.equal(r.document.state.inventory.resin,49);assert.equal(r.document.state.inventory.fiber,48);assert.equal(r.document.state.coins,0);
});

test('a custom project with a long valid item identity retains bounded stable task IDs and its full target identity',async()=>{
 const f=await fixture(),p=pack();p.id='opc-long-content-collection-abcd';p.content.items[0].id='component-long-code-aa';p.content.items[1].id='gift-with-long-code-aa';p.content.recipes[0]={id:p.content.items[0].id,item:p.content.items[0].id,cost:{wood:2,resin:1},requires:[]};p.content.recipes[1]={id:p.content.items[1].id,item:p.content.items[1].id,cost:{['@'+p.content.items[0].id]:1,fiber:2},requires:['@'+p.content.items[0].id]};p.challenges[0].recipeId=customRecipeId(p.id,p.content.items[1].id);
 await f.publish(p);await f.call('commerce','plan_enable');const item=customItemId(p.id,p.content.items[0].id),id='p'.repeat(60);assert(id.length+1+item.length>110);
 let r=await f.call('commerce','plan_create',{project:{id,title:'准备共创组件',targets:{[item]:1}}});const task=r.document.state.agentTaskLedger.find(t=>t.projectId===id&&t.targetItem===item);assert(task);assert(task.id.length<=110);
 const original=task.id,d=await f.reopen().current(f.theme);assert.equal(d.state.agentTaskLedger.find(t=>t.projectId===id&&t.targetItem===item).id,original);
 const decision=taskDecision(d.state,task,{reserve:false});r=await f.call('resident','begin',{actorId:task.npcId,intent:{...decision,action:'work',assignmentId:task.id}});r=await f.finish(r);assert.equal(r.document.state.workProjects.find(p=>p.id===id).status,'ready');assert.equal(r.document.state.inventory[item],1);
});

test('detaching a catalog permits only the accepted custom job to finish and keeps other islands isolated',async()=>{
 const f=await fixture();await f.publish();const id=customRecipeId(pack().id,'seal'),item=customItemId(pack().id,'seal'),begun=await work(f,id);f.detach();
 await assert.rejects(f.call('resident','begin',{actorId:2,intent:{goal:BUILDINGS[11].kind,buildingId:11,action:'work',recipeId:id}}),e=>e.code==='resident_invalid');const done=await f.finish(begun);assert.equal(done.document.state.inventory[item],1);assert.equal(done.document.state.inventory.wood,48);
 const other=await fixture();await assert.rejects(work(other,id));assert.equal((await other.current()).state.inventory[item],undefined);
});

test('revocation between observation and a resident begin cannot use a stale accepted catalog',async()=>{
 const f=await fixture();await f.publish();const d=await f.current();f.detach();
 await assert.rejects(f.saves.action(f.theme,{kind:'resident',operation:'begin',actorId:1,intent:{goal:BUILDINGS[11].kind,buildingId:11,action:'work',recipeId:customRecipeId(pack().id,'seal')},requestId:randomUUID(),expectedVersion:d.version,expectedSequence:d.actions.sequence,epoch:d.actions.epoch}),e=>e.code==='resident_invalid');
 const after=await f.current();assert.equal(after.state.inventory.wood,50);assert.equal(after.actions.resident.leases&&Object.keys(after.actions.resident.leases).length,0);assert.equal(after.state.craftHistory[customRecipeId(pack().id,'seal')]||0,0);
});

test('published empty custom inventory survives browser hydration and a protected save without repeated reconciliation',async()=>{
 const f=await fixture();await f.publish();const d=await f.current(),item=customItemId(pack().id,'letter');assert.equal(d.state.inventory[item],0);
 const hydrated=hydrateTown(structuredClone(d.state)),saved=await f.saves.save(f.theme,{state:hydrated,expectedVersion:d.version});assert.equal(saved.document.state.inventory[item],0);assert.equal(saved.document.state.coins,d.state.coins);
 const reopened=await f.reopen().current(f.theme);await f.saves.save(f.theme,{state:hydrateTown(structuredClone(reopened.state)),expectedVersion:reopened.version});assert.equal((await f.current()).state.inventory[item],0);
});

test('catalog resolvers and project input reject inherited object keys',()=>{
 for(const id of ['constructor','__proto__','prototype','toString']){assert.equal(catalogRecipe({},id),null);assert.equal(catalogItem({},id),null);}
});

test('a formal custom project schedules an actual prerequisite craft before unlocking its final product',async()=>{
 const f=await fixture();await f.publish();await f.call('commerce','plan_enable');const item=customItemId(pack().id,'letter');
 let r=await f.call('commerce','plan_create',{project:{id:'formal-letter-chain',title:'筹备共创信笺',targets:{[item]:1}}});
 assert.equal(r.document.state.inventory[item]||0,0);assert.equal(r.document.state.workProjects.find(p=>p.id==='formal-letter-chain').status,'preparing');
 for(let round=0;round<4;round++){
  const d=await f.current(),p=d.state.workProjects.find(p=>p.id==='formal-letter-chain');if(p.status==='ready')break;
  const task=d.state.agentTaskLedger.find(t=>t.projectId===p.id&&t.status==='queued'&&!t.blocked&&t.dependsOn.every(id=>d.state.agentTaskLedger.find(x=>x.id===id)?.status==='done'));assert(task,'A prerequisite/component must be available before the final product');
  const decision=taskDecision(d.state,task,{reserve:false});r=await f.call('resident','begin',{actorId:task.npcId,intent:{...decision,action:'work',assignmentId:task.id}});await f.finish(r);
 }
 const d=await f.current();assert.equal(d.state.workProjects.find(p=>p.id==='formal-letter-chain').status,'ready');assert.equal(d.state.inventory[item],1);assert.equal(d.state.inventory[customItemId(pack().id,'seal')],0);assert.equal(d.state.inventory.wood,48);assert.equal(d.state.inventory.resin,49);assert.equal(d.state.inventory.fiber,48);
});

test('a prerequisite not consumed by its final recipe still requires an actual craft',async()=>{
 const f=await fixture(),p=pack();p.content.recipes[1].cost={fiber:2};await f.publish(p);await f.call('commerce','plan_enable');const item=customItemId(p.id,'letter');
 await f.call('commerce','plan_create',{project:{id:'unlock-only',title:'先完成前置练习',targets:{[item]:1}}});const d=await runProject(f,'unlock-only');
 assert.equal(d.state.inventory[item],1);assert.equal(d.state.inventory[customItemId(p.id,'seal')],1);assert.equal(d.state.craftHistory[customRecipeId(p.id,'seal')],1);assert.equal(d.state.inventory.wood,48);assert.equal(d.state.inventory.resin,49);assert.equal(d.state.inventory.fiber,48);
});

test('a shared prerequisite is produced once when another target will consume that same component',async()=>{
 const f=await fixture(),p=pack();p.content.recipes[1].cost={fiber:2};p.content.items.push({...structuredClone(p.content.items[1]),id:'stamp',name:'岛屿纪念邮票'});p.content.recipes.push({id:'stamp',item:'stamp',cost:{'@seal':1,wood:1},requires:['@seal']});await f.publish(p);await f.call('commerce','plan_enable');
 const letter=customItemId(p.id,'letter'),stamp=customItemId(p.id,'stamp');await f.call('commerce','plan_create',{project:{id:'shared-unlock',title:'共用一次前置制作',targets:{[letter]:1,[stamp]:1}}});const d=await runProject(f,'shared-unlock');
 assert.equal(d.state.craftHistory[customRecipeId(p.id,'seal')],1);assert.equal(d.state.inventory[letter],1);assert.equal(d.state.inventory[stamp],1);assert.equal(d.state.inventory[customItemId(p.id,'seal')],0);assert.equal(d.state.inventory.wood,47);assert.equal(d.state.inventory.resin,49);assert.equal(d.state.inventory.fiber,48);
});

test('a valid twelve-recipe custom dependency chain completes without silently granting intermediate crafts',async()=>{
 const f=await fixture(),p=pack(),art=p.content.items[0].art;p.content.items=[];p.content.recipes=[];
 for(let i=0;i<12;i++){const id='stage-'+i;p.content.items.push({id,name:'工序'+i,category:i===11?'gift':'component',building:11,tier:0,description:'逐项实际加工的依赖链',art:structuredClone(art)});p.content.recipes.push({id,item:id,cost:{wood:1,...i>0?{['@stage-'+(i-1)]:1}:{}},requires:i>0?['@stage-'+(i-1)]:[]});}
 p.challenges[0].recipeId=customRecipeId(p.id,'stage-11');await f.publish(p);await f.call('commerce','plan_enable');const item=customItemId(p.id,'stage-11');await f.call('commerce','plan_create',{project:{id:'deep-custom-chain',title:'完成十二道工序',targets:{[item]:1}}});const d=await runProject(f,'deep-custom-chain');
 assert.equal(d.state.inventory[item],1);assert.equal(d.state.inventory.wood,38);for(let i=0;i<12;i++){assert.equal(d.state.craftHistory[customRecipeId(p.id,'stage-'+i)],1);if(i<11)assert.equal(d.state.inventory[customItemId(p.id,'stage-'+i)],0);}
});

test('an accepted project craft ignores newly published inputs and unlocks until that original delivery finishes',async()=>{
 const f=await fixture();await f.publish();await f.call('commerce','plan_enable');const item=customItemId(pack().id,'seal');let r=await f.call('commerce','plan_create',{project:{id:'accepted-bill',title:'接单后保留原账单',targets:{[item]:1}}});
 const task=r.document.state.agentTaskLedger.find(t=>t.projectId==='accepted-bill'),decision=taskDecision(r.document.state,task,{reserve:false});const begun=await f.call('resident','begin',{actorId:task.npcId,intent:{...decision,action:'work',assignmentId:task.id}});
 const p=pack();p.content.items.push({...structuredClone(p.content.items[0]),id:'primer',name:'新前置样张'});p.content.recipes.push({id:'primer',item:'primer',cost:{fiber:1},requires:[]});p.content.recipes[0].cost.wood=5;p.content.recipes[0].requires=['@primer'];await f.publish(p);
 r=await f.finish(begun);assert.equal(r.receipt.cost.wood,2);assert.equal(r.document.state.inventory.wood,48);assert.equal(r.document.state.inventory[item],1);assert.equal(r.document.state.inventory[customItemId(p.id,'primer')],0);assert.equal(r.document.state.workProjects.find(p=>p.id==='accepted-bill').status,'ready');
});

test('disabled catalogs make unfinished project and command tasks wait without reporting unmade work as done',async()=>{
 const f=await fixture();await f.publish();await f.call('commerce','plan_enable');const item=customItemId(pack().id,'letter');await f.call('commerce','plan_create',{project:{id:'await-publication',title:'等待作品重新启用',targets:{[item]:1}}});
 await f.call('commerce','plan_batch',{commands:[{id:'await-command',npcId:1,goal:BUILDINGS[11].kind,buildingId:11,recipeId:customRecipeId(pack().id,'seal'),quantity:1,intent:'等待重新启用的组件配方'}]});f.detach();const paused=await f.current();
 for(const task of paused.state.agentTaskLedger.filter(t=>t.projectId==='await-publication'||t.id==='await-command')){assert.notEqual(task.status,'done');assert.equal(task.status,'waiting');assert(task.blocked);assert.equal(task.completed,0);}
 f.reattach();let d=await f.current();assert.equal(d.state.agentTaskLedger.find(t=>t.id==='await-command').status,'queued');d=await runProject(f,'await-publication');assert.equal(d.state.inventory[item],1);
});

test('accepted prerequisite work remains deliverable while its absent parent recipe waits for publication',async()=>{
 const f=await fixture();await f.publish();await f.call('commerce','plan_enable');const item=customItemId(pack().id,'letter');
 let r=await f.call('commerce','plan_create',{project:{id:'accepted-prerequisite',title:'保留已接单的前置工作',targets:{[item]:1}}});const task=r.document.state.agentTaskLedger.find(t=>t.projectId==='accepted-prerequisite'&&t.status==='queued'),decision=taskDecision(r.document.state,task,{reserve:false});
 const begun=await f.call('resident','begin',{actorId:task.npcId,intent:{...decision,action:'work',assignmentId:task.id}});f.detach();r=await f.current();assert.equal(r.state.agentTaskLedger.find(t=>t.id===task.id).status,'running');
 r=await f.finish(begun);assert.equal(r.document.state.inventory[customItemId(pack().id,'seal')],1);assert.equal(r.document.state.inventory[item],0);assert.equal(r.document.state.agentTaskLedger.find(t=>t.targetItem===item).status,'waiting');
 f.reattach();const d=await runProject(f,'accepted-prerequisite');assert.equal(d.state.inventory[item],1);assert.equal(d.state.craftHistory[customRecipeId(pack().id,'seal')],1);
});

test('autonomous custom purposes follow trades, prepare actual prerequisites and stop at stock, lease and daily limits',async()=>{
 const f=await fixture();await f.publish();const s=(await f.current()).state,letter=customItemId(pack().id,'letter'),seal=customItemId(pack().id,'seal');
 for(let id=0;id<16;id++)Object.assign(needs(id,s),{energy:100,hunger:100,social:100});
 const custom=id=>purposeOptions(id,s,RESIDENTS[id],100).filter(o=>o.purposeId.startsWith('custom:'));
 assert.equal(custom(1).length,0,'A woodworker does not invent a postal trade');const option=custom(10)[0];assert.equal(option.item,letter);assert.equal(option.recipeId,customRecipeId(pack().id,'seal'));assert.equal(option.preparing,true);
 s.inventory[letter]=1;s.inventory[seal]=2;assert.equal(custom(10).length,0,'Reserved stock still counts against the sample ceiling');
 s.inventory[letter]=0;s.inventory[seal]=1;s.residentControl={version:1,leases:[{mode:'craft',item:letter},{mode:'craft',item:seal}]};assert.equal(custom(10).length,0,'Accepted output must not be commissioned twice');delete s.residentControl;
 career(10,s).history=[0,1].map(n=>({day:s.day,action:'work',purposeId:'custom:prior-'+n}));assert.equal(custom(10).length,0);s.day++;assert(custom(10).length>0);
 f.detach();assert.equal(purposeOptions(10,(await f.current()).state,RESIDENTS[10],100).filter(o=>o.purposeId.startsWith('custom:')).length,0);
});

test('canonical autonomous sample admission rejects duplicate in-flight purposes and stale overstock starts',async()=>{
 const f=await fixture();await f.publish();let d=await f.current();const purposeId='custom:'+customRecipeId(pack().id,'letter'),select=id=>purposeOptions(id,d.state,RESIDENTS[id],100).find(o=>o.purposeId===purposeId);
 const first=select(10);assert(first);const begun=await f.call('resident','begin',{actorId:10,intent:first});await assert.rejects(f.call('resident','begin',{actorId:15,intent:first}),e=>e.code==='resident_plan_changed');await f.finish(begun);
 d=await f.current();const final=select(15);assert.equal(final.recipeId,customRecipeId(pack().id,'letter'));await f.finish(await f.call('resident','begin',{actorId:15,intent:final}));
 await assert.rejects(f.call('resident','begin',{actorId:10,intent:first}),e=>e.code==='resident_plan_changed');assert.equal((await f.current()).state.inventory[customItemId(pack().id,'letter')],1);
});

test('formal project steps take priority over speculative sample production by another resident',async()=>{
 const f=await fixture();await f.publish();await f.call('commerce','plan_enable');await f.call('commerce','plan_create',{project:{id:'formal-first',title:'先满足岛主明确的分工',targets:{[customItemId(pack().id,'letter')]:1}}});
 const d=await f.current();for(const id of [10,15])assert.equal(purposeOptions(id,d.state,RESIDENTS[id],100).filter(o=>o.purposeId.startsWith('custom:')).length,0);
 const done=await runProject(f,'formal-first');assert.equal(done.state.inventory[customItemId(pack().id,'letter')],1);assert.equal(done.state.craftHistory[customRecipeId(pack().id,'seal')],1);assert.equal(done.state.craftHistory[customRecipeId(pack().id,'letter')],1);
});

test('model world context retains full custom identities and true prerequisite readiness without importing author permissions',async()=>{
 const f=await fixture();await f.publish();const s=(await f.current()).state,fields=agentCatalogContext(s),item=customItemId(pack().id,'letter'),recipeId=customRecipeId(pack().id,'letter');
 const keys=['DEEPSEEK_API_KEY','HD_SAVE_DIR','HD_RUN_LEDGER_DIR','HD_ARTIFACT_DIR','HD_HERMES_HOME','HD_STEWARD_WORKDIR','HD_DOCUMENT_ROOT'],previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));process.env.DEEPSEEK_API_KEY='';for(const key of keys.slice(1))process.env[key]=join(f.directory,key.toLowerCase());
 let service;
 try{
  service=await import('../server/agentService.mjs');assert.equal(service.agentStatus().deepseek.configured,false);
  const world=service.cleanWorld({saveSlot:s.saveSlot,...fields,recipes:[],inventory:{[item]:2,constructor:20},projects:[{id:'postal-demo',targets:{[item]:1,constructor:1},held:{[item]:1}}],taskBoard:[{id:'postal-task',targetItem:item,quantity:1}]});
  assert.equal(world.inventory[item],2);assert.equal(Object.hasOwn(world.inventory,'constructor'),false);assert.deepEqual(world.projects[0].targets,{[item]:1});assert.equal(world.taskBoard[0].targetItem,item);
  const r=world.recipes.find(r=>r.id===recipeId);assert(r);assert.equal(r.ready,false);assert.deepEqual(r.requires,[customRecipeId(pack().id,'seal')]);assert.equal(r.cost[customItemId(pack().id,'seal')],1);assert.equal(world.customItems.find(i=>i.id===item).enabled,true);
  const other=service.cleanWorld({saveSlot:'another-world',...fields,recipes:[recipeId],inventory:{[item]:2}});assert.deepEqual(other.customItems,[]);assert.deepEqual(other.inventory,{});assert.equal(other.recipes.length,0);
  f.detach();const inactive=service.cleanWorld({saveSlot:s.saveSlot,...agentCatalogContext((await f.current()).state),recipes:[]});assert.equal(inactive.recipes.length,0);assert.equal(inactive.customItems.find(i=>i.id===item).enabled,false);
 }finally{await service?.stopAgentWorkers();for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});

test('LAN manual and automatic Agents receive this owner canonical publication instead of a submitted foreign catalog',async()=>{
 const calls=[],directory=await mkdtemp(join(await realpath(tmpdir()),'hd-agent-catalog-lan-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'FICTIONAL-CATALOG',agentRuntimeFactory:({directory})=>({documents:resolve(directory,'documents'),async call(method,args){calls.push({method,args});return {source:'hermes',answer:'受控测试运行端；没有实际模型调用',commands:[],decisions:[],operations:[]};},async close(){}})});
 try{
  const account=await service.identities.register({login:'catalog_author',password:'fictional-catalog-password',name:'虚构共创岛主',islandName:'共创模型岛',avatar:'male_0',theme:'pixel'}),other=await service.identities.register({login:'catalog_other',password:'fictional-catalog-password',name:'虚构邻岛',islandName:'未发布邻岛',avatar:'male_0',theme:'pixel'});
  await service.tenants.open(account.token,'pixel');await service.tenants.open(other.token,'pixel');const c=await service.tenants.get(account.token),s=(await c.saves.current('pixel')).state,manage=async(operation,fields={})=>c.cocreation.action('pixel',{operation,requestId:randomUUID(),expectedVersion:(await c.cocreation.current('pixel')).version,...fields}),p=pack();
  await manage('import',{packageId:p.id,pack:p});await c.cocreation.assets.put(image);const v=(await c.cocreation.current('pixel')).packages[p.id].versions[0];await manage('submit',{packageId:p.id,version:v.number,hash:v.hash});await manage('review',{packageId:p.id,version:v.number,hash:v.hash,decision:'approve',note:'验证模型仅观察本岛真实启用的共创配方'});await manage('activate',{packageId:p.id,version:v.number,hash:v.hash,worldKey:s.saveSlot});
  await service.agents.wait(account.token,{theme:'pixel',saveSlot:s.saveSlot,requestId:randomUUID(),message:'观察本岛共创配方',customCatalog:{forged:true}});const manual=calls.find(c=>c.method==='command');assert.equal(manual.args.customCatalog.recipes.length,2);assert(manual.args.customPreparableRecipes.includes(customRecipeId(p.id,'letter')));
  await service.agents.automatic(account.token,'plans',{theme:'pixel',saveSlot:s.saveSlot,residents:[],customCatalog:null});assert.equal(calls.find(c=>c.method==='plans').args.customCatalog.recipes.length,2);
  const otherState=(await (await service.tenants.get(other.token)).saves.current('pixel')).state;await service.agents.wait(other.token,{theme:'pixel',saveSlot:otherState.saveSlot,requestId:randomUUID(),message:'观察邻岛',...agentCatalogContext((await c.saves.current('pixel')).state)});
  const foreign=calls.filter(c=>c.method==='command').at(-1).args;assert.equal(foreign.customCatalog,null);assert.deepEqual(foreign.customPreparableRecipes,[]);
 }finally{await service.close();}
});
