import {nextHostedParty,hostingDraft,hostingView} from './partyHosting.js';
import {partyDraftStamp} from './partyPlanning.js';
// A saved one-time mandate is checked locally. No periodic model or API request.
export function createPartyHostingRuntime({state,theme,actions,allowed,command,start,event=()=>{},toast=()=>{}}){
 let elapsed=0,inflight=false,scope=null;
 async function arm(template){
  const s=state(),d=hostingDraft(s,template);if(!d)throw Error('先写下这一场活动方案');
  const r=await command('host_arm',{template,eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)});
  toast(r.receipt.details.text);return r;
 }
 async function cancel(template){
  const h=hostingView(state(),template);if(!h)return;
  const r=await command('host_cancel',{template,hostIntentId:h.id});toast(r.receipt.details.text);return r;
 }
 function update(dt){
  elapsed+=dt;if(elapsed<1||inflight)return;elapsed=0;
  if(!allowed())return;
  const s=state(),h=nextHostedParty(s,{actionActive:!!actions()?.active});if(!h)return;
  const key=theme()+':'+s.saveSlot;scope=key;inflight=true;
  Promise.resolve().then(()=>start(h)).then(()=>{
   if(scope!==key||theme()+':'+state().saveSlot!==key)return;
   if(state().partyHosting?.active?.some(x=>x.id===h.id&&x.phase==='started'))event('管家已为「'+h.name+'」召集伙伴；沿道路到场后，亲手完成这场相聚。');
  }).catch(e=>toast(e.message)).finally(()=>{inflight=false;});
 }
 return {arm,cancel,update,inspect:()=>({inflight,scope})};
}
