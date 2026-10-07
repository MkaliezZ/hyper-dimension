import {WONDER_DEFINITIONS} from './eventWonders.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {functionalDefinition} from './facilityCatalog.js';
import {functionalStorageReason} from './functionalFacilities.js';
import {availableQuantity,commitResources} from './resourceLedger.js';
import {worldSlots,worldWalkableForTheme,HARBOR_LAYOUTS} from './world.js';
import {wonderPlacements} from './fishingWonderArt.js';
export const PLACEMENT_LIMIT=64,PLACEMENT_GRID=8;
const kinds=new Set(['decor','collection','component']),directions=['朝前','朝右','朝后','朝左'];
const key=s=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]{1,150}$/.test(s)&&!['__proto__','constructor','prototype'].includes(s);
export const canPlaceItem=id=>!!ITEM_BY_ID[id]&&(kinds.has(ITEM_BY_ID[id].category)||!!functionalDefinition(id))&&id!=='c16_4';
export function displayShape(item,rotation=0){
 const i=ITEM_BY_ID[item],tier=i?.tier||0,facility=functionalDefinition(item);if(facility)return {...facility.shape};let rx=i?.category==='component'?16:22+tier*3,ry=11+tier*2;
 if(rotation%2)[rx,ry]=[Math.max(13,ry+3),Math.max(13,rx*.65)];
 return {rx,ry,h:42+tier*8};
}
export function snapDisplay(x,y){return {x:Math.round(x/PLACEMENT_GRID)*PLACEMENT_GRID,y:Math.round(y/PLACEMENT_GRID)*PLACEMENT_GRID};}
export function decorationColliders(s,{except=null}={}){
 return (s.placedItems||[]).filter(p=>p.version===2&&p.id!==except).map(p=>({...p,...displayShape(p.item,p.rotation)}));
}
export function placementObstacles(s,theme,{except=null,extra=null}={}){
 const slots=[];for(const p of worldSlots(theme))slots[p.id]=p;
 return [...decorationColliders(s,{except}),...wonderPlacements(s,slots),...(extra?[{...extra,...displayShape(extra.item,extra.rotation)}]:[])];
}
function anchors(theme){
 return [...worldSlots(theme).map(p=>({...p.entry,name:'建筑入口 '+p.id})),{x:430,y:703,name:'农田'},{x:445,y:360,name:'林地'},{x:1157,y:275,name:'矿洞'},{x:786,y:458,name:'派对广场'},{...HARBOR_LAYOUTS[theme].entrance,name:'码头入口'}];
}
export function connectedPlacements(s,theme,{except=null,extra=null}={}){
 const obstacles=placementObstacles(s,theme,{except,extra}),cell=24,w=78,h=53,mask=new Int8Array(w*h);mask.fill(-1);
 const ok=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return false;const n=y*w+x;if(mask[n]<0)mask[n]=worldWalkableForTheme(theme,x*cell,y*cell,obstacles)?1:0;return mask[n]===1;};
 const nearest=p=>{let best=null;for(let y=Math.round(p.y/cell)-1;y<=Math.round(p.y/cell)+1;y++)for(let x=Math.round(p.x/cell)-1;x<=Math.round(p.x/cell)+1;x++){const d=Math.hypot(x*cell-p.x,y*cell-p.y);if(d<=32&&ok(x,y)&&(!best||d<best.d))best={x,y,d};}return best;};
 const source=nearest(HARBOR_LAYOUTS[theme].entrance);if(!source)return {ok:false,reason:'码头入口被阻断'};
 const visited=new Uint8Array(w*h),queue=[source.y*w+source.x];visited[queue[0]]=1;
 for(let head=0;head<queue.length;head++){
  const n=queue[head],x=n%w,y=Math.floor(n/w);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const xx=x+dx,yy=y+dy,k=yy*w+xx;if(!ok(xx,yy)||visited[k]||dx&&dy&&(!ok(x+dx,y)||!ok(x,y+dy)))continue;visited[k]=1;queue.push(k);
  }
 }
 for(const p of anchors(theme)){const a=nearest(p);if(!a||!visited[a.y*w+a.x])return {ok:false,reason:p.name+'需要保留通路'};}
 return {ok:true};
}
const overlap=(a,b,gap=0)=>Math.abs(a.x-b.x)<a.rx+b.rx+gap&&Math.abs(a.y-b.y)<a.ry+b.ry+gap;
function partyLocked(s,p){return !!(s.partySession||s.festivalParty?.session?.phase==='running'||s.fireworksParty?.session?.phase==='running'||s.coutureParty?.session?.phase==='running')&&Math.hypot(p.x-786,p.y-458)<190;}
export function checkDecoration(s,p,{theme=s.placementBook?.theme,except=null,actors=[],connectivity=true}={}){
 if(!['pixel','origami'].includes(theme)||!canPlaceItem(p.item)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isInteger(p.rotation)||p.rotation<0||p.rotation>3)return {ok:false,reason:'布置参数不完整'};
 const shape=displayShape(p.item,p.rotation),candidate={...p,...shape};
 if(p.x<80||p.x>1430||p.y<85||p.y>824||p.x>1122&&p.y>790)return {ok:false,reason:'请放在岛上的陆地空位，栈桥与航线留给行人'};
 if(Math.hypot(p.x-786,p.y-458)<82)return {ok:false,reason:'广场中心留给集会，请布置在周围空位'};
 if(partyLocked(s,p))return {ok:false,reason:'活动进行中，广场布置暂时锁定'};
 const slots=[];for(const slot of worldSlots(theme))slots[slot.id]=slot;
 const wonderSpaces=wonderPlacements({eventWonders:{owned:Object.fromEntries(Object.keys(WONDER_DEFINITIONS).map(id=>[id,{}])),displays:Object.fromEntries(Object.keys(WONDER_DEFINITIONS).map(id=>[id,true]))}},slots);
 if(wonderSpaces.some(o=>overlap(candidate,o,7)))return {ok:false,reason:'这里是奇观陈列位，请保留收藏空间'};
 const obstacles=placementObstacles(s,theme,{except});
 if(obstacles.some(o=>overlap(candidate,o,7)))return {ok:false,reason:'与已有摆件或奇观重叠'};
 const walk=(x,y)=>worldWalkableForTheme(theme,x,y);
 const sample=(center,r)=>{const points=[center-r-8,center+r+8];for(let n=center-r;n<center+r;n+=8)points.push(n);return points;};
 for(const x of sample(p.x,shape.rx))for(const y of sample(p.y,shape.ry))if(!walk(x,y))return {ok:false,reason:'占地超出空位，或与建筑、田地、海岸重叠'};
 for(const a of anchors(theme))if(Math.abs(p.x-a.x)<shape.rx+30&&Math.abs(p.y-a.y)<shape.ry+30)return {ok:false,reason:a.name+'附近请留出进出空间'};
 if(actors.some(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)&&Math.abs(p.x-a.x)<shape.rx+14&&Math.abs(p.y-a.y)<shape.ry+14))return {ok:false,reason:'有人正在经过这个位置，请稍候或换一个空位'};
 return connectivity?connectedPlacements(s,theme,{except,extra:p}):{ok:true};
}
function quality(s,building){
 s.decorBonuses??={};const old=s.decorBonuses[building]||0,next=Math.max(0,...(s.placedItems||[]).filter(p=>p.building===building).map(p=>1+(ITEM_BY_ID[p.item]?.tier||0)));
 const f=s.facilities?.[building];if(f){
  s.decorQualityState??={};const saved=s.decorQualityState[building],base=Math.max(0,Math.min(95,saved?saved.base+f.quality-saved.lastQuality:f.quality-old));
  f.quality=Math.min(95,base+next);s.decorQualityState[building]={base,lastQuality:f.quality};
 }s.decorBonuses[building]=next;
}
function returnPersonal(s,p){if(p.personalCredit){s.economy??={};s.economy.playerGoods??={};s.economy.playerGoods[p.item]=(s.economy.playerGoods[p.item]||0)+1;}}
export function hydratePlacements(s,theme){
 s.placedItems??=[];if(s.placementBook)return s.placementBook;
 s.placementBook={version:1,theme,revision:0,serial:0,receipts:{},history:[]};
 const old=s.placedItems;s.placedItems=[];
 for(const legacy of old){
  if(!canPlaceItem(legacy.item)){s.placedItems.push(legacy);continue;}
  const item=ITEM_BY_ID[legacy.item],slot=worldSlots(theme).find(p=>p.id===item.building),start={x:slot.entry.x+38,y:slot.entry.y+8};
  let found=null;
  for(let radius=0;radius<=200&&!found;radius+=24)for(let i=0;i<(radius?16:1);i++){
   const p={item:item.id,...snapDisplay(start.x+Math.cos(i*Math.PI/8)*radius,start.y+Math.sin(i*Math.PI/8)*radius),rotation:0};
   if(checkDecoration(s,p,{theme}).ok){found=p;break;}
  }
  if(found)s.placedItems.push({...found,id:'display-'+(++s.placementBook.serial),building:item.building,personalCredit:!!legacy.personalCredit,version:2});
  else{s.inventory[legacy.item]=(s.inventory[legacy.item]||0)+1;returnPersonal(s,legacy);s.placementBook.history.push({day:s.day,action:'migration_storage',item:legacy.item,text:'旧陈列附近没有安全空位，已完整收回背包'});quality(s,item.building);}
 }
 return s.placementBook;
}
function failure(reason){return {ok:false,reason};}
export function decorate(s,input,{theme,actors=[]}={}){
 if(!['pixel','origami'].includes(theme))return failure('画风无效');
 const book=hydratePlacements(s,theme);if(book.theme!==theme)return failure('当前岛屿已经更换');
 const {commandId,action,displayId,item,x,y,rotation=0,expectedRevision}=input,signature=JSON.stringify([action,displayId||null,item||null,x??null,y??null,rotation,expectedRevision??null]);
 if(!key(commandId))return failure('操作编号无效');
 if(Object.hasOwn(book.receipts,commandId)){const r=book.receipts[commandId];return r.signature===signature?{...structuredClone(r.result),replayed:true}:failure('相同操作编号不能用于不同布置');}
 if(expectedRevision!==undefined&&expectedRevision!==book.revision)return failure('布置已变化，请重新选择位置');
 if(!['place','move','store'].includes(action))return failure('布置操作无效');
 const current=action==='place'?null:s.placedItems.find(p=>p.id===displayId);
 if(action!=='place'&&!current)return failure('这个摆件已经被收回');
 if(current&&partyLocked(s,current))return failure('活动进行中，这件广场布置暂时锁定');
 if(current&&(s.npcPresence||[]).some(n=>n.facilityId===current.id))return failure('居民正在使用这件设施，请等使用结束');
 if(current&&action==='move'&&s.functionalFacilities?.units[current.id]?.phase==='watering')return failure('正在灌溉，请先关闭灌溉再移动');
 if(current&&action==='store'){const reason=functionalStorageReason(s,current.id);if(reason)return failure(reason);}
 const placedItem=action==='place'?item:current.item;
 if(!canPlaceItem(placedItem))return failure('这件物品不能放置');
 if(action==='place'&&(s.placedItems.length>=PLACEMENT_LIMIT||availableQuantity(s,item)<1))return failure(s.placedItems.length>=PLACEMENT_LIMIT?'岛上最多同时陈列 64 件，请先收回一件':'物品不足，或已留给筹备任务');
 let result;
 if(action==='store'){
  const credited=commitResources(s,{id:'display:'+commandId, gain:{[current.item]:1},category:'display_storage'});if(!credited.ok)return failure('收回记录冲突');
  s.placedItems.splice(s.placedItems.indexOf(current),1);if(s.functionalFacilities?.units[current.id]){delete s.functionalFacilities.units[current.id];s.functionalFacilities.revision++;}returnPersonal(s,current);quality(s,current.building);
  result={ok:true,id:current.id,item:current.item,text:ITEM_BY_ID[current.item].name+'已完整收回背包'};
 }else{
  const candidate={item:placedItem,...snapDisplay(x,y),rotation};
  const legal=checkDecoration(s,candidate,{theme,except:current?.id,actors});if(!legal.ok)return legal;
  if(action==='place'){
   const credit=(s.economy?.playerGoods?.[item]||0)>0,debit=commitResources(s,{id:'display:'+commandId,cost:{[item]:1},category:'display_place'});
   if(!debit.ok)return failure('物资不足，未放置');
   const row={...candidate,id:'display-'+(++book.serial),building:ITEM_BY_ID[item].building,personalCredit:credit,version:2};s.placedItems.push(row);quality(s,row.building);
   result={ok:true,id:row.id,item,text:ITEM_BY_ID[item].name+'已布置 · '+directions[rotation]};
  }else{Object.assign(current,candidate);result={ok:true,id:current.id,item:current.item,text:ITEM_BY_ID[current.item].name+'已移动 · '+directions[rotation]};}
 }
 book.revision++;book.receipts[commandId]={signature,day:s.day,result:structuredClone(result)};
 book.history.push({day:s.day,action,id:result.id,item:result.item,text:result.text});book.history=book.history.slice(-80);
 return result;
}
export function validPlacements(s,{connectivity=false}={}){
 if(s.placedItems===undefined&&s.placementBook===undefined)return true;
 if(!Array.isArray(s.placedItems)||s.placedItems.length>PLACEMENT_LIMIT)return false;
 if(s.decorQualityState!==undefined&&(!s.decorQualityState||typeof s.decorQualityState!=='object'||Array.isArray(s.decorQualityState)||Object.entries(s.decorQualityState).some(([id,q])=>!Number.isInteger(Number(id))||Number(id)<0||Number(id)>24||!q||![q.base,q.lastQuality].every(n=>Number.isFinite(n)&&n>=0&&n<=95))))return false;
 const b=s.placementBook;if(b===undefined)return s.placedItems.every(p=>canPlaceItem(p.item)&&p.building===ITEM_BY_ID[p.item].building&&p.version===undefined);
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 if(b.version!==1||!['pixel','origami'].includes(b.theme)||!Number.isSafeInteger(b.revision)||b.revision<0||!Number.isSafeInteger(b.serial)||b.serial<0||!object(b.receipts)||!Array.isArray(b.history)||b.history.length>80)return false;
 if(new Set(s.placedItems.map(p=>p.id)).size!==s.placedItems.length)return false;
 for(const p of s.placedItems){
  if(!/^display-[1-9][0-9]*$/.test(p.id||'')||Number(p.id.slice(8))>b.serial||p.version!==2||p.building!==ITEM_BY_ID[p.item]?.building||typeof p.personalCredit!=='boolean'||!checkDecoration({...s,partySession:null},p,{theme:b.theme,except:p.id,connectivity:false}).ok)return false;
 }
 if(Object.entries(b.receipts).some(([id,r])=>!key(id)||typeof r.signature!=='string'||r.signature.length>500||!Number.isSafeInteger(r.day)||r.day<1||r.result?.ok!==true||!key(r.result.id)||!canPlaceItem(r.result.item)||typeof r.result.text!=='string'))return false;
 return !connectivity||connectedPlacements(s,b.theme).ok;
}
