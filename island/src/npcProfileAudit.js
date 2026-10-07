import {RESIDENTS} from './world.js';

export const NPC_PROFILE_FIELDS=Object.freeze([
 {key:'name',label:'姓名',max:16},{key:'personality',label:'性格',max:160},
 {key:'lifeGoal',label:'生活目标',max:120},{key:'speechStyle',label:'说话风格',max:100}
]);
export const NPC_AUDIT_LIMIT=128;
const validId=id=>Number.isInteger(id)&&id>=0&&id<RESIDENTS.length;
const version=v=>Number.isSafeInteger(v)&&v>=0?v:0;
const fields=value=>Object.fromEntries(NPC_PROFILE_FIELDS.map(f=>[f.key,typeof value?.[f.key]==='string'?value[f.key].slice(0,f.max):'']));
const copy=value=>JSON.parse(JSON.stringify(value));
export function npcAuditProfile(state,id){
 if(!validId(id))throw Error('居民编号无效');
 return {...RESIDENTS[id],...(state.npcProfiles?.[id]||{}),version:version(state.npcProfiles?.[id]?.version??RESIDENTS[id].version)};
}
function validEntry(e){
 return e&&typeof e.id==='string'&&/^profile-\d+$/.test(e.id)&&validId(e.npcId)&&
  typeof e.requestId==='string'&&e.requestId.length<=120&&
  Number.isSafeInteger(e.beforeVersion)&&e.beforeVersion>=0&&Number.isSafeInteger(e.version)&&e.version===e.beforeVersion+1&&
  typeof e.at==='string'&&Number.isFinite(Date.parse(e.at))&&
  NPC_PROFILE_FIELDS.every(f=>typeof e.before?.[f.key]==='string'&&e.before[f.key].length<=f.max&&typeof e.after?.[f.key]==='string'&&e.after[f.key].length<=f.max)&&
  ['edit','restore'].includes(e.source);
}
export function hydrateNpcProfileAudit(state){
 const old=state.npcProfileAudit||{},seen=new Set();
 const entries=(Array.isArray(old.entries)?old.entries:[]).filter(validEntry).filter(e=>{
  if(seen.has(e.id)||seen.has('request:'+e.requestId))return false;
  seen.add(e.id);seen.add('request:'+e.requestId);return true;
 }).slice(-NPC_AUDIT_LIMIT).map(e=>({
  id:e.id,requestId:e.requestId,npcId:e.npcId,at:e.at,day:Number.isInteger(e.day)&&e.day>0?e.day:1,
  beforeVersion:e.beforeVersion,version:e.version,before:fields(e.before),after:fields(e.after),
  changed:NPC_PROFILE_FIELDS.filter(f=>e.before[f.key]!==e.after[f.key]).map(f=>f.key),
  source:e.source,restoreFrom:typeof e.restoreFrom==='string'?e.restoreFrom.slice(0,40):null
 }));
 const highest=Math.max(0,...entries.map(e=>Number(e.id.slice(8))));
 state.npcProfileAudit={schema:1,serial:Math.max(highest,version(old.serial)),
  totalCount:Math.max(entries.length,version(old.totalCount)),entries};
 return state.npcProfileAudit;
}
export function npcAuditEntries(state,id=null){
 if(id!==null&&!validId(id))throw Error('居民编号无效');
 return hydrateNpcProfileAudit(state).entries.filter(e=>id===null||e.npcId===id).slice().reverse().map(copy);
}
export function editNpcProfile(state,id,input,{expectedVersion,requestId,now=Date.now(),restoreFrom=null}={}){
 if(!validId(id))return {ok:false,code:'invalid_id',reason:'居民编号无效'};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!NPC_PROFILE_FIELDS.some(f=>f.key===k)))
  return {ok:false,code:'invalid_fields',reason:'仅可修改姓名、性格、生活目标和说话风格'};
 if(NPC_PROFILE_FIELDS.some(f=>typeof input[f.key]!=='string'||input[f.key].trim().length>f.max)||!input.name?.trim()||!input.personality?.trim())
  return {ok:false,code:'invalid_fields',reason:'姓名与性格不能为空，字段需完整且在字数限制内'};
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0||typeof requestId!=='string'||!requestId||requestId.length>120||!Number.isFinite(now)||!Number.isFinite(new Date(now).getTime()))
  return {ok:false,code:'invalid_request',reason:'修改版本或记录编号无效'};
 const after=Object.fromEntries(NPC_PROFILE_FIELDS.map(f=>[f.key,input[f.key].trim()]));
 const audit=hydrateNpcProfileAudit(state),repeated=audit.entries.find(e=>e.requestId===requestId);
 if(repeated){
  const same=repeated.npcId===id&&repeated.beforeVersion===expectedVersion&&NPC_PROFILE_FIELDS.every(f=>repeated.after[f.key]===after[f.key])&&repeated.restoreFrom===(restoreFrom||null);
  return same?{ok:true,changed:false,replayed:true,entry:copy(repeated)}:{ok:false,code:'request_conflict',reason:'同一修改编号已有不同内容，请重新打开档案'};
 }
 const current=npcAuditProfile(state,id);
 if(expectedVersion!==current.version)return {ok:false,code:'version_conflict',reason:'档案已更新，请重新打开后再修改'};
 if(current.version>=Number.MAX_SAFE_INTEGER||audit.serial>=Number.MAX_SAFE_INTEGER||audit.totalCount>=Number.MAX_SAFE_INTEGER)
  return {ok:false,code:'version_limit',reason:'档案记录已达到版本上限'};
 if(restoreFrom&&!audit.entries.some(e=>e.id===restoreFrom&&e.npcId===id))
  return {ok:false,code:'missing_record',reason:'原记录已不在近期历史中，请重新选择'};
 const before=fields(current),changed=NPC_PROFILE_FIELDS.filter(f=>before[f.key]!==after[f.key]).map(f=>f.key);
 if(!changed.length)return {ok:true,changed:false,version:current.version};
 const entry={id:'profile-'+(++audit.serial),requestId,npcId:id,at:new Date(now).toISOString(),
  day:Number.isInteger(state.day)&&state.day>0?state.day:1,beforeVersion:current.version,version:current.version+1,
  before,after,changed,source:restoreFrom?'restore':'edit',restoreFrom:restoreFrom||null};
 state.npcProfiles??={};state.npcProfiles[id]={...(state.npcProfiles[id]||{}),...after,version:entry.version};
 audit.totalCount++;audit.entries.push(entry);audit.entries=audit.entries.slice(-NPC_AUDIT_LIMIT);
 return {ok:true,changed:true,version:entry.version,entry:copy(entry)};
}
