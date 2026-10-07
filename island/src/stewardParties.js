import {hydrateFireworks,createFireworksEvent,updateFireworksEvent,createFireworksPlan} from './fireworksParty.js';
import {hydrateCouture,createCoutureEvent,updateCoutureEvent,createCouturePlan} from './coutureParty.js';
import {partyDraftStamp,validatePartyProposal} from './partyPlanning.js';
import {hydrateNightParty,createNightEvent,updateNightEvent,createNightPlan} from './nightPartyPlanning.js';
import {hydrateFestival,createFestivalEvent,updateFestivalEvent,createFestivalPlan} from './festivalParty.js';
const run=v=>typeof v==='string'&&/^hd-island-[a-f0-9]{32}$/.test(v),proposal=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
export function applyStewardEvent(s,p,runId,template){
 if(!['night','market','couture','fireworks'].includes(template)||p?.template!==template||!proposal(p?.id)||!run(runId))return{ok:false,reason:'缺少对应活动的真实管家回执'};
 const api=template==='fireworks'?{hydrate:hydrateFireworks,create:createFireworksEvent,update:updateFireworksEvent,plan:createFireworksPlan}:template==='couture'?{hydrate:hydrateCouture,create:createCoutureEvent,update:updateCoutureEvent,plan:createCouturePlan}:template==='night'?{hydrate:hydrateNightParty,create:createNightEvent,update:updateNightEvent,plan:createNightPlan}:{hydrate:hydrateFestival,create:createFestivalEvent,update:updateFestivalEvent,plan:createFestivalPlan};
 const f=api.hydrate(s),key=runId+':'+p.id;f.hermesReceipts??={};
 if(f.hermesReceipts[key])return{...structuredClone(f.hermesReceipts[key]),replayed:true};
 const d=f.draft;
 if(p.expectedId!==(d?.id||null)||p.expectedVersion!==(d?.version||null)||(p.expectedStamp??null)!==partyDraftStamp(d))return{ok:false,reason:'管家观察后活动已改变，请重新观察当前方案'};
 if(s.fireworksParty?.session?.phase==='running'||s.coutureParty?.session?.phase==='running'||s.partySession||['checkin','running'].includes(s.fishingParty?.session?.phase)||f.session||s.festivalParty?.session?.phase==='running')return{ok:false,reason:'先完成当前活动，再登记筹备'};
 const checked=validatePartyProposal(s,p);if(!checked.ok)return checked;
 const r=d?api.update(s,checked.proposal):api.create(s,checked.proposal);if(!r.ok)return r;
 Object.assign(r.event,{source:'hermes',runId,proposalId:p.id});
 const plan=api.plan(s),receipt={ok:true,template,id:r.event.id,title:r.event.name,version:r.event.version,runId,reinvite:!!r.reinvite,projectId:plan.project?.id||null,preparation:plan.ok?'registered':String(plan.reason||'清单未登记').slice(0,200),waiting:'请亲自对话邀请关键居民，备齐用品后再到场开市'};
 if(template==='fireworks')receipt.waiting='请亲自邀请设备、风向、节拍三位协作居民及嘉宾，备齐六枚烟花与海风旗，到广场编排三幕演出';
 if(template==='couture')receipt.waiting='请亲自邀请六位评审和模特及嘉宾，备齐实际衣架和后台用品后到广场举办';
 if(template==='night')receipt.waiting='请亲自对话邀请关键居民，备齐用品后再到广场放飞';
 f.hermesReceipts[key]=receipt;for(const old of Object.keys(f.hermesReceipts).slice(0,-128))delete f.hermesReceipts[old];return receipt;
}
