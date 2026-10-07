import assert from'node:assert/strict';import{mkdir,mkdtemp,writeFile}from'node:fs/promises';import{resolve}from'node:path';import{randomUUID,createHash}from'node:crypto';
import{createZeroState}from'../src/freshStart.js';import{hydrateTown}from'../src/townSimulation.js';import{ITEM_BY_ID}from'../src/contentCatalog.js';import{createSaveStore}from'../server/saveStore.mjs';import{createRecruitmentStore}from'../server/recruitmentStore.mjs';import{partyDraftStamp,eventRequests}from'../src/partyPlanning.js';import{taskDecision}from'../server/planningAuthority.mjs';
import{fishingSpots}from'../src/fishingPartyRuntime.js';import{coutureTarget}from'../src/coutureLayout.js';import{fireworksTarget}from'../src/fireworksLayout.js';import{NIGHT_PARTY_SPOTS}from'../src/nightPartyRuntime.js';
import{applyFishingEvent}from'../src/fishingReplay.js';import{applyMarketEvent}from'../src/marketRules.js';import{applyCoutureEvent,coutureSolutions,coutureReview,currentCoutureBrief}from'../src/coutureRules.js';import{applyFireworksEvent,currentFireworksAct,fireworksWind}from'../src/fireworksRules.js';import{applyNightPartyEvent,nightLight}from'../src/nightPartyReplay.js';
export const CONFIG={night:{field:'nightParty',prefix:'night',kind:'party'},fishing:{field:'fishingParty',prefix:'fish',kind:'fishing'},market:{field:'festivalParty',prefix:'festival',kind:'festival'},couture:{field:'coutureParty',prefix:'couture',kind:'couture'},fireworks:{field:'fireworksParty',prefix:'fireworks',kind:'fireworks'}};
export function fixtureProof(context){const token=createHash('sha256').update(randomUUID()).digest('hex').slice(0,32);return{source:'hermes',model:'deepseek-flash',parent:{id:'hd-parent-'+token,status:'completed',tools:['recruitment_delegate']},child:{id:'hd-child-'+token,parentId:'hd-parent-'+token,status:'completed',tools:['recruitment_take_step'],acceptedSteps:context.steps.filter(t=>['wood','resin'].includes(t.item)).slice(0,1).map(t=>t.id)},events:[{actor:'parent',tool:'recruitment_delegate',status:'done'},{actor:'child',tool:'recruitment_take_step',status:'done'}]};}
export async function fixture(template,theme='pixel',{proof=fixtureProof,nonTargetStock=20}={}){
 await mkdir('qa/v92',{recursive:true});let now=1791310000000;const directory=await mkdtemp(resolve('qa/v92/'+template+'-'+theme+'-')),store=createSaveStore({directory,now:()=>now}),registry=createRecruitmentStore({directory}),s=hydrateTown(createZeroState());
 s.freshStartPending=false;s.coins=140;for(const id of Object.keys(ITEM_BY_ID))s.inventory[id]=nonTargetStock;for(const f of Object.values(s.facilities))f.quality=65;s.roomGames[4]={plays:5};
 if(template==='night'){s.inventory.lantern=0;s.inventory.wood=0;}else{s.inventory.c8_2=0;s.inventory.resin=0;}
 await store.open(theme,{legacyState:s});const config=CONFIG[template],current=()=>store.current(theme),call=async(kind,operation,extra={})=>{const d=await current();return store.action(theme,{kind,operation,requestId:randomUUID(),expectedVersion:d.version,expectedSequence:d.actions?.sequence||0,epoch:d.actions?.epoch||null,day:d.state.day,...extra});},manage=async(op,extra={})=>{const d=await current(),draft=d.state[config.field]?.draft;return call('commerce',op,{eventId:draft?.id??null,eventVersion:draft?.version??null,eventStamp:partyDraftStamp(draft),...extra});},save=async edit=>{const d=await current(),s=structuredClone(d.state);edit(s);return store.save(theme,{state:s,expectedVersion:d.version});},other=()=>createSaveStore({directory,now:()=>now});
 const f={template,theme,config,directory,store,registry,current,call,manage,save,other,advance:n=>now+=n};
 for(const op of ['enable','hire_enable','plan_enable',config.prefix+'_enable'])await manage(op);
 await manage(config.prefix+'_create',{proposal:{template,name:'伙伴的'+({night:'星灯之夜',fishing:'海风钓会',market:'手作集市',couture:'穿搭秀',fireworks:'星海烟花'})[template],description:'认真分工，亲自邀请，一起完成相聚。',tags:['stars'],difficulty:'normal',guestId:null,...(template==='night'?{fireworks:false}:{})}});
 const plan=await manage(config.prefix+'_plan');f.projectId=plan.receipt.details.project.id;
 const c=(await registry.start(theme,await current(),{requestId:randomUUID(),candidateId:'mai',projectId:f.projectId})).contract,run=await proof(c.context);
 assert(run.child.acceptedSteps.length);await registry.complete(theme,c.id,c.attempt,run);f.contract=(await registry.activate(theme,await current(),c.id)).contract;f.run=run;
 await call('commerce','hire_bind',{contractId:c.id});
 // Fixture starts after the real ferry simulation; transport is covered separately.
 await save(s=>{s.recruitment.active.phase='working';s.recruitment.active.hasArrived=true;});
 return f;
}
export async function produce(f,{all=true}={}){
 let operations=0;for(let guard=0;guard<30;guard++){
  const d=await f.current(),t=d.state.agentTaskLedger.find(t=>t.projectId===f.projectId&&t.remaining>0&&!t.blocked&&['queued','waiting','running'].includes(t.status)&&(t.dependsOn||[]).every(id=>d.state.agentTaskLedger.find(x=>x.id===id)?.status==='done')&&(all||t.npcId===16));if(!t)break;
  const decision=taskDecision(d.state,t,{reserve:false});assert(['forest','workshop','gallery'].includes(decision.goal),'fixture supplies non-target resources, unhandled goal '+decision.goal);
  const begin=await f.call('resident','begin',{actorId:t.npcId,intent:{...decision,assignmentId:t.id}});
  f.advance(20000);await f.call('resident','finish',{requestId:begin.ticket.requestId,epoch:begin.ticket.epoch,sequence:begin.ticket.sequence});operations++;
 }
 return operations;
}
export async function start(f){
 const d=await f.current(),draft=d.state[f.config.field].draft;
 for(const r of eventRequests(draft))await f.manage(f.config.prefix+'_invite',{npcId:r.id});
 const p=await f.current(),e=p.state[f.config.field].draft;
 return f.call(f.config.kind,'begin',{eventId:e.id,eventVersion:e.version,eventStamp:partyDraftStamp(e),...(f.template==='night'?{fireworks:e.fireworks}:{})});
}
export async function place(f){
 await f.save(s=>{
  s.npcPresence=[];const g=f.template==='night'?s.partySession:s[f.config.field].session;const people=f.template==='night'?g.participants:g.participants.map(p=>p.id),field=f.template==='market'?'festivalAttendance':f.template+'Attendance';s[field]={id:g.id,people:{}};
  const spot=id=>f.template==='night'?NIGHT_PARTY_SPOTS[Math.max(0,people.indexOf(id))]:f.template==='fishing'?fishingSpots(f.theme)[id===-1?people.length:people.indexOf(id)]:f.template==='market'?(id===-1?g.layout.player:g.layout.staff[people.indexOf(id)]):f.template==='couture'?coutureTarget(g,id):fireworksTarget(g,id);
  for(const id of(f.template==='night'?people:[-1,...people])){const p=spot(id);s[field].people[id]={...p,inside:null,arrived:true,controlled:true};if(id===-1)s.player={...p};else s.npcPresence.push({id,...p,inside:null});}
  if(f.template==='market')for(const b of g.layout.buyers)s.npcPresence.push({id:-10-b.index,...b,inside:null});
 });
 if(f.template==='fishing'){const g=(await f.current()).state.fishingParty.session;await f.manage('fish_checkin',{eventId:g.id});}
}
export function trace(template,game){
 const g=structuredClone(game),events=[],apply=({night:applyNightPartyEvent,fishing:applyFishingEvent,market:applyMarketEvent,couture:applyCoutureEvent,fireworks:applyFireworksEvent})[template],emit=e=>{apply(g,e);events.push(e);},act=(type,extra={})=>emit({action:{type,...extra}}),tick=()=>emit({dt:.05});let guard=0;
 if(template==='night'){for(let i=0;i<4;i++){while(nightLight(g)<.42||nightLight(g)>.58)tick();act('tap');}}
 if(template==='fishing')while(g.match.phase!=='results'&&guard++<8000){const m=g.match,c=m.current,l=m.rounds[Math.min(m.index,5)];if(['ready','round_result'].includes(m.phase)){act('next');continue;}if(c.mode==='aim')act('down',{x:l.spot.x-l.wind,y:l.spot.y});else if(c.mode==='bite'&&c.modeT>=.52)act('down');else if(c.mode==='fight'){act('point',{x:c.fish.x,y:c.fish.y});const hold=!c.surge&&c.tension<.72;if(hold!==c.holding)act(hold?'down':'up');}tick();}
 if(template==='market')while(g.phase!=='results'&&guard++<2000){if(['setup','intermission'].includes(g.phase))act('start');for(const o of g.queue)if(!o.ready)act('arrive',{index:o.id});if(!g.packing&&g.queue.length){act('clear');for(const item of g.queue[0].goods)act('add',{item});act('pack',{index:g.queue[0].id});}tick();}
 if(template==='couture')for(let i=0;i<3;i++){act('start');const b=currentCoutureBrief(g),fit=coutureSolutions(g.wardrobe,b).sort((a,z)=>coutureReview(z,b).score-coutureReview(a,b).score)[0];for(const item of Object.values(fit).filter(Boolean))act('wear',{item});act('submit');act('arrive',{index:b.npcId});for(let beat=0;beat<4;beat++){while(g.clock<beat*1.8+.9-.001)tick();act('pose',{item:b.cues[beat]});}while(['showing','review'].includes(g.phase))tick();}
 if(template==='fireworks')for(let i=0;i<3;i++){act('start');const b=currentFireworksAct(g);for(const t of b.targets){for(const[field,value]of[['lane',t.lane],['color',t.color],['shape',t.shape]])act('configure',{index:t.index,item:field+':'+value});act('aim',{index:t.index,x:t.x-fireworksWind(g,t.at-t.flight)*t.flight*.55,y:t.y});}act('submit');for(const t of[...b.targets].sort((a,b)=>(a.at-a.flight)-(b.at-b.flight))){const limit=t.at-t.flight;while(g.clock<limit-1e-8)emit({dt:Math.min(.05,limit-g.clock)});act('launch',{index:t.index});}while(['performing','review'].includes(g.phase))tick();}
 return{game:g,events};
}
export async function finish(f){
 await place(f);let d=await f.current(),t=d.actions.active;const played=trace(f.template,t.game);
 let batch=[];const flush=async()=>{if(!batch.length)return;const events=batch;batch=[];f.advance(events.reduce((n,e)=>n+(e.dt||0),0)*1000+100);const d=await f.current(),t=d.actions.active;await f.call(f.config.kind,'checkpoint',{requestId:t.requestId,epoch:t.epoch,sequence:t.sequence,batch:t.nextBatch,events});};
 for(const e of played.events){if(['market','couture'].includes(f.template)&&['start','arrive'].includes(e.action?.type)){await flush();if(e.action.type==='start'||f.template==='couture')await place(f);if(f.template==='market'&&e.action.type==='arrive')await f.save(s=>{const g=s.festivalParty.session,o=g.game.queue.find(o=>o.id===e.action.index),p=g.layout.buyers[o.id%4];s.festivalAttendance.people[o.npcId]={...p,inside:null,role:'buyer',orderId:o.id};s.npcPresence=s.npcPresence.filter(n=>n.id!==o.npcId);s.npcPresence.push({id:o.npcId,...p,inside:null});});}batch.push(e);if(batch.length===2048)await flush();}await flush();
 f.advance(2500);d=await f.current();t=d.actions.active;return f.call(f.config.kind,'finish',{requestId:t.requestId,epoch:t.epoch,sequence:t.sequence});
}
