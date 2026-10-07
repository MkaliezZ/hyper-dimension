import {ALL_RECIPES,recipeGate} from '../src/contentCatalog.js';
import {candidateStepAllowed} from '../src/recruitmentCatalog.js';
import {BUILDINGS} from '../src/world.js';import {NPC_CADENCE} from '../src/npcCadence.js';
import {readTravelContract} from './lanTravelParty.mjs';
const fail=(message,code='lan_social_contract')=>Object.assign(Error(message),{code,status:409});
const preferred={tea:[1,17,2,4],farm:[3,14,22],mine:[18,15,0],workshop:[0,15,24],gallery:[24,7],plaza:[20,21]};
async function contractFor(directory,p,doc){
 const c=await readTravelContract(directory,{id:p.ownerAccountId,profile:{theme:p.homeTheme}},doc,p.contractId),a=doc.state.recruitment?.active;
 if(!c||c.id!==a?.id||c.id!==p.contractId||c.phase!=='active'||c.world!==p.homeWorldKey||a.phase!=='working'||!a.hasArrived||a.leaveRequested||a.feePaid!==null||doc.state.day>=a.expiresDay||c.runs?.at(-1)?.parent.id!==a.parentRunId||c.runs?.at(-1)?.child.id!==a.childRunId)throw fail('这位伙伴的原聘约已变化；本次合作不能接管下一位伙伴。');
 return c;
}
export async function createGuestProposal({directory,e,room,tenants,now}){
 const host=room.members[room.owner]?.travel?.members.find(p=>p.kind==='hermes');if(!host)throw fail('主岛需要有自己的管家和有效岛屿档案。');
 const hostDoc=await tenants.readIslandForServer(room.owner,host.homeTheme);if(hostDoc?.state.saveSlot!==host.homeWorldKey)throw fail('主岛已重新开始，请重新商量合作。');
 const shared=e.people[0].interest.find(x=>e.people[1].interest.includes(x)),order=preferred[shared]||[0,15,3,1],parts=[];
 for(const p of e.people){
  const doc=await tenants.readIslandForServer(p.ownerAccountId,p.homeTheme);if(doc?.state.saveSlot!==p.homeWorldKey)throw fail('居民原岛已变化。');
  const contract=p.kind==='agent_recruited'?await contractFor(directory,p,doc):null;
  const recipes=ALL_RECIPES.filter(r=>r.index===0&&recipeGate(r,hostDoc.state).ready&&(!contract||candidateStepAllowed(contract.profile,{buildingId:r.building})));
  recipes.sort((a,b)=>{const rank=r=>order.includes(r.building)?order.indexOf(r.building):99+r.building;return rank(a)-rank(b)});
  const recipe=recipes[0];if(!recipe)throw fail('主岛尚未开放适合这位伙伴职业的基础图纸。');
  const pin=contract?{id:contract.id,visitId:contract.visitId||contract.id,parentRunId:contract.runs.at(-1).parent.id,childRunId:contract.runs.at(-1).child.id,projectId:contract.projectId}:null;
  parts.push({actorId:p.actorId,ownerAccountId:p.ownerAccountId,name:p.name,command:{recipeId:recipe.id,buildingId:recipe.building,npcId:p.npcId},item:recipe.item,itemName:recipe.name,cost:structuredClone(recipe.cost),duration:NPC_CADENCE.workSeconds,contract:pin,proof:null,taskStatus:null});
 }
 const cost={};for(const part of parts)for(const[id,n]of Object.entries(part.cost))cost[id]=(cost[id]||0)+n;
 return {mode:'host_workshop',title:'客岛共同试作 · '+parts.map(p=>p.itemName).join('与'),status:'proposed',createdAt:now(),expiresAt:now()+1800000,accepted:[],requiredOwners:[...new Set([...e.people.map(p=>p.ownerAccountId),room.owner])],hostAccountId:room.owner,hostTheme:host.homeTheme,hostWorldKey:host.homeWorldKey,hostIslandName:host.homeIslandName,workId:'guest-work:'+e.id,holdId:'guest:'+e.id+':materials',parts,cost,elapsed:0,lastAt:null,reason:'双方岛主与主岛认可后，使用主岛材料在客岛工位共同试作。原聘约分工和报酬独立保留；本次不另收岛币，成品归主岛。'};
}
export async function validateGuestProposal({directory,e,c,room,tenants,now}){
 if(now()>c.expiresAt)throw fail('这次客岛合作已到期。','lan_social_guest_expired');
 if(room.id!==e.roomId||room.owner!==c.hostAccountId||!room.members[c.hostAccountId]||now()-room.members[c.hostAccountId].lastSeen>45000)throw fail('主岛已暂离，本次工作停止。','lan_social_guest_left');
 const hostDoc=await tenants.readIslandForServer(c.hostAccountId,c.hostTheme);if(hostDoc?.state.saveSlot!==c.hostWorldKey)throw fail('主岛档案已变化。','lan_social_guest_world');
 const people=[...(room.residents||[]),...Object.values(room.members).flatMap(m=>m.companions||[])];
 for(const part of c.parts){
  const p=e.people.find(p=>p.actorId===part.actorId),live=people.find(x=>x.person.actorId===part.actorId),member=room.members[p.ownerAccountId];
  if(!live||!member||now()-member.lastSeen>45000)throw fail('参与者已离开或暂离，未完成材料会退还主岛。','lan_social_guest_left');
  const doc=await tenants.readIslandForServer(p.ownerAccountId,p.homeTheme);if(doc?.state.saveSlot!==p.homeWorldKey)throw fail('参与者的原岛档案已变化。','lan_social_guest_world');
  if(part.contract){const contract=await contractFor(directory,p,doc);if(contract.id!==part.contract.id||contract.runs.at(-1).parent.id!==part.contract.parentRunId||contract.runs.at(-1).child.id!==part.contract.childRunId||live.person.contractId!==part.contract.id)throw fail('原聘约来源已变化。');}
  const r=ALL_RECIPES.find(r=>r.id===part.command.recipeId);if(!r||r.item!==part.item||r.building!==part.command.buildingId||JSON.stringify(r.cost)!==JSON.stringify(part.cost)||!recipeGate(r,hostDoc.state).ready)throw fail('工位或图纸已变化，请重新安排。','lan_social_guest_recipe');
 }
 return hostDoc;
}
export function guestWalletStep(c,eventId,operation,index=null){
 const part=index===null?null:c.parts[index],input={id:'guest:'+eventId+':'+operation+(index===null?'':':'+index),worldKey:c.hostWorldKey,operation,eventId,note:operation==='reserve'?'客岛共同试作材料预留':operation==='release'?'客岛试作停止，退回尚未使用的材料':operation==='capture'?'客岛共同试作材料消耗':part.name+'在客岛制作 '+part.itemName};
 if(operation==='credit')input.gain={[part.item]:1};else{input.holdId=c.holdId;if(operation==='reserve')input.cost=c.cost;}
 return {accountId:c.hostAccountId,theme:c.hostTheme,input};
}
export function guestProof(c,part,index,event,at){
 return {kind:'guest-craft',walletReceiptId:'guest:'+event.id+':credit:'+index,materialReceiptId:'guest:'+event.id+':capture',actorId:part.actorId,contractId:part.contract?.id||null,parentRunId:part.contract?.parentRunId||null,childRunId:part.contract?.childRunId||null,recipeId:part.command.recipeId,item:part.item,quantity:1,elapsed:c.elapsed,requiredSeconds:part.duration,hostAccountId:c.hostAccountId,hostWorldKey:c.hostWorldKey,at};
}
