import {DEFAULT_RECIPES,ITEM_BY_ID} from '../src/contentCatalog.js';import {availableQuantity} from '../src/resourceLedger.js';
const clone=v=>structuredClone(v),fail=(message,code='lan_event_economy',status=409)=>Object.assign(Error(message),{code,status});
export const LAN_ECONOMY_RULES=Object.freeze({venue:8,entry:12,baseReward:2,qualityBonus:1,bonusQuality:90,maxReward:3});
export function publicLanEconomy(e,accountId){const x=e.economy;if(!x)return{mode:'social',delivery:'bring'};return{mode:x.mode,delivery:x.delivery,status:x.status,venueCost:x.venueCost,entryFee:x.entryFee,rewardPerGuest:x.rewardPerGuest,venueMaterials:clone(x.host.materials),invitedGuests:Object.keys(e.invitations).length-1,heldGuests:Object.keys(x.guests).length,myHold:x.guests[accountId]?{cost:clone(x.guests[accountId].cost),at:x.guests[accountId].at}:null,settlement:x.settlement?clone(x.settlement):null};}
export function createLanActivityEconomy({tenants,now=()=>Date.now()}){
 const holding=(record,name,e)=>'event:'+e.id+':'+name+':'+record.accountId;
 function step(e,r,operation,holdId,{cost,gain,note}={}){return{accountId:r.accountId,theme:r.theme,input:{id:'event:'+e.id+':'+operation+':'+holdId.split(':')[2]+':'+r.accountId+(operation==='credit'?':'+note.code:''),worldKey:r.worldKey,operation,holdId,...cost?{cost}:{},...gain?{gain}:{},eventId:e.id,note:typeof note==='object'?note.text:note||e.title}};}
 // Each plan stamps request-specific IDs; hold IDs remain stable within an invitation.
 const stamp=(steps,id)=>steps.map((s,n)=>({...s,input:{...s.input,id:s.input.operation==='lan_wonder'?s.input.id:'lan:'+id+':'+n}}));
 async function documentFor(id,theme){const d=await tenants.readIslandForServer(id,theme);if(!d)throw fail('请先回自己的小岛保存进度，再筹备活动','lan_event_save');if(!Number.isSafeInteger(d.state.coins)||d.state.coins<0)throw fail('岛币存档无效，请读取正常进度','lan_wallet_invalid',400);return d;}
 async function publish(e,a,mode,delivery){if(!['social','funded'].includes(mode)||!['bring','transfer'].includes(delivery)||mode==='social'&&delivery!=='bring')throw fail('请选择轻装相聚，或共同筹办中的携带/交付方式','lan_event_invalid',400);if(mode==='social')return[];const d=await documentFor(a.id,a.profile.theme),r={accountId:a.id,theme:a.profile.theme,worldKey:d.state.saveSlot,materials:clone(DEFAULT_RECIPES[e.building].cost)},N=Object.keys(e.invitations).length-1;
 e.economy={mode:'funded',delivery,status:'held',venueCost:LAN_ECONOMY_RULES.venue,entryFee:LAN_ECONOMY_RULES.entry,rewardPerGuest:LAN_ECONOMY_RULES.maxReward,host:r,guests:{},settlement:null};r.guardHold=holding(r,'guard',e);r.venueHold=holding(r,'venue',e);r.rewardHold=holding(r,'reward',e);
 return[step(e,r,'reserve',r.guardHold,{cost:{},note:'活动结算保护'}),step(e,r,'reserve',r.venueHold,{cost:{...r.materials,coins:e.economy.venueCost},note:'场地与共同制作材料预留'}),step(e,r,'reserve',r.rewardHold,{cost:{coins:N*e.economy.rewardPerGuest},note:'受邀朋友的奖励预算预留'})];}
 async function admission(e,a,theme){const x=e.economy,r=x?.guests[a.id],host=x&&a.id===e.owner,d=await documentFor(a.id,r?.theme||(host?x.host.theme:theme));if(r&&d.state.saveSlot!==r.worldKey)throw fail('活动物资属于先前的小岛，请先结束邀请','lan_event_world');const h=r?d.state.lanEconomyControl?.holds?.[r.entryHold]:null;if(r&&(!h||h.worldKey!==r.worldKey))throw fail('活动物资预留待核对，请读取活动服务','lan_event_economy');const missing=host?[]:e.requirements.items.filter(v=>availableQuantity(d.state,v.item)+(x?.delivery==='transfer'?(h?.cost[v.item]||0):0)<v.quantity).map(v=>ITEM_BY_ID[v.item].name+' ×'+v.quantity);return{document:d,missing,record:r};}
 async function checkin(e,a,proof){const x=e.economy;if(!x||a.id===e.owner)return[];if(x.guests[a.id])return[];const r={accountId:a.id,theme:proof.theme,worldKey:proof.worldKey,at:now(),cost:{coins:x.entryFee,...x.delivery==='transfer'?Object.fromEntries(e.requirements.items.map(v=>[v.item,v.quantity])):{}}};r.guardHold=holding(r,'guard',e);r.entryHold=holding(r,'entry',e);x.guests[a.id]=r;return[step(e,r,'reserve',r.guardHold,{cost:{},note:'赴约结算保护'}),step(e,r,'reserve',r.entryHold,{cost:r.cost,note:x.delivery==='transfer'?'入场费与交付物资预留':'入场费预留，物资仍在背包'})];}
 function releaseGuest(e,id){const x=e.economy,r=x?.guests[id];if(!r)return[];delete x.guests[id];return[step(e,r,'release',r.entryHold,{note:'婉拒赴约，退回入场费与个人物资'}),step(e,r,'release',r.guardHold,{note:'解除赴约结算保护'})];}
 function start(e){const x=e.economy;if(!x)return[];x.status='live';return[step(e,x.host,'capture',x.host.venueHold,{note:'活动开场，使用场地与共同制作材料'})];}
 function settle(e,{cancel=false,reason='活动圆满结束'}={}){const x=e.economy;if(!x||['settled','refunded'].includes(x.status))return[];const started=x.status==='live',host=x.host,steps=[],deliveries=[],awards=[],refunds=[],gains={coins:0};let rewardSpent=0;
 if(cancel){if(!started)steps.push(step(e,host,'release',host.venueHold,{note:'开场前取消，退回场地与制作材料'}));steps.push(step(e,host,'release',host.rewardHold,{note:'退回未发放奖励预算'}));}
 else{
  if(!started)throw fail('筹办尚未开场，不能结算','lan_event_not_live');
  steps.push(step(e,host,'capture',host.rewardHold,{note:'从已预留预算发放活动奖励'}));
 }
 for(const[id,r]of Object.entries(x.guests)){
  if(cancel||!e.results[id]){steps.push(step(e,r,'release',r.entryHold,{note:cancel?'活动取消，退回入场费与交付物资':'未完成挑战，退回入场费与交付物资'}));refunds.push({accountId:id,name:e.invitations[id].name,cost:clone(r.cost)});}
  else{const quality=e.results[id].result.quality,reward=LAN_ECONOMY_RULES.baseReward+(quality>=LAN_ECONOMY_RULES.bonusQuality?LAN_ECONOMY_RULES.qualityBonus:0);rewardSpent+=reward;steps.push(step(e,r,'capture',r.entryHold,{note:'挑战完成，入场费与约定物资转交主办岛'}));for(const[k,n]of Object.entries(r.cost))gains[k]=(gains[k]||0)+n;deliveries.push({accountId:id,name:e.invitations[id].name,cost:clone(r.cost)});awards.push({accountId:id,name:e.invitations[id].name,coins:reward,quality,runId:e.results[id].runId});steps.push(step(e,r,'credit',r.guardHold,{gain:{coins:reward},note:{code:'reward',text:'完成真实挑战，从主办方预算领取奖励'}}));}
 }
 if(!cancel){const unused=(Object.keys(e.invitations).length-1)*x.rewardPerGuest-rewardSpent;if(unused<0)throw fail('奖励超出已预留预算','lan_event_economy');if(unused)gains.coins+=unused;steps.push(step(e,host,'credit',host.guardHold,{gain:gains,note:{code:'host',text:'收到入场费、约定物资与未发放奖励预算'}}));}
 // Keep every world pinned until all money and materials have reached their destination.
 for(const r of [host,...Object.values(x.guests)])steps.push(step(e,r,'release',r.guardHold,{note:'本场活动结算完成'}));
 x.status=cancel?'refunded':'settled';x.settlement={at:now(),reason,venueSpent:started?x.venueCost:0,materialsSpent:started?clone(host.materials):{},rewardSpent,deliveries,awards,refunds};return steps;
 }
 return{stamp,publish,admission,checkin,releaseGuest,start,settle};
}
