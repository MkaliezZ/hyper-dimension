import {RESIDENTS} from '../src/world.js';
import {resolve} from 'node:path';
import {createRecruitmentStore} from './recruitmentStore.mjs';
import {AVATAR_BY_ID} from '../src/avatarCatalog.js';
const fail=(message,code='lan_travel_invalid')=>Object.assign(Error(message),{code,status:409});
const worldKey=doc=>doc?.state?.saveSlot;
const safe=(v,fallback,max=100)=>typeof v==='string'?v.slice(0,max):fallback;
// The transient travel document is enriched from the owner's contract registry, never client input.
export async function readTravelContract(directory,account,doc,id){
 if(!worldKey(doc)||typeof id!=='string')return null;
 try{const c=await createRecruitmentStore({directory:resolve(directory,'_lan','islands',account.id)}).peek(account.profile.theme,id);return c.world===worldKey(doc)?c:null;}
 catch(e){if(e.code==='recruitment_missing')return null;throw e;}
}
export async function resolveTravelRecruitment(directory,account,doc){
 if(!doc)return doc;
 const active=doc.state.recruitment?.active,c=await readTravelContract(directory,account,doc,active?.id),run=c?.runs?.at(-1);
 const verified=c?.phase==='active'&&run?.parent?.id===active?.parentRunId&&run?.child?.id===active?.childRunId&&active?.world===c.world;
 return {...doc,travelRecruit:verified?c:null};
}
export function travelPerson(account,document,npcId){
 const s=document?.state;if(!s?.saveSlot)throw fail('请先进入自己的小岛，建立出行档案','lan_travel_home');
 if(npcId===16){const c=document.travelRecruit;if(!c)throw fail('临时伙伴的聘约未确认，请返回本岛核对','lan_travel_contract');const p=c.profile;return {actorId:account.id+':'+s.saveSlot+':recruit:'+(c.visitId||c.id),ownerAccountId:account.id,homeWorldKey:s.saveSlot,homeTheme:account.profile.theme,homeIslandName:account.profile.islandName,npcId,kind:'agent_recruited',contractId:c.id,visitId:c.visitId||c.id,candidateId:c.candidateId,name:safe(p.name,'临时伙伴',24),job:safe(p.job,'筹备伙伴',40),personality:safe(p.personality,''),appearance:AVATAR_BY_ID[p.appearance]?p.appearance:'female_4',interest:Array.isArray(p.interest)?p.interest:[]};}
 const base=RESIDENTS[npcId];if(!base)throw fail('这位居民不在本岛的常住名册');
 const p={...base,...s.npcProfiles?.[npcId]};
 return {actorId:account.id+':'+s.saveSlot+':npc:'+npcId,ownerAccountId:account.id,homeWorldKey:s.saveSlot,homeTheme:account.profile.theme,homeIslandName:account.profile.islandName,npcId,kind:npcId===15?'hermes':'ai',name:safe(p.name,base.name,24),job:safe(p.job,base.job,40),personality:safe(p.personality,base.personality),appearance:npcId===15&&AVATAR_BY_ID[s.butlerAvatar]?s.butlerAvatar:null,interest:base.interest};
}
export function invitation(account,doc,npcId){
 if(!Number.isInteger(npcId)||npcId<0||npcId>16||npcId===15)throw fail('请选择本岛居民或临时伙伴，管家自动同行');
 const s=doc.state,p=travelPerson(account,doc,npcId),n=s.npcNeeds?.[npcId]||{},energy=n.energy??78,hunger=n.hunger??76;
 let reason='',accepted=false;
 const hired=npcId===16?s.recruitment?.active:null;
 if(npcId===16&&(!hired||hired.phase!=='working'||!hired.hasArrived))reason='我还没有安顿好，完成到岛流程后再邀请我。';
 else if(npcId===16&&(hired.leaveRequested||hired.feePaid!==null||s.day>=doc.travelRecruit.expiresDay))reason='这份聘约正在结束，完成交接后再商量下一次相聚。';
 else if(energy<45)reason='我需要先休息，精力恢复到45后再出发。';
 else if(hunger<45)reason='我想先吃一餐，饱足恢复到45后再同行。';
 else if([...(s.residentControl?.leases||[]),...(s.farmControl?.leases||[]),...(s.mineControl?.leases||[])].some(x=>x.actorId===npcId))reason='我手里的工作还没收尾，完成后再邀请我。';
 else if((s.agentTaskLedger||[]).some(x=>x.npcId===npcId&&['queued','running','waiting'].includes(x.status)))reason='我答应的委托还没完成，请先完成或暂停这项委托。';
 else if((s.residentStories?.episodes||[]).some(x=>x.people?.includes(npcId)&&(['meeting','working'].includes(x.status)||x.status==='scheduled'&&x.dueDay<=s.day)))reason='我正在履行与邻居的约定，结束后才能出发。';
 else if((s.npcPresence||[]).some(x=>x.id===npcId&&(x.partyControlled||x.recruitControlled||x.meeting||x.assignment)))reason='我正在参加岛上的活动，散场后再同行。';
 else if(/安静|沉静|冷静/.test(p.personality)&&(n.social??62)>85)reason='今天想留一点独处时间，等我想与人交流时再去。';
 else {accepted=true;reason='今天的工作没有未完成的承诺，'+(/好奇|好学|博学/.test(p.personality)?'我想去看看朋友岛上的新发现。':/开朗|热情|健谈|爽朗/.test(p.personality)?'我很期待认识那里的居民。':'我可以同行，也想了解那里的'+p.job+'日常。');}
 return {...p,accepted,reason,needs:{energy,hunger},day:s.day};
}
export function travelPreparation(account,doc,stored){
 if(!doc?.state||!worldKey(doc))return {available:false,reason:'先进入自己的小岛建立档案',residents:[],selected:[]};
 const valid=!!stored&&stored.homeWorldKey===worldKey(doc),selected=valid?stored.selected||[]:[];
 return {available:true,homeWorldKey:worldKey(doc),homeTheme:account.profile.theme,butler:travelPerson(account,doc,15),selected:[...selected],recruitedContractId:valid?stored.recruitedContractId||null:null,staleRecruitSelection:selected.includes(16)&&(!doc.travelRecruit||stored.recruitedContractId!==doc.travelRecruit.id),residents:[...Array.from({length:15},(_,i)=>invitation(account,doc,i)),...(doc.travelRecruit?[invitation(account,doc,16)]:[])],maxResidents:2};
}
export function freezeTravelParty(account,doc,stored,at){
 const p=travelPreparation(account,doc,stored);if(!p.available)throw fail(p.reason,'lan_travel_home');
 if(p.staleRecruitSelection)throw fail('临时伙伴的聘约已变化，请取消旧邀请并重新邀请','lan_travel_contract');
 if(p.selected.length>2||new Set(p.selected).size!==p.selected.length)throw fail('随行居民最多两位');
 const residents=p.selected.map(id=>{const r=invitation(account,doc,id);if(!r.accepted)throw fail(r.name+'：'+r.reason,'lan_travel_consent');const {accepted,reason,needs,day,...person}=r;return person;});
 return {homeWorldKey:p.homeWorldKey,homeTheme:p.homeTheme,frozenAt:at,members:[p.butler,...residents],agentRuntime:'not-connected'};
}
