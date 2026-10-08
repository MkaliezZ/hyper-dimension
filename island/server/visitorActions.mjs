import {hydrateTown,TOURISTS,assessIsland,settleVisit,reviewVisit,visitQuote} from '../src/townSimulation.js';
import {ECONOMY_RULES,effectiveQuality} from '../src/economy.js';
import {HARBOR_LAYOUTS,BUILDINGS} from '../src/world.js';
import {hydrateResources,reserveResources,releaseResources} from '../src/resourceLedger.js';
export const VISITOR_LEASE_PREFIX='server-visitor:';
const fail=(message,code='visitor_invalid')=>Object.assign(Error(message),{status:409,code});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const idOK=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(id);
const phases=['onboard','landed','servicing','reviewed'];
const economyKeys=['active','gross','guestSerial','tripCounter','arrivals','declined','departures','rating','reviews','ledger','receipts','visitorLog'];
const econ=s=>Object.fromEntries(economyKeys.map(k=>[k,structuredClone(s.economy[k])]));
const validEconomy=e=>e&&['active','gross','guestSerial','tripCounter','arrivals','declined','departures','reviews'].every(k=>Number.isSafeInteger(e[k])&&e[k]>=0)&&Number.isFinite(e.rating)&&e.rating>=0&&e.rating<=5&&Array.isArray(e.ledger)&&Array.isArray(e.visitorLog)&&e.receipts&&typeof e.receipts==='object'&&!Array.isArray(e.receipts);
const signature=i=>JSON.stringify([i.operation,i.guestId??null,i.stop??null,i.buildingId??null,i.queue??null]);
export function visitorTickets(b){return Object.values(b?.visitor?.leases||{});}
export function validVisitorTicket(t){return t?.kind==='visitor'&&['arrive','land','begin','review','depart'].includes(t.command)&&t.item==='visitor'&&Number.isFinite(t.duration)&&[0,12].includes(t.duration)&&typeof t.owner==='string'&&t.owner.startsWith(VISITOR_LEASE_PREFIX)&&typeof t.signature==='string'&&Number.isFinite(t.startedAt)&&Number.isFinite(t.readyAt)&&Number.isFinite(t.expiresAt)&&Number.isInteger(t.day)&&t.day>=1&&(t.command!=='begin'||Number.isSafeInteger(t.guestId)&&t.guestId>0&&Number.isInteger(t.stop)&&t.stop>=0&&t.stop<3&&Number.isInteger(t.buildingId)&&t.buildingId>=0&&t.buildingId<25&&t.quote&&Number.isSafeInteger(t.quote.paid)&&t.quote.paid>=0);}
export function validVisitorBook(v,b){
 if(v===undefined)return true;
 if(v?.autosaves&&(!Array.isArray(v.autosaves)||v.autosaves.length>64||v.autosaves.some(r=>!idOK(r.id)||typeof r.expectedVersion!=='string'||!(/^[a-f0-9]{64}$/.test(r.fingerprint)))))return false;
 if(!v||v.version!==1||!['pixel','origami'].includes(v.theme)||!Number.isFinite(v.activeSeconds)||v.activeSeconds<0||!Number.isFinite(v.lastActiveAt)||!Number.isFinite(v.nextTripAt)||v.nextTripAt<0||!v.guests||Array.isArray(v.guests)||Object.keys(v.guests).length>6||!v.leases||Array.isArray(v.leases)||Object.keys(v.leases).length>6||!validEconomy(v.economy)||!Array.isArray(v.history)||v.history.length>64)return false;
 for(const [id,g]of Object.entries(v.guests))if(String(g.id)!==id||!Number.isSafeInteger(g.id)||g.id<1||!Number.isInteger(g.skin)||g.skin<0||g.skin>=TOURISTS.length||!phases.includes(g.phase)||!Array.isArray(g.itinerary)||g.itinerary.length<2||g.itinerary.length>3||g.itinerary.some(id=>!Number.isInteger(id)||id<0||id>24)||!Number.isInteger(g.stop)||g.stop<0||g.stop>g.itinerary.length||!Number.isSafeInteger(g.budget)||g.budget<0||!Number.isSafeInteger(g.spent)||g.spent<0||!Array.isArray(g.ratings)||g.ratings.some(r=>!Number.isFinite(r))||!Number.isFinite(g.arrivedAt)||!Number.isFinite(g.phaseAt))return false;
 return visitorTickets({visitor:v}).every(t=>validVisitorTicket(t)&&idOK(t.requestId)&&t.epoch===b.epoch&&t.sequence>0&&t.sequence<=b.sequence&&v.guests[t.guestId]?.lease===t.requestId&&v.guests[t.guestId]?.phase==='servicing');
}
function publicControl(b){const v=b.visitor;return {version:1,theme:v.theme,activeSeconds:v.activeSeconds,nextTripAt:v.nextTripAt,guests:structuredClone(Object.values(v.guests)),leases:visitorTickets(b).map(t=>({requestId:t.requestId,epoch:t.epoch,sequence:t.sequence,guestId:t.guestId,stop:t.stop,buildingId:t.buildingId,quote:structuredClone(t.quote)}))};}
function sync(s,b){const v=b.visitor;s.economy.active=Object.values(v.guests).filter(g=>g.phase!=='onboard').length;v.economy=econ(s);s.visitorControl=publicControl(b);}
export function assertVisitorState(s,b){if(!b?.visitor)return;if(!same(s.visitorControl,publicControl(b))||!same(econ(s),b.visitor.economy))throw fail('游客行程与营业记录由服务端核算，请读取已确认进度','visitor_state_conflict');}
export function clearVisitorState(s){delete s.visitorControl;if(s.economy)s.economy.active=0;}
export function visitorHolds(b){return Object.fromEntries(visitorTickets(b).filter(t=>t.quote.item&&t.quote.paid).map(t=>[t.owner,{items:{[t.quote.item]:1},purpose:'游客消费 '+t.guestName,day:t.day}]));}
function log(s,b,text){s.economy.visitorLog.unshift({day:s.day,time:b.visitor.activeSeconds,text});s.economy.visitorLog=s.economy.visitorLog.slice(0,40);}
function enable(s,b,now,theme){
 if(!['pixel','origami'].includes(theme))throw fail('游客画风无效');
 if(b.visitor){if(b.visitor.theme!==theme)throw fail('游客行程与画风不一致');return;}
 hydrateTown(s);hydrateResources(s);s.economy.active=0;if(!validEconomy(s.economy))throw fail('旧存档游客营业记录无效，请修复或读取备份，已有收益不会自动清零','visitor_legacy_invalid');b.visitor={version:1,theme,activeSeconds:0,lastActiveAt:now,nextTripAt:20,guests:{},leases:{},history:[],economy:econ(s)};sync(s,b);
}
export function advanceVisitorClock(s,b,seconds,now){
 if(!b?.visitor)return;assertVisitorState(s,b);if(!Number.isFinite(seconds)||seconds<0||seconds>15)throw fail('游客有效时间请求无效','visitor_clock');const v=b.visitor;
 v.activeSeconds+=Math.min(seconds,15,Math.max(0,(now-v.lastActiveAt)/1000));v.lastActiveAt=now;sync(s,b);
}
function routeLength(points){return points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);}
function arrivalSeconds(theme){const h=HARBOR_LAYOUTS[theme];return routeLength([h.cabin,h.ship,...h.arrival.map(([x,y])=>({x,y}))])/86;}
function boardingSeconds(theme,q){const h=HARBOR_LAYOUTS[theme],a=h.waiting[q],last=h.waiting.at(-1);return routeLength([{x:a[0],y:a[1]},{x:a[0],y:a[1]+19},{x:1565,y:last[1]+19},h.boarding,h.ship,h.cabin])/86;}
export function visitorReplay(doc,i){
 if(i.kind!=='visitor')return null;const b=doc?.actions;if(!b)return null;
 if(i.operation==='enable'&&b.visitor)return {document:doc,ticket:null,receipt:null,replayed:true};
 const receipt=b.receipts.find(r=>r.ticket.requestId===i.requestId),lease=visitorTickets(b).find(t=>t.requestId===i.requestId),t=receipt?.ticket||lease;
 if(!t)return null;
 if(t.kind!=='visitor')throw fail('同一编号来自其他作业','action_id_conflict');
 if(['finish','cancel'].includes(i.operation)){if(t.epoch!==i.epoch||t.sequence!==i.sequence)throw fail('游客作业来自另一次存档','action_stale');if(receipt)return {document:doc,ticket:t,receipt,replayed:true};return null;}
 if(t.signature!==signature(i))throw fail('同一游客命令不能更换行程','action_id_conflict');
 return {document:doc,ticket:t,receipt:receipt||null,replayed:true};
}
function ticket(s,b,i,now,extra={}){
 const sequence=++b.sequence;return {kind:'visitor',command:i.operation,item:'visitor',requestId:i.requestId,epoch:b.epoch,sequence,owner:VISITOR_LEASE_PREFIX+b.epoch+':'+sequence,signature:signature(i),day:s.day,startedAt:now,readyAt:now,expiresAt:now+30*60*1000,duration:0,...extra};
}
function append(s,b,t,result={},outcome='finished',now){const receipt={ticket:t,outcome,at:now,day:s.day,...result};b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);sync(s,b);return {ticket:t,receipt};}
function guest(v,id){const g=v.guests[id];if(!Number.isSafeInteger(id)||!g)throw fail('游客已经离岛或行程不存在','visitor_stale');return g;}
export function applyVisitorCommand(s,b,i,now){
 if(!idOK(i.requestId))throw fail('游客命令编号无效');if(i.operation==='enable'){enable(s,b,now,(i.appearance||i.theme));return {ticket:null,receipt:null};}
 if(!b.visitor)throw fail('游客运营尚未启动','visitor_not_enabled');assertVisitorState(s,b);const v=b.visitor;
 if(i.operation==='arrive'){
  if(v.activeSeconds+1e-7<v.nextTripAt)throw fail('渡船尚未到达本次靠泊时刻','visitor_early');
  const t=ticket(s,b,i,now),accepted=[],declined=[],base=s.economy.tripCounter++*ECONOMY_RULES.guestsPerBoat;
  for(let j=0;j<ECONOMY_RULES.guestsPerBoat;j++){
   const skin=(base+j)%TOURISTS.length,tourist=TOURISTS[skin],decision=assessIsland(s,tourist);
   if(Object.keys(v.guests).length>=ECONOMY_RULES.maxGuests||!decision.accepted){s.economy.declined++;const reason=Object.keys(v.guests).length>=ECONOMY_RULES.maxGuests?'码头较拥挤，选择下次再来':decision.reason;declined.push({skin,name:tourist.name,score:decision.score,reason});log(s,b,tourist.name+'没有下船：'+reason+'（吸引力 '+decision.score+'）');continue;}
   const id=++s.economy.guestSerial,g={id,skin,name:tourist.name,taste:tourist.taste,itinerary:decision.itinerary,budget:tourist.budget,spent:0,ratings:[],stop:0,phase:'onboard',phaseAt:now,arrivedAt:v.activeSeconds,landReadyAt:now+Math.ceil(arrivalSeconds(v.theme)*1000),boatId:t.sequence,lease:null,queue:null};
   v.guests[id]=g;accepted.push(structuredClone(g));
  }
  v.nextTripAt=v.activeSeconds+ECONOMY_RULES.ferryInterval;return append(s,b,t,{accepted,declined,boatId:t.sequence},'finished',now);
 }
 if(['finish','cancel'].includes(i.operation)){
  const t=v.leases[i.requestId];if(!t||t.epoch!==i.epoch||t.sequence!==i.sequence)throw fail('游客作业已经结束','action_stale');const g=guest(v,t.guestId);
  if(i.operation==='cancel'){releaseResources(s,t.owner);delete v.leases[t.requestId];g.lease=null;g.phase='landed';g.phaseAt=now;return append(s,b,t,{text:'游客体验已取消，未消费物品'},'cancelled',now);}
  if(now<t.readyAt)throw fail('游客尚未完成体验','visitor_early');if(now>t.expiresAt)throw fail('游客体验已过期，请取消后重试','visitor_expired');
  if(g.stop!==t.stop||g.itinerary[g.stop]!==t.buildingId)throw fail('游客行程已变化','visitor_stale');
  const result=settleVisit(s,g,t.buildingId,'visitor:'+b.epoch+':'+t.guestId+':'+t.stop,v.activeSeconds,{quote:t.quote,owner:t.owner});
  if(t.quote.paid&&result.paid!==t.quote.paid)throw fail('本次游客消费未能确认，请读取已确认进度','visitor_delivery');
  g.spent+=result.paid;g.ratings.push(result.paid?effectiveQuality(s.facilities[t.buildingId])+12:18);g.stop++;g.phase='landed';g.phaseAt=now;g.lease=null;delete v.leases[t.requestId];releaseResources(s,t.owner);log(s,b,result.reason);
  return append(s,b,t,{...result,text:result.reason,guest:structuredClone(g)},'finished',now);
 }
 const g=guest(v,i.guestId);
 if(i.operation==='land'){
  if(g.phase!=='onboard')throw fail('游客已经上岛','visitor_phase');if(now<g.landReadyAt)throw fail('游客尚未走完下船栈桥','visitor_early');
  const t=ticket(s,b,i,now,{guestId:g.id});g.phase='landed';g.phaseAt=now;g.arrivedAt=v.activeSeconds;s.economy.arrivals++;
  const text=g.name+'经客运栈桥上岛，想体验'+g.itinerary.map(id=>BUILDINGS[id].name).join('、')+'。';log(s,b,text);return append(s,b,t,{guest:structuredClone(g),text},'finished',now);
 }
 if(i.operation==='begin'){
  if(g.phase!=='landed'||g.lease)throw fail('游客正在其他阶段','visitor_phase');
  if(i.stop!==g.stop||i.buildingId!==g.itinerary[g.stop]||g.stop>=g.itinerary.length)throw fail('游客需按已确认行程体验场馆','visitor_itinerary');
  const quote=visitQuote(s,g,i.buildingId),t=ticket(s,b,i,now,{guestId:g.id,guestName:g.name,stop:g.stop,buildingId:i.buildingId,quote,duration:ECONOMY_RULES.serviceSeconds,readyAt:now+ECONOMY_RULES.serviceSeconds*1000});
  if(quote.paid&&quote.item&&!reserveResources(s,t.owner,{[quote.item]:1},{purpose:'游客消费 '+g.name}).ok)throw fail('商品已被另一作业预留','visitor_stock');
  v.leases[t.requestId]=t;g.phase='servicing';g.phaseAt=now;g.lease=t.requestId;sync(s,b);return {ticket:t,receipt:null};
 }
 if(i.operation==='review'){
  if(g.lease||g.phase==='onboard'||g.phase==='servicing')throw fail('游客仍在体验或下船','visitor_phase');
  if(g.phase==='reviewed'){const t=ticket(s,b,i,now,{guestId:g.id});return append(s,b,t,{rating:g.rating,guest:structuredClone(g),alreadyReviewed:true},'finished',now);}
  if(g.stop<g.itinerary.length&&v.activeSeconds-g.arrivedAt<220)throw fail('游客行程尚未结束','visitor_itinerary');
  if(!Number.isInteger(i.queue)||i.queue<0||i.queue>=HARBOR_LAYOUTS[v.theme].waiting.length||Object.values(v.guests).some(x=>x.id!==g.id&&x.queue===i.queue))throw fail('候船位已占用，请选择空位','visitor_queue');
  const t=ticket(s,b,i,now,{guestId:g.id}),rating=reviewVisit(s,g);g.phase='reviewed';g.phaseAt=now;g.rating=rating;g.queue=i.queue;g.boardReadyAt=now+Math.ceil(boardingSeconds(v.theme,g.queue)*1000);
  const text=g.name+'结束游玩，消费 '+g.spent+' 岛币，评价 '+rating.toFixed(1)+' 星。';log(s,b,text);return append(s,b,t,{rating,guest:structuredClone(g),text},'finished',now);
 }
 if(i.operation==='depart'){
  if(g.phase!=='reviewed')throw fail('游客尚未完成离岛评价','visitor_phase');if(now<g.boardReadyAt)throw fail('游客尚未走完登船跳板','visitor_early');
  const t=ticket(s,b,i,now,{guestId:g.id}),text=g.name+'已登船，等待渡船离港。';log(s,b,text);v.history.push({...g,phase:'departed',departedAt:v.activeSeconds});v.history=v.history.slice(-64);delete v.guests[g.id];return append(s,b,t,{text,guestId:g.id},'finished',now);
 }
 throw fail('不支持的游客命令');
}
