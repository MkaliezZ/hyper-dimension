import {FUNCTIONAL_FACILITIES,functionalDefinition} from './facilityCatalog.js';
import {availableQuantity,commitResources} from './resourceLedger.js';
import {HOTSPOTS} from './world.js';
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const key=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
const integer=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const fresh=item=>({item,phase:'idle',elapsed:0,cycle:0,charges:0,servings:0,condition:100,enabled:false,targets:[],currentPlot:null,currentCrop:null,delivered:0,lastText:'布置完成，等待投入物资'});
export function hydrateFunctionalFacilities(s){
 s.functionalFacilities??={version:1,revision:0,units:{},receipts:{},history:[]};
 for(const p of s.placedItems||[])if(functionalDefinition(p.item)&&!s.functionalFacilities.units[p.id])s.functionalFacilities.units[p.id]=fresh(p.item);
 return s.functionalFacilities;
}
export function functionalUnit(s,id){return s.functionalFacilities?.units[id]||null;}
export function protectedPlot(s,index){return !!s.plots?.[index]?.playerTended||index===0&&!s.journey?.completed?.harvest;}
export function irrigationConnected(s,id){
 const p=(s.placedItems||[]).find(p=>p.id===id),farm=HOTSPOTS.find(h=>h.type==='farm');
 return !!p&&!!farm&&Math.hypot(p.x-farm.entry.x,p.y-farm.entry.y)<=FUNCTIONAL_FACILITIES.c14_6.range;
}
export function functionalStorageReason(s,id){
 const u=functionalUnit(s,id);if(!u)return null;
 if((s.npcPresence||[]).some(n=>n.facilityId===id))return '居民正在使用，请等茶歇结束再移动或收回';
 if(u.phase!=='idle'||u.charges>0||u.servings>0)return '设施还有在制品或余料，请先收取、用完，或在设施页明确清空';
 return null;
}
export function functionalView(s,id){
 const u=functionalUnit(s,id),p=(s.placedItems||[]).find(p=>p.id===id),d=functionalDefinition(p?.item);if(!u||!d)return null;
 const missing=Object.fromEntries(Object.entries(d.cost).map(([k,n])=>[k,Math.max(0,n-availableQuantity(s,k))]).filter(([,n])=>n));
 const ready=u.phase==='ready',growing=['growing','brewing','watering'].includes(u.phase);
 let status=ready?(d.kind==='nursery'?'已育成 · 可收取海虾 ×3':'茶已温好 · 待客 '+u.servings+' 杯'):growing?(!u.enabled?'已暂停 · 保留当前进度':d.kind==='nursery'?'正在育养':d.kind==='tea'?'正在温茶':'正在灌溉'):d.kind==='irrigation'?(u.enabled?(u.charges?'等待已播种的连接田地':'过滤器已耗尽'):'灌溉已关闭'):'等待投料';
 if(d.kind==='irrigation'&&u.enabled&&!irrigationConnected(s,id))status='离农田太远 · 请搬到农田周围';
 return {unit:u,definition:d,missing,status,progress:growing||ready?Math.min(1,u.elapsed/d.seconds):0,remaining:growing?Math.max(0,d.seconds-u.elapsed):0,canLoad:u.phase==='idle'&&!u.charges&&!u.servings&&u.condition>=8&&!Object.keys(missing).length,canStore:!functionalStorageReason(s,id)};
}
function releaseWater(id,u,hooks){if(u.currentPlot!=null)hooks.releasePlot?.(u.currentPlot,'facility:'+id);u.currentPlot=null;u.currentCrop=null;if(u.phase==='watering'){u.phase='idle';u.elapsed=0;}}
export function functionalCommand(s,input,hooks={}){
 const b=hydrateFunctionalFacilities(s),{commandId,displayId,action,expectedRevision}=input;
 if(!key(commandId)||!Number.isSafeInteger(expectedRevision))return {ok:false,reason:'设施操作编号或版本无效'};
 const signature=JSON.stringify([displayId,action,input.targets??null,input.enabled??null,expectedRevision]);
 const previous=b.receipts[commandId];if(previous)return previous.signature===signature?{...structuredClone(previous.result),replayed:true}:{ok:false,reason:'同一编号不能用于不同设施操作'};
 if(expectedRevision!==b.revision)return {ok:false,reason:'设施状态已变化，请重新操作'};
 const p=(s.placedItems||[]).find(p=>p.id===displayId),u=b.units[displayId],d=functionalDefinition(p?.item);
 if(!d||!u)return {ok:false,reason:'设施已经收回'};
 const fail=reason=>({ok:false,reason});let text='';
 if(action==='configure'){
  if(d.kind!=='irrigation'||!Array.isArray(input.targets)||input.targets.length>4||new Set(input.targets).size!==input.targets.length||input.targets.some(i=>!integer(i,7))||typeof input.enabled!=='boolean')return fail('连接一至四块田，田地编号不能重复');
  if(input.enabled&&(!input.targets.length||!irrigationConnected(s,displayId)))return fail(!input.targets.length?'请先连接田地':'设施离农田太远，请先移动到农田周边');
  releaseWater(displayId,u,hooks);u.targets=[...input.targets];u.enabled=input.enabled;text=u.enabled?'已连接田地，等待有种子的田进入浇水阶段':'已关闭灌溉，余料保留';
 }else if(action==='load'){
  if(u.phase!=='idle'||u.charges||u.servings)return fail('请先完成或清空当前一批，不能叠加投料');
  if(u.condition<8)return fail('设备需要清洁维护后才能再投料');
  if(!commitResources(s,{id:'facility:'+commandId,cost:d.cost,category:'facility_input',note:d.name+' 投料'}).ok)return fail('所需物资不足或已预留给其他任务');
  u.cycle++;u.elapsed=0;
  if(d.kind==='irrigation'){u.charges=d.capacity;text='已安装过滤器，可供八次灌溉';}
  else{u.phase=d.kind==='nursery'?'growing':'brewing';u.enabled=true;text=d.kind==='nursery'?'海虾与饲料已投入，开始育养':'花茶与木材已投入，开始温茶';}
 }else if(action==='pause'||action==='resume'){
  if(d.kind==='irrigation')return fail('请使用灌溉开关');
  if(!['growing','brewing'].includes(u.phase))return fail('当前没有进行中的生产');
  u.enabled=action==='resume';text=u.enabled?'已继续，沿用保留进度':'已暂停，原料和进度留在设施内';
 }else if(action==='harvest'){
  if(d.kind!=='nursery'||u.phase!=='ready')return fail('海虾尚未育成');
  if(!commitResources(s,{id:'facility:'+commandId,gain:{shrimp:d.capacity},category:'facility_harvest',note:d.name}).ok)return fail('收取记录冲突');
  u.delivered+=d.capacity;u.phase='idle';u.elapsed=0;u.enabled=false;text='收取海虾 ×3，可继续加工或再投料';
 }else if(action==='sip'){
  if(d.kind!=='tea'||u.phase!=='ready'||u.servings<1)return fail('茶已用完，需重新温茶');
  if(!commitResources(s,{id:'facility:'+commandId,category:'facility_tea',note:'茶炉饮茶'}).ok)return fail('饮茶记录冲突');
  u.servings--;u.delivered++;if(!u.servings){u.phase='idle';u.elapsed=0;u.enabled=false;}text='享用一杯暖茶';
 }else if(action==='clean'){
  if(['growing','brewing','watering'].includes(u.phase))return fail('先完成生产或暂停并清空，再做清洁');
  if(u.condition===100)return fail('设施已经洁净');
  if(!commitResources(s,{id:'facility:'+commandId,cost:{seaweed:1,sand:1},category:'facility_maintenance',note:d.name+' 清洁'}).ok)return fail('清洁需要海藻 ×1、细沙 ×1，且不能取用预留物资');
  u.condition=100;text='已清洁设施，状态恢复至 100%';
 }else if(action==='clear'){
  if((s.npcPresence||[]).some(n=>n.facilityId===displayId))return fail('居民正在用茶，请等使用结束');
  releaseWater(displayId,u,hooks);u.phase='idle';u.elapsed=0;u.charges=0;u.servings=0;u.enabled=false;text='已停用并清空，投入的消耗品不返还；设施本体仍在岛上';
 }else return fail('设施操作无效');
 u.lastText=text;b.revision++;const result={ok:true,id:displayId,text};b.receipts[commandId]={signature,result:structuredClone(result)};
 const keys=Object.keys(b.receipts);for(const k of keys.slice(0,-200))delete b.receipts[k];
 b.history.push({id:displayId,day:s.day,action,text});b.history=b.history.slice(-80);return result;
}
export function tickFunctionalFacilities(s,dt,hooks={}){
 if(!Number.isFinite(dt)||dt<=0||s.freshStartPending)return [];
 const b=hydrateFunctionalFacilities(s),events=[];
 for(const [id,u] of Object.entries(b.units)){
  const d=functionalDefinition(u.item),p=(s.placedItems||[]).find(p=>p.id===id);if(!d||!p)continue;
  if(s.facilityControl?.version===1){if(d.kind==='irrigation'&&hooks.remoteWater){if(u.currentPlot!=null&&u.serverFarmRequestId)hooks.finishWater?.(id);else if(u.enabled&&u.charges&&irrigationConnected(s,id)){const i=u.targets.find(i=>s.plots[i]?.stage===2&&!protectedPlot(s,i)&&hooks.claimPlot?.(i,'facility:'+id)!==false);if(i!==undefined)hooks.remoteWater(id,i);}}continue;}
  if(d.kind==='irrigation'){
   if(s.farmControl?.version===1&&hooks.remoteWater){
    if(u.currentPlot!=null&&u.serverFarmRequestId){u.elapsed=Math.min(d.seconds,u.elapsed+dt);if(u.elapsed>=d.seconds)hooks.finishWater?.(id);}
    else if(u.enabled&&u.charges&&irrigationConnected(s,id)){const i=u.targets.find(i=>s.plots[i]?.stage===2&&!protectedPlot(s,i)&&hooks.claimPlot?.(i,'facility:'+id)!==false);if(i!==undefined)hooks.remoteWater(id,i);}
    continue;
   }
   if(!u.enabled||!u.charges||!irrigationConnected(s,id)){releaseWater(id,u,hooks);continue;}
   if(u.currentPlot!=null){
    const i=u.currentPlot,plot=s.plots[i];if(!plot||plot.stage!==2||plot.crop!==u.currentCrop||protectedPlot(s,i)||hooks.claimPlot?.(i,'facility:'+id)===false){releaseWater(id,u,hooks);continue;}
   }else{
    const i=u.targets.find(i=>s.plots[i]?.stage===2&&!protectedPlot(s,i)&&hooks.claimPlot?.(i,'facility:'+id)!==false);
    if(i===undefined)continue;u.currentPlot=i;u.currentCrop=s.plots[i].crop;u.phase='watering';u.elapsed=0;
   }
   u.elapsed=Math.min(d.seconds,u.elapsed+dt);
   if(u.elapsed>=d.seconds){const i=u.currentPlot;s.plots[i].stage=3;s.plots[i].growth=0;u.charges--;u.condition=Math.max(0,u.condition-1);u.delivered++;u.lastText='第 '+(i+1)+' 块田已灌溉，剩余 '+u.charges+' 次';releaseWater(id,u,hooks);b.revision++;events.push(u.lastText);}
  }else if(u.enabled&&['growing','brewing'].includes(u.phase)){
   u.elapsed=Math.min(d.seconds,u.elapsed+dt);
   if(u.elapsed>=d.seconds){u.phase='ready';u.condition=Math.max(0,u.condition-(d.kind==='nursery'?8:3));if(d.kind==='tea')u.servings=d.capacity;u.lastText=d.kind==='nursery'?'海虾已经育成，请收取':'三杯暖茶已经温好，居民可在炉前饮用';b.revision++;events.push(u.lastText);}
  }
 }
 return events;
}
export function teaFacilityOptions(s,npcId,time=0){
 const hungry=s.npcNeeds?.[npcId]?.hunger<42;if(!hungry)return [];
 return (s.placedItems||[]).filter(p=>p.item==='c1_9'&&functionalUnit(s,p.id)?.phase==='ready'&&functionalUnit(s,p.id)?.servings>0&&!(s.npcPresence||[]).some(n=>n.id!==npcId&&n.facilityId===p.id)).map(p=>({goal:'tea',buildingId:null,facilityId:p.id,action:'eat',activity:'eat',duration:10,score:98,purposeId:'need:tea:'+p.id,reason:'到岛上的暖手茶炉喝一杯温好的花茶'}));
}
export function facilityServicePoint(p){
 const v=[[0,1],[1,0],[0,-1],[-1,0]][p.rotation];return {x:p.x+v[0]*47,y:p.y+v[1]*34};
}
export function validFunctionalFacilities(s){
 const b=s.functionalFacilities;if(b===undefined)return true;
 if(!object(b)||b.version!==1||!integer(b.revision)||!object(b.units)||Object.keys(b.units).length>64||!object(b.receipts)||Object.keys(b.receipts).length>200||!Array.isArray(b.history)||b.history.length>80)return false;
 for(const [id,u] of Object.entries(b.units)){
  const p=(s.placedItems||[]).find(p=>p.id===id),d=functionalDefinition(p?.item);
  if(!d||!object(u)||u.item!==p.item||!['idle','growing','brewing','ready','watering'].includes(u.phase)||!Number.isFinite(u.elapsed)||u.elapsed<0||u.elapsed>d.seconds||!integer(u.cycle)||!integer(u.delivered)||!integer(u.charges,8)||!integer(u.servings,3)||!Number.isFinite(u.condition)||u.condition<0||u.condition>100||typeof u.enabled!=='boolean'||!Array.isArray(u.targets)||u.targets.length>4||new Set(u.targets).size!==u.targets.length||u.targets.some(i=>!integer(i,7))||!(u.currentPlot===null||integer(u.currentPlot,7))||!(u.currentCrop===null||typeof u.currentCrop==='string'&&u.currentCrop.length<=30)||typeof u.lastText!=='string'||u.lastText.length>200)return false;
  if(d.kind==='irrigation'){if(!['idle','watering'].includes(u.phase)||u.servings||u.phase==='watering'&&(u.currentPlot===null||!u.targets.includes(u.currentPlot)||!u.charges)||u.phase==='idle'&&(u.currentPlot!==null||u.elapsed!==0))return false;}
  else if(u.charges||u.targets.length||u.currentPlot!==null||u.currentCrop!==null||d.kind==='nursery'&&(!['idle','growing','ready'].includes(u.phase)||u.servings)||d.kind==='tea'&&(!['idle','brewing','ready'].includes(u.phase)||(u.phase==='ready'?u.servings<1:u.servings!==0)))return false;
  if(d.kind!=='irrigation'&&(u.phase==='ready'&&u.elapsed!==d.seconds||u.phase==='idle'&&u.elapsed!==0))return false;
 }
 if(Object.entries(b.receipts).some(([id,r])=>!key(id)||!object(r)||typeof r.signature!=='string'||r.signature.length>600||r.result?.ok!==true||!/^display-[1-9][0-9]*$/.test(r.result.id||'')||typeof r.result.text!=='string'||r.result.text.length>200))return false;
 return b.history.every(r=>object(r)&&/^display-[1-9][0-9]*$/.test(r.id||'')&&integer(r.day)&&r.day>0&&typeof r.action==='string'&&typeof r.text==='string'&&r.text.length<=200);
}
