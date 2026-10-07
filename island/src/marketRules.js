import {seededRandom} from './gameLevels.js';
import {validCraftEvent} from './craftGameReplay.js';
export const MARKET_STOCK=Object.freeze({bread:6,tea:4,pottery:3,bouquet:3});
export const MARKET_EQUIPMENT=Object.freeze({c9_0:1,c8_2:1});
export const MARKET_GOODS=Object.freeze(Object.keys(MARKET_STOCK));
const preferences={0:['bread'],1:['pottery'],2:['tea'],3:['tea','pottery'],4:['bouquet'],5:['pottery'],6:['bread'],7:['bouquet'],8:['tea'],9:['tea'],10:['tea','bread'],11:['bread'],12:['bouquet'],13:['bouquet','pottery'],14:['pottery']};
const sorted=a=>[...a].sort().join('|'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const shuffle=(a,r)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function createMarketGame(seed,difficulty='normal',excluded=[1,2,6]){
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff||!['normal','easy'].includes(difficulty)||!Array.isArray(excluded)||excluded.length>4||new Set(excluded).size!==excluded.length||excluded.some(n=>!Number.isInteger(n)||n<0||n>14))throw Error('Invalid market setup');
 const r=seededRandom(seed),pile=shuffle(MARKET_GOODS.flatMap(id=>Array(MARKET_STOCK[id]).fill(id)),r),pool=Object.keys(preferences).map(Number).filter(id=>!excluded.includes(id)),deck=[];
 for(let i=0;i<12;i++){
  const goods=[pile.pop()];if(i%3===2)goods.push(pile.pop());
  const used=deck.slice(Math.floor(i/4)*4).map(o=>o.npcId),all=pool.filter(id=>!used.includes(id)),preferred=all.filter(id=>preferences[id].includes(goods[0])),candidates=preferred.length?preferred:all;
  deck.push({id:i,npcId:candidates[Math.floor(r()*candidates.length)],goods,patience:(difficulty==='easy'?17:11)+r()*3,phrase:goods.length===2?'给自己和朋友各带一份。':'想带一份喜欢的海岛手艺。'});
 }
 return{engine:'market',version:1,seed,difficulty,excluded:[...excluded],elapsed:0,phase:'setup',wave:0,clock:0,nextSpawn:0,spawned:0,deck,queue:[],stock:{...MARKET_STOCK},layout:['bread','tea','pottery'],parcel:[],packing:null,results:[],mistakes:0,streak:0,bestStreak:0,displayHits:0,calm:0,effectSerial:0,effect:null};
}
export function marketSummary(g){
 const served=g.results.filter(r=>r.outcome==='served'),quality=Math.max(0,Math.min(100,Math.round(served.length/12*60+g.displayHits/16*20+g.calm/12*10+g.bestStreak/12*10-g.mistakes*2)));
 return{served:served.length,missed:g.results.filter(r=>r.outcome==='missed').length,quality,reward:Math.floor(quality*.8),passed:served.length>=6&&quality>=45,bestStreak:g.bestStreak,unsold:{...g.stock}};
}
function effect(g,type,data={}){g.effect={id:++g.effectSerial,type,...data};}
function spawn(g){
 while(g.spawned<4&&g.clock+1e-8>=g.nextSpawn){
  const spec=g.deck[g.wave*4+g.spawned];g.queue.push({...structuredClone(spec),remaining:spec.patience,ready:false});g.spawned++;g.nextSpawn+=(g.difficulty==='easy'?5:4.4);effect(g,'arrive',{orderId:spec.id,npcId:spec.npcId});
 }
}
function finishWave(g){
 if(g.spawned!==4||g.queue.length||g.packing)return;
 g.phase=g.wave===2?'results':'intermission';g.parcel=[];effect(g,g.phase==='results'?'result':'wave',{wave:g.wave,summary:marketSummary(g)});
}
function completeOrder(g,o,outcome){
 const served=outcome==='served',hits=served?o.goods.filter(id=>g.layout.includes(id)).length:0,calm=served&&o.remaining>=o.patience*.6?1:0;
 if(served){for(const id of o.goods)g.stock[id]--;g.streak++;g.bestStreak=Math.max(g.bestStreak,g.streak);g.displayHits+=hits;g.calm+=calm;}else g.streak=0;
 g.results.push({id:o.id,npcId:o.npcId,goods:[...o.goods],outcome,remaining:o.remaining,streak:g.streak,displayHits:hits,calm});
 g.queue=g.queue.filter(x=>x.id!==o.id);
 if(served||g.packing?.orderId===o.id){g.packing=null;g.parcel=[];}
 effect(g,outcome,{orderId:o.id,npcId:o.npcId,streak:g.streak});
}
export function applyMarketEvent(g,e){
 if(!validCraftEvent(e))throw Error('Invalid market input');if(e.neutral)return g;
 if(Object.hasOwn(e,'dt')){
  if(g.phase!=='running')return g;
  g.elapsed+=e.dt;g.clock+=e.dt;
  // Travel has no patience cost. It never pauses customers who already arrived.
  for(const o of [...g.queue]){
   if(!o.ready)continue;
   o.remaining=Math.max(0,o.remaining-e.dt);
   if(o.remaining===0)completeOrder(g,o,'missed');
  }
  if(g.packing){
   g.packing.elapsed+=e.dt;const o=g.queue.find(o=>o.id===g.packing.orderId);
   if(o&&g.packing.elapsed>=g.packing.duration)completeOrder(g,o,'served');
  }
  spawn(g);finishWave(g);return g;
 }
 const a=e.action;
 if(a.type==='display'){
  if(!['setup','intermission'].includes(g.phase)||!Number.isInteger(a.station)||a.station<0||a.station>2||!MARKET_GOODS.includes(a.item))throw Error('Invalid market display');
  const other=g.layout.indexOf(a.item),old=g.layout[a.station];g.layout[a.station]=a.item;if(other>=0&&other!==a.station)g.layout[other]=old;effect(g,'display',{station:a.station,item:a.item});return g;
 }
 if(a.type==='start'){
  if(!['setup','intermission'].includes(g.phase)||new Set(g.layout).size!==3)throw Error('Invalid market wave start');
  if(g.phase==='intermission')g.wave++;g.phase='running';g.clock=0;g.nextSpawn=0;g.spawned=0;g.parcel=[];spawn(g);return g;
 }
 if(a.type==='arrive'){
  const o=g.queue.find(o=>o.id===a.index);if(g.phase!=='running'||!o||o.ready)throw Error('Invalid market arrival');
  o.ready=true;effect(g,'checkin',{orderId:o.id});return g;
 }
 if(a.type==='add'){
  if(g.phase!=='running'||!MARKET_GOODS.includes(a.item))throw Error('Invalid market parcel');
  if(g.packing||g.parcel.length>=2||g.stock[a.item]<=g.parcel.filter(id=>id===a.item).length){effect(g,'blocked',{item:a.item});return g;}
  g.parcel.push(a.item);effect(g,'add',{item:a.item});return g;
 }
 if(a.type==='clear'){if(g.phase!=='running')throw Error('Invalid market clear');if(!g.packing)g.parcel=[];return g;}
 if(a.type==='pack'){
  const o=g.queue.find(o=>o.id===a.index);if(g.phase!=='running'||!o||!o.ready)throw Error('Invalid market customer');if(g.packing)return g;
  if(sorted(o.goods)!==sorted(g.parcel)){g.mistakes++;g.streak=0;o.remaining=Math.max(.1,o.remaining-2);effect(g,'wrong',{orderId:o.id});return g;}
  if(o.goods.some(id=>g.stock[id]<o.goods.filter(x=>x===id).length))throw Error('Market stock unavailable');
  const display=o.goods.every(id=>g.layout.includes(id));g.packing={orderId:o.id,elapsed:0,duration:display?1.3:2.2};effect(g,'pack',{orderId:o.id,display});return g;
 }
 throw Error('Unknown market operation');
}
export function validMarketGame(g){
 try{
  const n=v=>Number.isFinite(v)&&v>=0,int=v=>Number.isSafeInteger(v)&&v>=0,obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(!obj(g)||g.engine!=='market'||g.version!==1||!n(g.elapsed)||!['setup','running','intermission','results'].includes(g.phase)||!int(g.wave)||g.wave>2||!n(g.clock)||!n(g.nextSpawn)||!int(g.spawned)||g.spawned>4)return false;
  const initial=createMarketGame(g.seed,g.difficulty,g.excluded);if(!same(g.deck,initial.deck))return false;
  if(!obj(g.stock)||Object.keys(g.stock).length!==4||!MARKET_GOODS.every(id=>int(g.stock[id])&&g.stock[id]<=MARKET_STOCK[id]))return false;
  if(!Array.isArray(g.layout)||g.layout.length!==3||new Set(g.layout).size!==3||!g.layout.every(id=>MARKET_GOODS.includes(id)))return false;
  if(!Array.isArray(g.parcel)||g.parcel.length>2||!g.parcel.every(id=>MARKET_GOODS.includes(id))||g.parcel.some(id=>g.parcel.filter(x=>x===id).length>g.stock[id]))return false;
  if(!Array.isArray(g.queue)||g.queue.length>4||!Array.isArray(g.results)||g.results.length>12)return false;
  const ids=[...g.queue,...g.results].map(o=>o.id);if(new Set(ids).size!==ids.length)return false;
  const spec=o=>int(o.id)&&o.id<12&&o.npcId===g.deck[o.id].npcId&&same(o.goods,g.deck[o.id].goods)&&n(o.remaining)&&o.remaining<=g.deck[o.id].patience;
  if(g.queue.some(o=>!spec(o)||o.id<g.wave*4||o.id>=g.wave*4+g.spawned||o.patience!==g.deck[o.id].patience||typeof o.ready!=='boolean'||!o.ready&&o.remaining!==o.patience||o.remaining===0))return false;
  if(g.results.some(o=>!spec(o)||o.id>=g.wave*4+g.spawned||!['served','missed'].includes(o.outcome)||!int(o.streak)||!int(o.displayHits)||o.displayHits>o.goods.length||![0,1].includes(o.calm)||o.outcome==='missed'&&(o.remaining!==0||o.streak!==0||o.displayHits!==0||o.calm!==0)))return false;
  const served=g.results.filter(o=>o.outcome==='served');
  if(!['mistakes','streak','bestStreak','displayHits','calm','effectSerial'].every(k=>int(g[k]))||g.streak>g.bestStreak||g.bestStreak>served.length||g.displayHits!==served.reduce((a,o)=>a+o.displayHits,0)||g.calm!==served.reduce((a,o)=>a+o.calm,0)||g.bestStreak!==Math.max(0,...served.map(o=>o.streak)))return false;
  if(!MARKET_GOODS.every(id=>g.stock[id]+served.reduce((a,o)=>a+o.goods.filter(x=>x===id).length,0)===MARKET_STOCK[id]))return false;
  if(g.packing!==null&&(!obj(g.packing)||!int(g.packing.orderId)||!g.queue.some(o=>o.id===g.packing.orderId&&o.ready&&sorted(o.goods)===sorted(g.parcel))||!n(g.packing.elapsed)||![1.3,2.2].includes(g.packing.duration)||g.packing.elapsed>=g.packing.duration+.05))return false;
  if(g.phase==='setup'&&(g.wave!==0||g.spawned!==0||ids.length||g.elapsed!==0))return false;
  if(g.phase==='intermission'&&(g.wave===2||g.spawned!==4||g.queue.length||g.packing||g.results.length!==(g.wave+1)*4))return false;
  if(g.phase==='results'&&(g.wave!==2||g.spawned!==4||g.queue.length||g.packing||g.results.length!==12))return false;
  return g.effect===null||obj(g.effect)&&g.effect.id===g.effectSerial&&typeof g.effect.type==='string';
 }catch{return false;}
}
