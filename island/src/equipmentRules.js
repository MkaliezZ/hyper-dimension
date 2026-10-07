import {availableQuantity,commitResources,nextOperationId,reserveResources,releaseResources} from './resourceLedger.js';
export const EQUIPMENT_VERSION=35;
export const WEAR_SLOTS={body:'主服',bottom:'下装',apron:'围裙',outer:'披肩',head:'头饰',hands:'手套'};
export const GARMENTS=Object.fromEntries([
 ['outfit','主题服装','body',0,0,'full',true],['c4_1','亚麻衬衫','body',0,1,'full',false],['c4_2','棉布围裙','apron',0,2,'apron',false],
 ['c4_3','海风草帽','head',1,0,'hat',false],['c4_4','矿工手套','hands',1,1,'gloves',false],['c4_10','珍珠发饰','head',1,2,'comb',false],
 ['c4_5','花园披肩','outer',2,0,'shawl',false],['c4_6','星空斗篷','outer',2,1,'cape',false],['c4_7','海盐条纹裙','bottom',2,2,'skirt',false],
 ['c4_8','玫瑰礼服','body',3,0,'full',true],['c4_9','航海制服','body',3,1,'full',false],['c4_11','折光舞衣','body',3,2,'full',true]
].map(([id,name,slot,pack,row,kind,onePiece])=>[id,{id,name,slot,pack,row,kind,onePiece}]));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const record=r=>r&&typeof r==='object'&&!Array.isArray(r)&&!!GARMENTS[r.item]&&typeof r.personalCredit==='boolean';
function primary(w){return w.slots?.body||Object.values(w.slots||{}).find(Boolean)||null}
function syncWardrobe(s,w){w.equipped=primary(w);s.playerProfile??={};s.playerProfile.outfit=w.equipped?.item||null;return w}
export function validWardrobe(s){
 const w=s.wardrobe;if(w===undefined)return true;
 if(!w||!Array.isArray(w.history))return false;
 if(w.version===1)return w.equipped===null?!s.playerProfile?.outfit:record(w.equipped)&&s.playerProfile?.outfit===w.equipped.item;
 if(w.version!==2||!w.slots||Array.isArray(w.slots)||typeof w.slots!=='object'||Object.keys(w.slots).some(k=>!own(WEAR_SLOTS,k)))return false;
 for(const [slot,r] of Object.entries(w.slots))if(r!==null&&(!record(r)||GARMENTS[r.item].slot!==slot))return false;
 if(GARMENTS[w.slots.body?.item]?.onePiece&&w.slots.bottom)return false;
 const p=primary(w);
 return JSON.stringify(p)===JSON.stringify(w.equipped)&&s.playerProfile?.outfit===(p?.item||null);
}
export function hydrateWardrobe(s){
 s.playerProfile??={};let w=s.wardrobe;
 if(w?.version===2)return w;
 const old=w?.version===1&&record(w.equipped)?{...w.equipped}:GARMENTS[s.playerProfile.outfit]?{item:s.playerProfile.outfit,personalCredit:false,legacy:true}:null;
 // Version 1 already removed this copy from inventory. Move the record, never mint a garment.
 w={version:2,slots:Object.fromEntries(Object.keys(WEAR_SLOTS).map(k=>[k,null])),history:Array.isArray(w?.history)?w.history.slice(-40):[]};
 if(old)w.slots[GARMENTS[old.item].slot]=old;
 s.wardrobe=w;return syncWardrobe(s,w);
}
export function wornItems(s){const w=s.wardrobe;if(w?.version===2)return Object.values(w.slots||{}).filter(Boolean).map(r=>r.item);return w?.equipped?[w.equipped.item]:GARMENTS[s.playerProfile?.outfit]?[s.playerProfile.outfit]:[]}
export function isWorn(s,id){return wornItems(s).includes(id)}
export function equipOutfit(id,s){
 const g=GARMENTS[id],w=hydrateWardrobe(s);if(!g)return {ok:false,text:'这件物品不是服装'};
 if(isWorn(s,id))return {ok:true,unchanged:true,text:'已经穿着'+g.name+'，不重复取用'};
 if(availableQuantity(s,id)<1)return {ok:false,text:'没有可穿的这一件，库存可能已预留'};
 const removed=[g.slot];
 if(g.slot==='body'&&g.onePiece)removed.push('bottom');
 if(g.slot==='bottom'&&GARMENTS[w.slots.body?.item]?.onePiece)removed.push('body');
 const olds=removed.map(slot=>({slot,row:w.slots[slot]})).filter(x=>x.row),gain={};
 for(const {row} of olds)gain[row.item]=(gain[row.item]||0)+1;
 const personalCredit=(s.economy?.playerGoods?.[id]||0)>0;
 const result=commitResources(s,{id:nextOperationId(s,'wardrobe'),cost:{[id]:1},gain,category:'wardrobe',note:'穿上'+g.name});
 if(!result.ok)return {ok:false,text:'服装暂时无法取用'};
 for(const {slot,row} of olds){if(row.personalCredit&&s.economy?.playerGoods)s.economy.playerGoods[row.item]=(s.economy.playerGoods[row.item]||0)+1;w.slots[slot]=null}
 w.slots[g.slot]={item:id,personalCredit};w.history.push({day:s.day,slot:g.slot,from:olds.map(x=>x.row.item),to:id});w.history=w.history.slice(-40);syncWardrobe(s,w);
 return {ok:true,text:'已穿上'+g.name+' · '+WEAR_SLOTS[g.slot]+(olds.length?'，替换的衣物已放回背包':'')};
}
export function unequipOutfit(s,id=null){
 const w=hydrateWardrobe(s),olds=Object.entries(w.slots).filter(([,r])=>r&&(!id||r.item===id));if(!olds.length)return {ok:true,unchanged:true,text:'这件衣物已收好'};
 const gain={};for(const [,r] of olds)gain[r.item]=(gain[r.item]||0)+1;
 const result=commitResources(s,{id:nextOperationId(s,'wardrobe'),gain,category:'wardrobe',note:id?'换下'+GARMENTS[id]?.name:'收好全部衣物'});
 if(!result.ok)return {ok:false,text:'暂时无法归还衣物'};
 for(const [slot,row] of olds){if(row.personalCredit&&s.economy?.playerGoods)s.economy.playerGoods[row.item]=(s.economy.playerGoods[row.item]||0)+1;w.slots[slot]=null}
 w.history.push({day:s.day,from:olds.map(([,r])=>r.item),to:null});w.history=w.history.slice(-40);syncWardrobe(s,w);
 return {ok:true,text:olds.map(([,r])=>GARMENTS[r.item].name).join('、')+'已放回背包'};
}
export const BASE_TOOLS={hoe:'hoe',pickaxe:'pickaxe',water:'watering_can',axe:'axe',harvest:'sickle',fish:'rod'};
export const TOOLS=Object.fromEntries([
 ['hoe','田间锄头','hoe',.85,0,0],['pickaxe','矿工镐','pickaxe',.9,.03,0],['watering_can','浇水壶','water',.85,0,0],
 ['axe','伐木斧','axe',.8,0,0],['sickle','收割镰','harvest',.82,0,0],['rod','渔竿','fish',.92,0,6],['c16_9','远投钓竿','fish',.85,0,14]
].map(([id,name,action,durationScale,precisionBonus,trackingBonus])=>[id,{id,name,action,durationScale,precisionBonus,trackingBonus}]));
export function validToolbelt(s){return s.toolbelt===undefined||!!s.toolbelt&&typeof s.toolbelt==='object'&&!Array.isArray(s.toolbelt)&&Object.entries(s.toolbelt).every(([action,id])=>own(BASE_TOOLS,action)&&TOOLS[id]?.action===action)}
export function equipTool(id,s){const spec=TOOLS[id];if(!spec)return {ok:false,text:'这件物品不是作业工具'};if(availableQuantity(s,id)<1)return {ok:false,text:'这件工具正在预留或不在背包中'};s.toolbelt??={...BASE_TOOLS};s.toolbelt[spec.action]=id;return {ok:true,text:'已装备'+spec.name+'，作业时会预留这一件'}}
export function resolveTool(s,action,{owner=null,npc=false}={}){
 const base=BASE_TOOLS[action];if(!base)return null;
 if(npc)return {...TOOLS[base],source:'resident',durationScale:1,precisionBonus:0,trackingBonus:0};
 const selected=s.toolbelt?.[action],id=TOOLS[selected]?.action===action?selected:base;
 const owned=availableQuantity(s,id,owner)>0;
 if(owned)return {...TOOLS[id],source:'owned'};
 if(id!==base&&availableQuantity(s,base,owner)>0)return {...TOOLS[base],source:'owned',requested:id};
 return {...TOOLS[base],source:'borrowed',requested:id,durationScale:1,precisionBonus:0,trackingBonus:0};
}
export function minePrecision(s,tool=resolveTool(s,'pickaxe')){return Math.min(.17,.12+(tool?.precisionBonus||0)+(isWorn(s,'c4_4')?.015:0))}
export function beginToolUse(s,action,seconds){
 let tool=resolveTool(s,action),owner=null;
 if(tool?.source==='owned'&&!s.resourceControl?.enabled){
  owner=nextOperationId(s,'player-tool');const lock=reserveResources(s,owner,{[tool.id]:1},{purpose:'岛主'+tool.name+'作业'});
  if(!lock.ok){owner=null;tool={...TOOLS[BASE_TOOLS[action]],source:'borrowed',durationScale:1,precisionBonus:0,trackingBonus:0}}
 }
 return {tool,owner,duration:Math.max(.85,seconds*(tool?.durationScale||1))};
}
export function endToolUse(s,use){if(use?.owner?.startsWith('player-tool:'))releaseResources(s,use.owner)}
export function clearToolLeases(s){if(s.resourceControl?.enabled)return;for(const key of Object.keys(s.resourceLedger?.reservations||{}))if(key.startsWith('player-tool:'))releaseResources(s,key)}
export function toolPurpose(id,s){
 const t=TOOLS[id];if(!t)return null;const resolved=resolveTool(s,t.action);
 const effects=['作业时长减少 '+Math.round((1-t.durationScale)*100)+'%'];
 if(t.precisionBonus)effects.push('采矿精准区宽度增加 '+Math.round(t.precisionBonus*200)+' 个百分点');
 if(t.trackingBonus)effects.push('普通钓场控鱼与落点容错半径 +'+t.trackingBonus);
 return {action:'装备工具',text:effects.join('；')+'。有可用实物才生效，作业时预留、结束归还；公共借用保持基础效果。',status:resolved.id===id&&resolved.source==='owned'?'当前自有装备':availableQuantity(s,id)<1?'库存不足或正在预留':'可装备'};
}
