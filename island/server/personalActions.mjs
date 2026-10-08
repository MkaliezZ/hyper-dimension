import {AVATAR_BY_ID} from '../src/avatarCatalog.js';
import {itemUse,ITEM_BY_ID} from '../src/contentCatalog.js';
import {equipOutfit,unequipOutfit,equipTool,GARMENTS,TOOLS} from '../src/equipmentRules.js';
import {claimMoment,refreshJourney,hydrateJourney,MOMENTS} from '../src/journey.js';
import {claimSpecialization,SPECIALIZATIONS} from '../src/specialization.js';
import {sameState} from '../src/actionMerge.js';
const fail=(message,code='personal_invalid')=>Object.assign(Error(message),{status:409,code});
const idOK=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(id);
const operations=['use','gift','equip','unequip','tool','moment','specialization','avatar'];
const signature=i=>i.operation==='avatar'?JSON.stringify([i.operation,i.target,i.avatarId,i.day??null]):JSON.stringify([i.operation,i.itemId??null,i.npcId??null,i.momentId??null,i.path??null,i.rank??null,i.day??null]);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function personalSnapshot(s){
 const t=s.journey?.stats||{};
 return {coins:s.coins,inventory:structuredClone(s.inventory),craftHistory:structuredClone(s.craftHistory||{}),roomGames:structuredClone(s.roomGames||{}),gatherCounts:structuredClone(s.gatherCounts||{}),discovered:structuredClone(s.discovered||{}),wardrobe:structuredClone(s.wardrobe??null),toolbelt:structuredClone(s.toolbelt??null),giftLog:structuredClone(s.giftLog||[]),research:structuredClone(s.research||{}),playerVitals:structuredClone(s.playerVitals??null),playerGoods:structuredClone(s.economy?.playerGoods||{}),journeyClaimed:structuredClone(s.journey?.claimed||{}),specializationAwards:structuredClone(s.specialization?.awards||{}),journeyProgress:Object.fromEntries(['gathered','crafted','buildings','watered','harvested','orders','parties','nightParties'].map(k=>[k,structuredClone(t[k]??(['gathered','crafted','buildings'].includes(k)?{}:0))]))};
}
const mirror=b=>({version:1,enabled:true});
export function validPersonalBook(p){
 return p===undefined||!!p&&p.version===1&&object(p.snapshot)&&object(p.snapshot.inventory)&&Number.isFinite(p.snapshot.coins)&&p.snapshot.coins>=0&&Object.values(p.snapshot.inventory).every(n=>Number.isSafeInteger(n)&&n>=0);
}
export function validPersonalTicket(t){return t?.kind==='personal'&&operations.includes(t.command)&&t.item==='personal'&&typeof t.signature==='string'&&t.signature.length<=500&&t.duration===0&&Number.isFinite(t.startedAt)&&t.readyAt===t.startedAt&&Number.isFinite(t.expiresAt)&&Number.isSafeInteger(t.day)&&t.day>0;}
export function syncPersonalState(s,b){if(!b?.personal)return;b.personal.snapshot=personalSnapshot(s);s.personalControl=mirror(b);}
export function assertPersonalState(s,b){
 if(b?.personal&&(!sameState(s.personalControl,mirror(b))||!sameState(personalSnapshot(s),b.personal.snapshot)))throw fail('物资、穿着、赠礼与纪念奖励由服务端结算，请核对已保存进度','personal_state_conflict');
}
export function clearPersonalState(s){delete s.personalControl;}
export function personalReplay(doc,i){
 if(i.kind!=='personal')return null;const b=doc?.actions;if(!b)return null;
 if(i.operation==='enable'&&b.personal)return {document:doc,ticket:null,receipt:null,replayed:true};
 const r=b.receipts.find(r=>r.ticket.requestId===i.requestId);if(!r)return null;
 if(r.ticket.kind!=='personal'||r.ticket.signature!==signature(i))throw fail('同一物品操作不能变更内容','action_id_conflict');
 return {document:doc,ticket:r.ticket,receipt:r,replayed:true};
}
export function applyPersonalCommand(s,b,i,now){
 if(!idOK(i.requestId))throw fail('物品操作编号无效');
 if(i.operation==='enable'){if(!b.personal){hydrateJourney(s);s.giftLog??=[];s.research??={};b.personal={version:1,snapshot:personalSnapshot(s)};syncPersonalState(s,b);}return {ticket:null,receipt:null};}
 if(!b.personal)throw fail('个人物资账本尚未启用','personal_not_enabled');
 assertPersonalState(s,b);if(!operations.includes(i.operation))throw fail('不支持的物品操作');
 if(i.day!==s.day)throw fail('游戏日已经更新，请重新查看物品','personal_day');
 if(['use','gift','equip','tool'].includes(i.operation)&&(typeof i.itemId!=='string'||!Object.hasOwn(ITEM_BY_ID,i.itemId)))throw fail('物品编号无效');
 if(i.npcId!==undefined&&(!Number.isInteger(i.npcId)||i.npcId<0||i.npcId>15))throw fail('收礼居民编号无效');
 if(i.operation==='equip'&&!Object.hasOwn(GARMENTS,i.itemId)||i.operation==='unequip'&&i.itemId!=null&&(typeof i.itemId!=='string'||!Object.hasOwn(GARMENTS,i.itemId)))throw fail('衣物编号无效');
 if(i.operation==='tool'&&!Object.hasOwn(TOOLS,i.itemId))throw fail('工具编号无效');
 if(i.operation==='moment'&&!MOMENTS.some(m=>m.id===i.momentId))throw fail('纪念编号无效');
 if(i.operation==='specialization'&&(!SPECIALIZATIONS.some(p=>p.id===i.path)||!Number.isInteger(i.rank)||i.rank<1||i.rank>5))throw fail('专精纪念编号无效');
 if(i.operation==='avatar'&&(!['butler','player'].includes(i.target)||!Object.hasOwn(AVATAR_BY_ID,i.avatarId||'')&&!(i.target==='butler'&&i.avatarId==='default')))throw fail('角色形象无效');
 const before={coins:s.coins,inventory:{...s.inventory}};let details;
 if(i.operation==='avatar'){if(i.target==='butler')s.butlerAvatar=i.avatarId;else{s.playerProfile??={};s.playerProfile.avatar=i.avatarId;}details={ok:true,target:i.target,avatarId:i.avatarId,text:(i.target==='butler'?'管家':'岛主')+'形象已保存，刷新与切换画风后继续保留。'};}
 else if(i.operation==='use'||i.operation==='gift')details=itemUse(i.itemId,s,{action:i.operation==='gift'?'gift':'use',npcId:i.npcId??15});
 else if(i.operation==='equip')details=equipOutfit(i.itemId,s);
 else if(i.operation==='unequip')details=unequipOutfit(s,i.itemId??null);
 else if(i.operation==='tool')details=equipTool(i.itemId,s);
 else if(i.operation==='moment'){
  // Readiness is derived from confirmed progress; a browser-supplied ready flag is not proof.
  if(!s.journey)throw fail('这份纪念的条件尚未达成','personal_reward');
  s.journey.ready={};refreshJourney(s);
  const result=claimMoment(s,i.momentId);details=result?{ok:true,...result,text:'已铭记 · '+result.title+'。纪念已留在岛上。'}:{ok:false,text:'条件尚未达成，或这份纪念已经收下。'};
 }else{details=claimSpecialization(s,i.path,i.rank);if(details.ok)details.text='已铭记 · '+details.title+'。永久称号与地图徽记已留下。';}
 if(!details?.ok)throw fail(details?.text||details?.reason||'操作条件尚未满足','personal_unavailable');
 const sequence=++b.sequence,ticket={kind:'personal',command:i.operation,item:'personal',requestId:i.requestId,epoch:b.epoch,sequence,signature:signature(i),day:s.day,duration:0,startedAt:now,readyAt:now,expiresAt:now+1800000};
 const receipt={ticket,outcome:'finished',at:now,day:s.day,text:details.text,cashDelta:s.coins-before.coins,stockDelta:Object.fromEntries(Object.entries(s.inventory).map(([id,n])=>[id,n-(before.inventory[id]||0)]).filter(([,n])=>n!==0)),details};
 b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);syncPersonalState(s,b);return {ticket,receipt};
}
