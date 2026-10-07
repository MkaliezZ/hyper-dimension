import {FIREWORKS_EQUIPMENT} from './fireworksRules.js';
export const FIREWORKS_INVITES=Object.freeze([{id:1,item:'resin',quantity:1,role:'设备检查',request:'带一份树脂吧。我检查好展台与发射设备，就来帮你看住本场演出。'},{id:3,item:'quartz',quantity:1,role:'风向与星圈',request:'带一块石英，我记好风向与星空的位置，就到广场一起看烟花。'},{id:12,item:'bamboo',quantity:1,role:'节拍与伴奏',request:'带一份竹材做节拍器吧，我准备好三幕节拍，就去广场陪大家。'}]);
import {COUTURE_EQUIPMENT} from './coutureRules.js';
export const COUTURE_INVITES=Object.freeze([{id:13,item:'fiber',quantity:1,role:'裁缝评审',request:'带一份植物纤维，我检查缝线和主题搭配后到广场评审。'},{id:7,item:'shell',quantity:1,role:'摄影评审',request:'带一枚贝壳做合影标记，我来记录大家的展示。'},{id:2,item:'bread',quantity:1,role:'主持评审',request:'带一份面包吧，我准备好以后主持三轮穿搭展示。'},{id:0,item:'wheat',quantity:1,role:'田园模特',model:true,request:'给我一份小麦，收好农事工具后我愿意试试自己的穿搭。'},{id:4,item:'rose',quantity:1,role:'花园模特',model:true,request:'带一朵玫瑰，我安排好花园的事就来走秀。'},{id:12,item:'bamboo',quantity:1,role:'音乐模特',model:true,request:'带一份竹材吧，我准备好节拍器就来参加穿搭展示。'}]);
import {RAW_MATERIALS,ITEM_BY_ID,RECIPE_BY_ID,recipeGate} from './contentCatalog.js';
import {RESIDENTS} from './world.js';
import {MARKET_STOCK,MARKET_EQUIPMENT} from './marketRules.js';
export const MARKET_INVITES=Object.freeze([{id:6,item:'bread',quantity:1,role:'茶点摊主',request:'给我一份面包吧。我确认好烘焙品，就去广场照看茶点摊。'},{id:1,item:'wood',quantity:1,role:'手作摊主',request:'带一份木材给我补好摊架，我来照看陶器与手作。'},{id:2,item:'tea',quantity:1,role:'主持与交付',request:'带一份茶给我吧。我确认好签到和包装台，就来迎接大家。'}]);
export const PARTY_TAGS=Object.freeze([{id:'sea',name:'海风'},{id:'nature',name:'花园'},{id:'cuisine',name:'茶点'},{id:'craft',name:'手作'},{id:'stars',name:'星空'},{id:'music',name:'音乐'}]);
export const FISHING_INVITES=Object.freeze([{id:8,item:'c16_2',quantity:1,role:'渔具与潮汐',request:'帮我带一个贝壳浮漂。我检查好钓具，就来一起看潮。'},{id:2,item:'bread',quantity:1,role:'主持与签到',request:'给我带一份面包吧。我吃好以后，就能陪大家认真比完六竿。'}]);
export const THEME_GUESTS=Object.freeze([
 {id:1,tags:['craft'],item:'resin',role:'手作布置',request:'带一份树脂给我吧。我把海边的小装饰做好，就来陪大家。'},
 {id:3,tags:['stars'],item:'quartz',role:'观星与潮汐',request:'带一块石英，我们借它记下今晚的星光。准备好我就来观赛。'},
 {id:4,tags:['nature'],item:'rose',role:'花园布置',request:'给我带一朵玫瑰吧。我会把花园的颜色带到海边。'},
 {id:5,tags:['sea','craft'],item:'wood',role:'海边设施',request:'带一份木材让我补好海边的小椅子，之后一起看比赛。'},
 {id:6,tags:['cuisine'],item:'seasalt',role:'主题茶点',request:'带一份海盐给我，我把这阵海风烤进茶点里，再来陪大家。'},
 {id:7,tags:['sea','nature'],item:'shell',role:'聚会摄影',request:'带一枚贝壳给我做照片里的小标记，我会来记录大家相聚。'},
 {id:10,tags:['nature','stars'],item:'herb',role:'海岛故事',request:'带一份草药给我做书签吧。我会选个海岛故事带到聚会。'},
 {id:12,tags:['music'],item:'bamboo',role:'海风伴奏',request:'给我一份竹材做小节拍器，我会到海边陪大家等潮汐。'},
 {id:13,tags:['craft'],item:'fiber',role:'主题穿搭',request:'带一份植物纤维，我补好海风围巾就来看看大家的装扮。'},
 {id:14,tags:['sea','stars'],item:'shell',role:'纪念收藏',request:'带一枚贝壳给我吧。我会来帮大家留下这次相聚的纪念。'}
]);
const validTags=new Set(PARTY_TAGS.map(t=>t.id));
export const NIGHT_INVITES=Object.freeze([{id:0,item:'wheat',quantity:1,role:'农田与星灯',request:'带一份小麦给我吧。我收好田间工具，就到广场陪你放飞星灯。'},{id:2,item:'lantern',quantity:1,role:'主持与放飞',request:'给我带一盏灯笼，我确认好放飞的位置，就到广场等大家。'}]);
export function eventRequests(event){const guest=THEME_GUESTS.find(g=>g.id===event?.guestId);return [...(event?.template==='fireworks'?FIREWORKS_INVITES:event?.template==='couture'?COUTURE_INVITES:event?.template==='market'?MARKET_INVITES:event?.template==='night'?NIGHT_INVITES:FISHING_INVITES),...(guest?[{...guest,quantity:1,themeGuest:true}]:[])];}
export function eventCost(event){if(event?.template==='fireworks')return{coins:14,tea:1};if(event?.template==='couture')return{coins:12,fiber:2,tea:1};if(event?.template==='market')return{coins:12,...MARKET_STOCK};if(event?.template==='night')return{coins:8,lantern:1,wheat:2,...(event.fireworks?{firework:1}:{})};return {coins:10,c16_4:1,bread:2+(Number.isInteger(event?.guestId)?1:0)};}
export function partyDraftStamp(d){return d?JSON.stringify([d.id,d.version,d.name,partyInputSignature(d)]):null;}
export function partyInputSignature(p){if(p.template==='market')return JSON.stringify([p.template,p.description||'',p.tags||[],p.difficulty,p.guestId??null]);if(p.template==='night')return JSON.stringify([p.template,p.description||'',p.tags||[],p.difficulty,p.guestId??null,!!p.fireworks]);return JSON.stringify([p.description||'',p.tags||[],p.difficulty,p.guestId??null]);}
export function validatePartyProposal(s,input){
 if(!input||input.template&&!['fishing','night','market','couture','fireworks'].includes(input.template))return {ok:false,reason:'当前可玩的主题模板是钓鱼大会、星灯夜集、海岛集市、穿搭大会和星海烟花大会'};
 const {name,description='',tags=[],difficulty='normal',guestId=null}=input;
 if(typeof name!=='string'||!name.trim()||name.length>24||typeof description!=='string'||description.length>200)return {ok:false,reason:'名称需为 1–24 字，主题描述不超过 200 字'};
 if(!Array.isArray(tags)||tags.length>2||new Set(tags).size!==tags.length||tags.some(t=>!validTags.has(t)))return {ok:false,reason:'从现有主题中选择最多两种'};
 if(!['normal','easy'].includes(difficulty))return {ok:false,reason:'请选择标准或轻松难度'};
 if(guestId!==null&&(!Number.isInteger(guestId)||!THEME_GUESTS.some(g=>g.id===guestId&&g.tags.some(t=>tags.includes(t)))))return {ok:false,reason:'主题嘉宾必须来自符合主题的岛上居民'};
 if(input.template==='fireworks'&&FIREWORKS_INVITES.some(r=>r.id===guestId))return{ok:false,reason:'烟花嘉宾不能重复设备、风向或节拍岗位'};
 if(input.template==='couture'&&COUTURE_INVITES.some(r=>r.id===guestId))return{ok:false,reason:'主题嘉宾不能重复占用评审或模特岗位'};
 if(input.template==='market'&&MARKET_INVITES.some(r=>r.id===guestId))return{ok:false,reason:'集市主题嘉宾不能重复占用三位摊主的岗位'};
 const required=input.template==='fireworks'?[...Object.keys(FIREWORKS_EQUIPMENT),'tea']:input.template==='couture'?[...Object.keys(COUTURE_EQUIPMENT),'fiber','tea']:input.template==='market'?['bread','tea','pottery','bouquet','c9_0','c8_2']:input.template==='night'?['lantern','wheat',...(input.fireworks?['firework']:[])]:['rod','c8_2','c16_4','c16_2','bread'];
 if(required.some(id=>{const item=ITEM_BY_ID[id],r=RECIPE_BY_ID[item?.recipeId];return !item||r&&!recipeGate(r,s).ready}))return {ok:false,reason:'当前活动用品的图纸未开放，先完成对应建筑的准备'};
 const proposal={template:input.template||'fishing',name:name.trim(),description:description.trim(),tags:[...tags].sort(),difficulty,guestId,guestReason:String(input.guestReason||'').slice(0,180)};
 if(input.template==='night'){if(input.fireworks!==undefined&&typeof input.fireworks!=='boolean')return{ok:false,reason:'烟花选项无效'};proposal.fireworks=!!input.fireworks;}if(input.autoHost!==undefined&&typeof input.autoHost!=='boolean')return{ok:false,reason:'主持委托选项无效'};if(input.autoHost===true)proposal.autoHost=true;return {ok:true,proposal};
}
export function partyPlanningContext(s,template='fishing'){if(template==='fireworks'){const f=s.fireworksParty||{},d=f.draft;return{template,maxThemeGuests:1,day:s.day,hostedToday:s.lastPartyDay===s.day,draft:d?{id:d.id,version:d.version,stamp:partyDraftStamp(d),name:d.name,description:d.description,tags:d.tags,difficulty:d.difficulty,guestId:d.guestId,invited:Object.keys(d.invites||{}).filter(id=>d.invites[id].version===d.version).map(Number)}:null,session:f.session?{id:f.session.id,name:f.session.name,phase:f.session.phase}:null,tags:PARTY_TAGS,fixedRoles:FIREWORKS_INVITES.map(r=>({...r,name:s.npcProfiles?.[r.id]?.name||RESIDENTS[r.id].name})),candidates:THEME_GUESTS.filter(g=>!FIREWORKS_INVITES.some(r=>r.id===g.id)).map(g=>({...g,name:s.npcProfiles?.[g.id]?.name||RESIDENTS[g.id].name,personality:String(s.npcProfiles?.[g.id]?.personality||RESIDENTS[g.id].personality).slice(0,160),giftName:ITEM_BY_ID[g.item].name})),cost:{coins:14,tea:1},equipment:{...FIREWORKS_EQUIPMENT},invitation:'小墨、星野、黎音与可选嘉宾需亲自赠物并同意当前版本；关键条件改变后重邀，已交赠物不重复收取。',instructions:'六枚真实烟花，三幕每幕两枚；编排颜色/形状/发射位，依据风向瞄准星圈，在亮拍绽放。只有实际发射的烟花消耗，未发射者与旗帜归还；收益0–78币，六枚全部发射、至少五枚合拍并且品质75可获稀有纪念品。'};}if(template==='couture'){const f=s.coutureParty||{},d=f.draft;return{template,maxThemeGuests:1,day:s.day,hostedToday:s.lastPartyDay===s.day,draft:d?{id:d.id,version:d.version,stamp:partyDraftStamp(d),name:d.name,description:d.description,tags:d.tags,difficulty:d.difficulty,guestId:d.guestId,invited:Object.keys(d.invites||{}).filter(id=>d.invites[id].version===d.version).map(Number)}:null,session:f.session?{id:f.session.id,name:f.session.name,phase:f.session.phase}:null,tags:PARTY_TAGS,fixedRoles:COUTURE_INVITES.map(r=>({...r,name:s.npcProfiles?.[r.id]?.name||RESIDENTS[r.id].name})),candidates:THEME_GUESTS.filter(g=>!COUTURE_INVITES.some(r=>r.id===g.id)).map(g=>({...g,name:s.npcProfiles?.[g.id]?.name||RESIDENTS[g.id].name,personality:String(s.npcProfiles?.[g.id]?.personality||RESIDENTS[g.id].personality).slice(0,160),giftName:ITEM_BY_ID[g.item].name})),cost:{coins:12,fiber:2,tea:1},equipment:{...COUTURE_EQUIPMENT},invitation:'六位评审与模特及可选嘉宾需玩家亲自对话、赠物、同意本版条件；改变条件需重新确认，不重复收已交赠物。',instructions:'六类衣槽按实际衣架选择，三轮随机主题、额度与舒适度，实际沿秀道登台并完成四个姿态亮拍。服装留用不消耗，修整纤维/后台茶和场地费消耗；0–54币，品质65且至少6次合拍可获纪念品。'};}if(template==='market'){const f=s.festivalParty||{},d=f.draft;return{template,maxThemeGuests:1,day:s.day,hostedToday:s.lastPartyDay===s.day,draft:d?{id:d.id,version:d.version,stamp:partyDraftStamp(d),name:d.name,description:d.description,tags:d.tags,difficulty:d.difficulty,guestId:d.guestId,invited:Object.keys(d.invites||{}).filter(id=>d.invites[id].version===d.version).map(Number)}:null,session:f.session?{id:f.session.id,name:f.session.name,phase:f.session.phase}:null,tags:PARTY_TAGS,fixedRoles:MARKET_INVITES.map(r=>({...r,name:s.npcProfiles?.[r.id]?.name||RESIDENTS[r.id].name})),candidates:THEME_GUESTS.filter(g=>!MARKET_INVITES.some(r=>r.id===g.id)).map(g=>({...g,name:s.npcProfiles?.[g.id]?.name||RESIDENTS[g.id].name,personality:String(s.npcProfiles?.[g.id]?.personality||RESIDENTS[g.id].personality).slice(0,160),giftName:ITEM_BY_ID[g.item].name})),cost:{coins:12,...MARKET_STOCK},equipment:{...MARKET_EQUIPMENT},invitation:'三位摊主与主题嘉宾需亲自对话，交付赠物并同意当前版本。关键条件变更后重新邀请，已送出的同种赠物不重复收取。',instructions:'三波共12位真实居民顾客，订单共16件商品；选择三种陈列品，按顾客偏好打包交付。顾客实际到摊后才计耐心；售出商品消耗，未售商品结束或取消时退回。奖励0–80币，至少服务6人且品质45分可获首场R集市灯牌。'};}if(template==='night'){const d=s.nightParty?.draft;return{template,day:s.day,hostedToday:s.lastPartyDay===s.day,draft:d?{id:d.id,version:d.version,stamp:partyDraftStamp(d),name:d.name,description:d.description,tags:d.tags,difficulty:d.difficulty,guestId:d.guestId,fireworks:d.fireworks,invited:Object.keys(d.invites||{}).filter(id=>d.invites[id].version===d.version).map(Number)}:null,session:s.partySession?{id:s.partySession.id,phase:'running'}:null,tags:PARTY_TAGS,fixedRoles:NIGHT_INVITES.map(r=>({...r,name:s.npcProfiles?.[r.id]?.name||RESIDENTS[r.id].name})),candidates:THEME_GUESTS.map(g=>({...g,name:s.npcProfiles?.[g.id]?.name||RESIDENTS[g.id].name,personality:s.npcProfiles?.[g.id]?.personality||RESIDENTS[g.id].personality,giftName:ITEM_BY_ID[g.item].name})),cost:{coins:8,lantern:1,wheat:2,fireworkOptional:1},equipment:{},invitation:'关键居民必须亲自对话、交付物品、同意当前版本；关键条件改动重新确认，已赠物不重复收取。',instructions:'广场四盏星灯放飞，主题嘉宾有独立站位；奖励沿用20–28币，服装加2、烟花加3。'};}
 const f=s.fishingParty||{},draft=f.draft;
 return {template:'fishing',maxThemeGuests:1,day:s.day,hostedToday:s.lastPartyDay===s.day,
  draft:draft?{id:draft.id,version:draft.version,stamp:partyDraftStamp(draft),name:draft.name,description:draft.description||'',tags:draft.tags||[],difficulty:draft.difficulty,guestId:draft.guestId??null,invited:Object.keys(draft.invites||{}).filter(id=>draft.invites[id].version===draft.version).map(Number)}:null,
  session:f.session?{id:f.session.id,name:f.session.name,phase:f.session.phase}:null,
  tags:PARTY_TAGS,fixedRoles:FISHING_INVITES.map(r=>({...r,name:s.npcProfiles?.[r.id]?.name||RESIDENTS[r.id].name})),
  candidates:THEME_GUESTS.map(g=>({...g,name:s.npcProfiles?.[g.id]?.name||RESIDENTS[g.id].name,personality:(s.npcProfiles?.[g.id]?.personality||RESIDENTS[g.id].personality).slice(0,160),giftName:ITEM_BY_ID[g.item].name,giftSource:RAW_MATERIALS.find(r=>r.id===g.item)?.source})),
  cost:{coins:10,bait:1,bread:2,extraGuestBread:1},equipment:{rod:1,c8_2:1},
  invitation:'岛主必须亲自对话、交付约定物品并取得同意。关键条件变更重新确认，同一赠物不重复收取。',
  instructions:'嘉宾只观赛，不改变三人六竿比赛与 30–42 币奖励。主题不生成新的小游戏。'};
}
export const PARTY_TEMPLATES=Object.freeze(['fishing','night','market','couture','fireworks']);
export function partyPlanningContexts(s){return Object.fromEntries(PARTY_TEMPLATES.map(t=>[t,partyPlanningContext(s,t)]));}
export function cleanPartyContext(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const template=input.template??'fishing';if(!PARTY_TEMPLATES.includes(template))return null;
 const canonical=partyPlanningContext({day:1},template),draft=input.draft;
 const p={...canonical,day:Number.isSafeInteger(input.day)&&input.day>0?input.day:1,hostedToday:!!input.hostedToday,draft:null,session:null};
 if(draft&&/^[\w-]{1,100}$/.test(draft.id)&&Number.isSafeInteger(draft.version)&&draft.version>0&&draft.version<=100000){
  p.draft={id:draft.id,version:draft.version,name:String(draft.name||'').slice(0,24),description:String(draft.description||'').slice(0,200),tags:(Array.isArray(draft.tags)?draft.tags:[]).filter(t=>validTags.has(t)).slice(0,2),difficulty:draft.difficulty==='easy'?'easy':'normal',guestId:Number.isInteger(draft.guestId)?draft.guestId:null,stamp:typeof draft.stamp==='string'?draft.stamp.slice(0,1000):null,invited:(Array.isArray(draft.invited)?draft.invited:[]).filter(id=>Number.isInteger(id)&&id>=0&&id<15).slice(0,template==='couture'?7:4)};
  if(template==='night')p.draft.fireworks=!!draft.fireworks;
 }
 if(input.session&&typeof input.session==='object')p.session={id:String(input.session.id||'').slice(0,100),name:String(input.session.name||'').slice(0,24),phase:String(input.session.phase||'').slice(0,20)};
 const candidates=Array.isArray(input.candidates)?input.candidates:[],roles=Array.isArray(input.fixedRoles)?input.fixedRoles:[];
 p.candidates=canonical.candidates.map(g=>{const r=candidates.find(r=>r?.id===g.id);return {...g,name:String(r?.name||g.name).slice(0,20),personality:String(r?.personality||g.personality).slice(0,160)};});
 p.fixedRoles=canonical.fixedRoles.map(g=>{const r=roles.find(r=>r?.id===g.id);return {...g,name:String(r?.name||g.name).slice(0,20)};});return p;
}
export function cleanPartyContexts(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return {};
 return Object.fromEntries(PARTY_TEMPLATES.filter(t=>input[t]?.template===t).map(t=>[t,cleanPartyContext(input[t])]).filter(([,p])=>p));
}
