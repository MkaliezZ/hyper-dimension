import {atomicJSON} from './atomicJson.mjs';
import {validShopfronts} from '../src/shopfronts.js';
import {validResidentLife} from '../src/residentLife.js';
import {assertResourceState,assertResourceJournal,syncResourceState,enableResourceState} from './resourceAuthority.mjs';
import {createLanWonderJournal} from './lanWonderJournal.mjs';
import {assertWonderState,enableWonderState,syncWonderState,recordLanWonder} from './wonderAuthority.mjs';
import {validSaveSlot,legacySaveKey} from '../src/saveStorage.js';
import {createSaveImportIO,importRequestHash} from './saveImportIO.mjs';
import {serverZeroState,bootstrapSaveAuthority,initialIdentity,hasLegacyProgress} from './saveBootstrap.mjs';
import {validPartyHosting} from '../src/partyHosting.js';
import {assertPartyHostingState,syncPartyHosting,recordHostingAction} from './partyHostingActions.mjs';
import {assertFireworksState} from './fireworksActions.mjs';
import {validFireworksParty} from '../src/fireworksParty.js';
import {assertCoutureState} from './coutureActions.mjs';
import {validCoutureParty} from '../src/coutureParty.js';
import {assertFestivalState} from './festivalActions.mjs';
import {validFestivalParty} from '../src/festivalParty.js';
import {assertPlanningState,syncPlanningState} from './planningAuthority.mjs';
import {assertPersonalState,syncPersonalState,applyPersonalCommand} from './personalActions.mjs';
import {assertCrossTasks,queueCrossTask,recordCrossTaskReceipt} from './crossIslandTasks.mjs';
import {createLanEconomyJournal} from './lanEconomyJournal.mjs';
import {assertFacilityState,syncFacilityState,advanceFacilityClock} from './facilityActions.mjs';
import {assertFishingState} from './fishingActions.mjs';
import {createPartyProposalStore} from './partyProposalStore.mjs';
import {assertPartyState} from './partyActions.mjs';
import {assertHireState,recordHireDelivery,assertHireReplacement} from './hireActions.mjs';
import {createRecruitmentStore} from './recruitmentStore.mjs';
import {assertCommerceState,advanceCommerceClock,migrateEconomyPolicy} from './commerceActions.mjs';
import {assertVisitorState,advanceVisitorClock} from './visitorActions.mjs';
import {assertResidentState} from './residentActions.mjs';
import {assertFieldState,advanceFieldClock} from './fieldActions.mjs';
import {assertFarmState,advanceFarmClock} from './farmActions.mjs';
import {newActionBook,validActionBook,assertActionHold,clearActionHolds,actionReplay,applyGatherCommand} from './playerActions.mjs';
import {validFunctionalFacilities} from '../src/functionalFacilities.js';
import {validSpecialization} from '../src/specialization.js';
import {validResidentStories} from '../src/residentStories.js';
import{validNightParty}from'../src/nightPartyPlanning.js';
import {validFishingParty} from '../src/fishingParty.js';
import {validEventWonders} from '../src/eventWonders.js';
import {validAchievements} from '../src/achievements.js';
import {validPlacements} from '../src/placements.js';
import {validProjects} from '../src/projectPlans.js';
import {validRecruitment} from '../src/recruitment.js';
import {validResourceLedger} from '../src/resourceLedger.js';
import {validWardrobe} from '../src/contentCatalog.js';
import {validToolbelt} from '../src/equipmentRules.js';
import {mkdir,readFile,writeFile,unlink,readdir,stat,open} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createZeroState} from '../src/freshStart.js';

export const MAX_SAVE_BYTES=2*1024*1024;
export const MAX_IMPORT_BYTES=8*1024*1024;
const digest=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');
const fail=(message,status=400,code='invalid_save')=>Object.assign(Error(message),{status,code});
const exists=async path=>{try{await stat(path);return true}catch(e){if(e.code==='ENOENT')return false;throw e}};
export function validateState(state,theme=null){
 if(theme&&state?.placementBook&&state.placementBook.theme!==theme)throw fail('布置画风与存档不一致');
 if(!state||Array.isArray(state)||typeof state!=='object'||!Number.isSafeInteger(state.day)||state.day<1||
 !Number.isFinite(state.coins)||state.coins<0||!state.inventory||Array.isArray(state.inventory)||
 !state.player||!Number.isFinite(state.player.x)||!Number.isFinite(state.player.y))throw fail('存档结构无效，未覆盖现有进度');
 for(const [key,value] of Object.entries(state.inventory))if(!/^[a-zA-Z0-9_-]{1,80}$/.test(key)||!Number.isSafeInteger(value)||value<0)throw fail('背包数据无效，未覆盖现有进度');
 if(Buffer.byteLength(JSON.stringify(state))>MAX_SAVE_BYTES)throw fail('存档超出 2 MB 限制',413);
 if(!validPartyHosting(state))throw fail('主持委托记录无效，未覆盖现有进度');
 if(!validEventWonders(state))throw fail('奇观记录无效，未覆盖现有进度');
 if(!validAchievements(state))throw fail('成就记录无效，未覆盖现有进度');
 if(!validShopfronts(state))throw fail('货架记录无效，未覆盖现有进度');
 if(!validFunctionalFacilities(state))throw fail('功能设施记录无效，未覆盖现有进度');
 if(!validPlacements(state,{connectivity:true}))throw fail('岛上布置或通路无效，未覆盖现有进度');
 if(!validNightParty(state))throw fail('夜集方案记录无效，未覆盖现有进度');
 if(!validFireworksParty(state))throw fail('烟花大会记录无效，未覆盖现有进度');
 if(!validCoutureParty(state))throw fail('穿搭大会记录无效，未覆盖现有进度');
 if(!validFestivalParty(state))throw fail('集市活动记录无效，未覆盖现有进度');
 if(!validFishingParty(state))throw fail('钓鱼活动记录无效，未覆盖现有进度');
 if(!validRecruitment(state))throw fail('临时伙伴记录无效，未覆盖现有进度');
 if(!validProjects(state))throw fail('筹备计划记录无效，未覆盖现有进度');
 if(!validWardrobe(state))throw fail('服装装备记录无效，未覆盖现有进度');
 if(!validToolbelt(state))throw fail('工具装备记录无效，未覆盖现有进度');
 if(!validSpecialization(state))throw fail('经营专精记录无效，未覆盖现有进度');
 if(!validResidentLife(state))throw fail('居民相处记录无效，未覆盖现有进度');
 if(!validResidentStories(state))throw fail('居民约定记录无效，未覆盖现有进度');
 if(!validResourceLedger(state))throw fail('物资预留记录无效，未覆盖现有进度');
 return state;
}
function validateDocument(doc,theme){
 if(doc?.state?.placementBook&&doc.state.placementBook.theme!==theme)throw fail('布置画风与存档不一致');
 if(doc?.schema!==1||doc.theme!==theme||!Number.isSafeInteger(doc.revision)||doc.revision<1||typeof doc.version!=='string')throw fail('存档格式不受支持',503,'save_corrupt');
 validateState(doc.state,theme);
 if(!validActionBook(doc.actions)||doc.actions&&doc.actionsChecksum!==digest(doc.actions))throw fail('作业记录校验失败',503,'save_corrupt');
 if(doc.checksum!==digest(doc.state))throw fail('存档校验失败',503,'save_corrupt');
 if(doc.provenance||doc.importReceipts){if(doc.metadataChecksum!==digest([doc.provenance||null,doc.importReceipts||[]])||doc.provenance&&(doc.provenance.version!==1||typeof doc.provenance.origin!=='string')||doc.importReceipts&&(!Array.isArray(doc.importReceipts)||doc.importReceipts.length>20||doc.importReceipts.some(r=>!r||typeof r.id!=='string'||!/^[a-f0-9]{64}$/.test(r.requestHash))))throw fail('存档来源记录校验失败',503,'save_corrupt');}
 assertResourceState(doc.state,doc.actions);assertWonderState(doc.state,doc.actions);assertPlanningState(doc.state,doc.actions);assertPersonalState(doc.state,doc.actions);assertFarmState(doc.state,doc.actions);assertFieldState(doc.state,doc.actions);assertResidentState(doc.state,doc.actions);assertVisitorState(doc.state,doc.actions);assertCommerceState(doc.state,doc.actions);assertPartyState(doc.state,doc.actions);assertHireState(doc.state,doc.actions);assertFishingState(doc.state,doc.actions);assertFestivalState(doc.state,doc.actions);assertCoutureState(doc.state,doc.actions);assertFireworksState(doc.state,doc.actions);assertFacilityState(doc.state,doc.actions);
 return doc;
}
const info=doc=>({schema:doc.schema,theme:doc.theme,revision:doc.revision,version:doc.version,updatedAt:doc.updatedAt,reason:doc.reason,day:doc.state.day,coins:doc.state.coins});
export function createSaveStore({directory,now=()=>Date.now(),backupInterval=300000,externalEconomy=false,externalFault=()=>{},importFault=async()=>{}}){
 const root=resolve(directory),hireRegistry=createRecruitmentStore({directory}),partyProof=createPartyProposalStore({directory}),imports=createSaveImportIO({root,now});
 function paths(theme){
  if(!['pixel','origami'].includes(theme))throw fail('未知画风');
  const dir=join(root,theme);
  return {dir,current:join(dir,'current.json'),previous:join(dir,'previous.json'),history:join(dir,'history'),lock:join(dir,'write.lock'),restart:join(dir,'restart-request.json'),external:join(dir,'lan-wallet.json')};
 }
 async function withLock(theme,fn){
  const p=paths(theme);await mkdir(p.history,{recursive:true});
  const token=randomUUID(),start=Date.now();
  let file;
  while(!file){
   try{file=await open(p.lock,'wx',0o600);await file.writeFile(JSON.stringify({pid:process.pid,token}));await file.close();}
   catch(e){
    if(e.code!=='EEXIST')throw e;
    try{
     const owner=JSON.parse(await readFile(p.lock,'utf8'));let alive=true;
     try{process.kill(owner.pid,0)}catch(error){alive=error.code==='EPERM'}
     if(!alive){await unlink(p.lock);continue}
    }catch{
     // A process can exit after creating the lock but before writing its owner.
     try{if(Date.now()-(await stat(p.lock)).mtimeMs>30000){await unlink(p.lock);continue}}catch{}
    }
    if(Date.now()-start>5000)throw fail('存档正在写入，请稍后重试',503,'save_busy');
    await new Promise(resolve=>setTimeout(resolve,40));
   }
  }
  try{return await fn(p)}finally{
   try{if(JSON.parse(await readFile(p.lock,'utf8')).token===token)await unlink(p.lock)}catch{}
  }
 }
 async function history(p){
  const files=(await readdir(p.history)).filter(x=>/^[a-z0-9-]+\.json$/.test(x));
  const rows=[];
  for(const id of files){try{const doc=validateDocument(JSON.parse(await readFile(join(p.history,id),'utf8')),p.dir.endsWith('origami')?'origami':'pixel');rows.push({id,doc})}catch{}}
  return rows.sort((a,b)=>b.doc.updatedAt.localeCompare(a.doc.updatedAt)||b.doc.revision-a.doc.revision);
 }
 async function snapshot(p,doc,reason){
  const id=String(now())+'-'+randomUUID()+'.json';
  await atomicJSON(join(p.history,id),{...doc,reason});
  const rows=await history(p);
  // 24 periodic checkpoints plus 20 explicit/reset/restore/migration checkpoints.
  let automatic=0,manual=0;
  for(const row of rows){
   const excess=row.doc.reason==='automatic'?++automatic>24:++manual>20;
   if(excess)await unlink(join(p.history,row.id));
  }
  return {id,...info({...doc,reason})};
 }
 async function readCurrentBase(p,theme){
  const present=await exists(p.current);
  if(present){
   try{
    const value=JSON.parse(await readFile(p.current,'utf8'));
    if(value?.schema>1)throw fail('存档来自更新版本，请升级游戏后读取',503,'save_version');
    return validateDocument(value,theme);
   }catch(error){
    if(error.code==='save_version')throw error;
    await writeFile(join(p.dir,'damaged-'+now()+'-'+randomUUID()+'.json'),await readFile(p.current),{mode:0o600});
   }
  }
  const candidates=[],previousExists=await exists(p.previous),rows=await history(p);
  try{candidates.push(validateDocument(JSON.parse(await readFile(p.previous,'utf8')),theme))}catch{}
  candidates.push(...rows.map(r=>r.doc));
  if(!candidates.length){
   if(!present&&!previousExists&&(await readdir(p.history)).length===0)return null;
   throw fail('主存档损坏且没有可用备份，已保留原文件，请检查备份文件',503,'save_corrupt');
  }
  const recovered={...candidates[0],version:randomUUID(),revision:candidates[0].revision+1,updatedAt:new Date(now()).toISOString(),reason:'recovery'};
  await atomicJSON(p.current,recovered);return recovered;
 }
 function journal(p,theme){return createLanEconomyJournal({paths:p,theme,now,validateDocument,fault:externalFault});}
 function wonderJournal(p,theme){return createLanWonderJournal({paths:p,theme,now,validateDocument});}
 async function readCurrent(p,theme){let doc;try{doc=await readCurrentBase(p,theme)}catch(e){if(!externalEconomy||e.code!=='save_corrupt')throw e;const recovered=await journal(p,theme).repair(null);if(!recovered)throw e;return wonderJournal(p,theme).repair(recovered);}return externalEconomy?wonderJournal(p,theme).repair(await journal(p,theme).repair(doc)):doc;}
 async function commit(p,theme,state,old,reason,clientId='',actions=old?.actions,metadata={}){
  if(actions&&actions.wonders?.version!==3&&old?.actions?.commerce)enableWonderState(state,actions,{source:old.state});
  if(externalEconomy)await wonderJournal(p,theme).merge(state,actions);
  syncWonderState(state,actions);syncPartyHosting(state,actions);syncPlanningState(state,actions);syncPersonalState(state,actions);syncResourceState(state,actions);validateState(state,theme);
  if(actions&&!validActionBook(actions))throw fail('作业记录未通过核对，已有主存档未覆盖',409,'action_book_invalid');
  const doc={schema:1,theme,revision:(old?.revision||0)+1,version:randomUUID(),parentVersion:old?.version||null,updatedAt:new Date(now()).toISOString(),reason,clientId,state,checksum:digest(state)};
  if(actions){doc.actions=actions;doc.actionsChecksum=digest(actions)}
  if(old?.restartId)doc.restartId=old.restartId;
  if(metadata.provenance||old?.provenance)doc.provenance=metadata.provenance||old.provenance;
  if(metadata.importReceipts||old?.importReceipts)doc.importReceipts=metadata.importReceipts||old.importReceipts;
  if(doc.provenance||doc.importReceipts)doc.metadataChecksum=digest([doc.provenance||null,doc.importReceipts||[]]);
  if(old)await atomicJSON(p.previous,old);
  await atomicJSON(p.current,doc);
  return doc;
 }
 function compare(old,expected){
  if(!old||old.version!==expected)throw fail('另一窗口已有更新进度；当前暂存已保留，请选择要继续的存档',409,'save_conflict');
 }
 async function applyRestart(p,theme,old,request){
  if(old?.restartId===request.id)return old;
  if(externalEconomy)await journal(p,theme).assertReplacement(null,old,{restart:true});
  await snapshot(p,old,'before-restart');
  const state=createZeroState(old.state);
  state.saveSlot=legacySaveKey(theme)+'-restart-'+request.id;
  const doc=await commit(p,theme,state,old,'restart','',request.protect?bootstrapSaveAuthority(state,theme,now()):newActionBook(),request.protect?{provenance:{version:1,origin:'server-new',at:new Date(now()).toISOString()}}:{});
  doc.restartId=request.id;await atomicJSON(p.current,doc);
  await atomicJSON(p.restart,{...request,applied:true});
  return doc;
 }
 const api={
  directory:root,
  async open(theme,{legacyState,clientId='',protect=false,identity={}}={}){
   return withLock(theme,async p=>{
    let doc=await readCurrent(p,theme),migrated=false,restarted=false;
    if(!doc){
     const state=legacyState?validateState(legacyState,theme):protect?serverZeroState(theme,identity):createZeroState();
     doc=await commit(p,theme,state,null,protect?'new':legacyState?'migration':'new',clientId,protect?bootstrapSaveAuthority(state,theme,now()):undefined,protect?{provenance:{version:1,origin:'server-new',at:new Date(now()).toISOString()}}:{});
     if(legacyState)await snapshot(p,doc,'migration');
     migrated=!!legacyState;
    }
    let request;try{request=JSON.parse(await readFile(p.restart,'utf8'))}catch{}
    if(request&&!request.applied){doc=await applyRestart(p,theme,doc,request);restarted=true}
    return {document:doc,migrated,restarted};
   });
  },

  async openClient(theme,{legacyState,clientId=''}={}){
   return withLock(theme,async p=>{
    let doc=await readCurrent(p,theme),created=false;
    if(!doc){
     if(hasLegacyProgress(legacyState))await imports.captureMigration(p,legacyState);
     const state=serverZeroState(theme,initialIdentity(legacyState));
     doc=await commit(p,theme,state,null,'new',String(clientId).slice(0,80),bootstrapSaveAuthority(state,theme,now()),{provenance:{version:1,origin:'server-new',at:new Date(now()).toISOString()}});created=true;
    }
    let request;try{request=JSON.parse(await readFile(p.restart,'utf8'));}catch{}
    let restarted=false;if(request&&!request.applied){doc=await applyRestart(p,theme,doc,{...request,protect:true});restarted=true;}
    if(doc.actions&&doc.actions.wonders?.version!==3){const state=structuredClone(doc.state),actions=structuredClone(doc.actions);enableWonderState(state,actions);doc=await commit(p,theme,state,doc,'wonder-migration',clientId,actions);}
    if(!doc.actions?.resources){
     await snapshot(p,doc,'before-resource-authority');
     const state=structuredClone(doc.state),actions=structuredClone(doc.actions||newActionBook());
     if(actions.wonders?.version!==3)enableWonderState(state,actions);
     // Early canonical saves have no action book. Protect existing stock without
     // bootstrapping other controllers or interrupting an ongoing legacy activity.
     if(!actions.personal)applyPersonalCommand(state,actions,{operation:'enable',requestId:randomUUID()},now());
     enableResourceState(state,actions);
     doc=await commit(p,theme,state,doc,'resource-migration',clientId,actions);
    }
    if(doc.state.economy?.budgetPolicyVersion!==105){await snapshot(p,doc,'before-economy-policy');const state=structuredClone(doc.state),actions=structuredClone(doc.actions||newActionBook());migrateEconomyPolicy(state,actions);doc=await commit(p,theme,state,doc,'economy-policy-migration',clientId,actions);}
    return {document:doc,migrated:false,restarted,initialCreated:created,migration:await imports.migration(p)};
   });
  },
  async export(theme){return withLock(theme,async p=>{const doc=await readCurrent(p,theme);if(!doc)throw fail('尚无服务端存档',404,'save_missing');return imports.export(doc);});},
  async migrationExport(theme){return withLock(theme,async p=>(await imports.migrationSource(p)).data);},
  async previewImport(theme,{data,migrationId,expectedVersion,clientId='',requestId}={}){
   return withLock(theme,async p=>{
    let old;try{old=await readCurrent(p,theme);}catch(e){if(e.code!=='save_corrupt'||expectedVersion!=='corrupt')throw e;}
    if(old)compare(old,expectedVersion);else if(expectedVersion&&expectedVersion!=='corrupt')throw fail('主存档版本已变化',409,'save_conflict');
    let source='file';if(migrationId){data=(await imports.migrationSource(p,migrationId)).data;source='legacy-browser';}
    if(Buffer.byteLength(JSON.stringify(data)||'')>MAX_IMPORT_BYTES)throw fail('备份文件超出8 MB限制',413,'import_too_large');
    data=structuredClone(data);const origin=await imports.classify(data),state=data?.schema?validateDocument(data,theme).state:validateState(data,theme);
    let allowed=true,blockReason=null;
    if(externalEconomy&&origin.signature!=='local'){allowed=false;blockReason='联机岛屿只接受本账户的本机签名备份；旧档和其他安装的存档保留供独立版使用';}
    if(allowed)try{if(externalEconomy){await journal(p,theme).assertReplacement(state,old);assertCrossTasks(state,old?.state);}assertHireReplacement(state,old);}catch(e){if(!e.status)throw e;allowed=false;blockReason=e.message;}
    return {preview:await imports.prepare(p,{data,expectedVersion,clientId,requestId,source,migrationId,origin,allowed,blockReason,current:old})};
   });
  },
  async importClient(theme,{previewId,expectedVersion,clientId='',data}={}){
   if(data!==undefined)throw fail('需要先预览这份存档，再确认导入',409,'import_preview_required');
   return withLock(theme,async p=>{
    let old;try{old=await readCurrent(p,theme);}catch(e){if(e.code!=='save_corrupt'||expectedVersion!=='corrupt')throw e;}
    const requestHash=importRequestHash(previewId,expectedVersion,clientId),prior=old?.importReceipts?.find(r=>r.id===previewId);
    if(prior){if(prior.requestHash!==requestHash)throw fail('同一导入编号不能更换内容或窗口',409,'import_id_conflict');if(prior.migrationId)await imports.migrationImported(p,prior.migrationId);try{const pending=await imports.candidate(p,previewId);if(!pending.completed)await imports.complete(p,pending);}catch(e){if(e.code!=='import_preview_missing')throw e;}return {document:old,replayed:true};}
    const candidate=await imports.candidate(p,previewId);
    if(candidate.requestHash!==requestHash)throw fail('预览属于另一份进度或窗口，请重新预览',409,'import_preview_conflict');
    if(candidate.completed)throw fail('这份预览已导入，不能再次覆盖更新进度',409,'import_already_applied');
    if(candidate.expiresAt<now())throw fail('预览已过期，请重新预览文件',409,'import_preview_expired');
    if(!candidate.allowed)throw fail(candidate.blockReason,409,'import_not_allowed');
    if(old)compare(old,expectedVersion);else if(expectedVersion&&expectedVersion!=='corrupt')throw fail('主存档版本已变化',409,'save_conflict');
    const origin=await imports.classify(candidate.data),source=structuredClone(candidate.data?.schema?validateDocument(candidate.data,theme).state:validateState(candidate.data,theme));
    if(externalEconomy){if(origin.signature!=='local')throw fail('本账户签名校验未通过',409,'import_not_allowed');await journal(p,theme).assertReplacement(source,old);assertCrossTasks(source,old?.state);}
    assertHireReplacement(source,old);clearActionHolds(source,{trustedRestore:origin.signature==='local'});
    if(!validSaveSlot(theme,source.saveSlot))source.saveSlot=legacySaveKey(theme)+'-restart-'+randomUUID();
    const actions=bootstrapSaveAuthority(source,theme,now());validateState(source,theme);
    if(old)await snapshot(p,old,'before-import');
    const provenance={version:1,origin:candidate.source==='legacy-browser'?'legacy-browser':origin.kind,fileSignature:origin.signature,sourceHash:candidate.sourceHash,importId:previewId,at:new Date(now()).toISOString()},receipt={id:previewId,requestHash,sourceHash:candidate.sourceHash,migrationId:candidate.migrationId,at:new Date(now()).toISOString()};
    const doc=await commit(p,theme,source,old,'import',String(clientId).slice(0,80),actions,{provenance,importReceipts:[...(old?.importReceipts||[]),receipt].slice(-20)});
    await importFault('committed',{theme,id:previewId});await imports.complete(p,candidate);if(candidate.migrationId)await imports.migrationImported(p,candidate.migrationId);
    return {document:doc,replayed:false};
   });
  },
  restartClient(theme,input){return api.restart(theme,{...input,protect:true});},
  restoreClient(theme,input){return api.restore(theme,{...input,protect:true});},
  async externalWonder(theme,input){if(!externalEconomy)throw fail('未启用跨岛服务',403,'lan_wallet_disabled');return withLock(theme,async p=>{const old=await readCurrent(p,theme);if(!old||old.state.saveSlot!==input.worldKey)return {skipped:true,code:'lan_wonder_world'};const state=structuredClone(old.state),actions=structuredClone(old.actions||newActionBook()),r=recordLanWonder(state,actions,input);if(r.replayed)return {document:old,...r};await wonderJournal(p,theme).remember(state,actions);await externalFault('wonder-journal-written',{state,input});const document=await commit(p,theme,state,old,'lan-wonder','',actions);await externalFault('wonder-written',{document,input});return {document,...r};});},
  async externalTransaction(theme,input){if(!externalEconomy)throw fail('未启用跨岛服务',403,'lan_wallet_disabled');return withLock(theme,async p=>journal(p,theme).transact(await readCurrent(p,theme),input));},
  async queueCrossTask(theme,{plan,worldKey,expectedVersion,requestId,clientId=''}){
   if(!externalEconomy)throw fail('跨岛合作只在联机岛屿开放',403,'cross_task_disabled');
   return withLock(theme,async p=>{
    const old=await readCurrent(p,theme);if(old?.state.saveSlot!==worldKey)throw fail('合作属于另一批岛屿进度',409,'cross_task_world');
    const existing=old.state.crossIslandTasks?.[plan.command.id];
    if(!existing)compare(old,expectedVersion);
    const state=structuredClone(old.state),changed=queueCrossTask(state,plan);
    const doc=changed?await commit(p,theme,state,old,'cross-island-task',clientId):old;
    return {document:doc,replayed:!changed,ticket:{requestId},receipt:{outcome:'queued',taskId:plan.command.id}};
   });
  },
  async current(theme){return withLock(theme,p=>readCurrent(p,theme))},
  async save(theme,{state,expectedVersion,clientId='',saveId=null,activeSeconds=0}){
   return withLock(theme,async p=>{
    const old=await readCurrent(p,theme);
    const fingerprint=digest([state,activeSeconds]),prior=saveId&&[...(old?.actions?.farm?.autosaves||[]),...(old?.actions?.visitor?.autosaves||[]),...(old?.actions?.commerce?.autosaves||[]),...(old?.actions?.facility?.autosaves||[])].find(r=>r.id===saveId);
    if(prior){if(prior.fingerprint!==fingerprint||prior.expectedVersion!==expectedVersion)throw fail('同一存档请求不能变更内容',409,'save_id_conflict');return {document:old,replayed:true};}
    if(saveId!==null&&!/^[a-zA-Z0-9-]{8,80}$/.test(saveId))throw fail('存档请求编号无效');
    compare(old,expectedVersion);if(externalEconomy){journal(p,theme).assertState(state,old);assertCrossTasks(state,old.state);}validateState(state,theme);assertResourceState(state,old.actions);assertResourceJournal(state,old.state,old.actions);assertWonderState(state,old.actions);assertPartyHostingState(state,old.actions);assertPlanningState(state,old.actions);assertPersonalState(state,old.actions);assertActionHold(state,old.actions);assertFarmState(state,old.actions);assertFieldState(state,old.actions);assertResidentState(state,old.actions);assertVisitorState(state,old.actions);assertCommerceState(state,old.actions);assertPartyState(state,old.actions);assertHireState(state,old.actions);assertFishingState(state,old.actions);assertFestivalState(state,old.actions);assertCoutureState(state,old.actions);assertFireworksState(state,old.actions);assertFacilityState(state,old.actions);
    state=structuredClone(state);const actions=old.actions?structuredClone(old.actions):undefined;
    const farmSeconds=actions?.farm?.activeSeconds||0;advanceFarmClock(state,actions,activeSeconds,now());advanceFieldClock(state,actions,(actions?.farm?.activeSeconds||0)-farmSeconds);advanceVisitorClock(state,actions,activeSeconds,now());advanceCommerceClock(state,actions,activeSeconds,now());advanceFacilityClock(state,actions,activeSeconds,now());
    if(actions?.farm&&saveId)actions.farm.autosaves=[...(actions.farm.autosaves||[]),{id:saveId,fingerprint,expectedVersion}].slice(-64);
    if(actions?.visitor&&saveId)actions.visitor.autosaves=[...(actions.visitor.autosaves||[]),{id:saveId,fingerprint,expectedVersion}].slice(-64);
    if(actions?.facility&&saveId)actions.facility.autosaves=[...(actions.facility.autosaves||[]),{id:saveId,fingerprint,expectedVersion}].slice(-64);
    if(actions?.commerce&&saveId)actions.commerce.autosaves=[...(actions.commerce.autosaves||[]),{id:saveId,fingerprint,expectedVersion}].slice(-64);
    // A run cannot silently change identity through autosave.
    if(old.state.saveSlot!==state.saveSlot)throw fail('存档批次不匹配',409,'save_conflict');
    const rows=await history(p),last=rows.find(r=>r.doc.reason==='automatic');
    if(!last||now()-Date.parse(last.doc.updatedAt)>=backupInterval)await snapshot(p,old,'automatic');
    const doc=await commit(p,theme,state,old,'autosave',String(clientId).slice(0,80),actions);
    // A reset receipt survives later autosaves, so replaying the same request is harmless.
    if(old.restartId){doc.restartId=old.restartId;await atomicJSON(p.current,doc)}
    return {document:doc};
   });
  },
  async action(theme,input={}){
   return withLock(theme,async p=>{
    const old=await readCurrent(p,theme);
    const replay=actionReplay(old,input);if(replay){if(input.kind==='commerce'&&input.operation==='hire_renew')await hireRegistry.renewal_commit(theme,old,input.renewalId);return replay;}
    compare(old,input.expectedVersion);
    const state=structuredClone(old.state),actions=structuredClone(old.actions||newActionBook());
    const verifiedContract=input.kind==='commerce'&&['hire_handover','hire_renew','hire_bind','hire_renew_prepare'].includes(input.operation)?await hireRegistry.peek(theme,input.contractId):null;
    const verifiedRenewal=input.kind==='commerce'&&input.operation==='hire_renew'?await hireRegistry.peek(theme,input.renewalId):null;
    const verifiedProposal=input.kind==='commerce'&&['fish_steward','night_steward','festival_steward','couture_steward','fireworks_steward'].includes(input.operation)?await partyProof.peek({theme,worldKey:state.saveSlot||'legacy-'+theme,runId:input.runId,proposalId:input.proposalId}):null;
    const result=applyGatherCommand(state,actions,{...input,theme,verifiedContract,verifiedRenewal,verifiedProposal},now());recordHostingAction(state,actions,input,result);recordHireDelivery(state,actions,result.receipt);recordCrossTaskReceipt(state,result.receipt);syncFacilityState(state,actions);
    const doc=await commit(p,theme,state,old,'action-'+input.operation,String(input.clientId||'').slice(0,80),actions);
    if(input.kind==='commerce'&&input.operation==='hire_renew')await hireRegistry.renewal_commit(theme,doc,input.renewalId);
    return {document:doc,...result,replayed:false};
   });
  },
  async backups(theme){return withLock(theme,async p=>(await history(p)).map(({id,doc})=>({id,...info(doc)})))},
  async backup(theme,{expectedVersion}={}){
   return withLock(theme,async p=>{const doc=await readCurrent(p,theme);compare(doc,expectedVersion);return snapshot(p,doc,'manual')});
  },
  async restore(theme,{id,expectedVersion,clientId='',protect=false}){
   if(!/^[a-z0-9-]+\.json$/.test(id||''))throw fail('无效的备份编号');
   return withLock(theme,async p=>{
    const old=await readCurrent(p,theme);compare(old,expectedVersion);
    const source=validateDocument(JSON.parse(await readFile(join(p.history,id),'utf8')),theme);
    if(externalEconomy){await journal(p,theme).assertReplacement(source.state,old);assertCrossTasks(source.state,old.state);}
    assertHireReplacement(source.state,old);
    await snapshot(p,old,'before-restore');
    clearActionHolds(source.state,{trustedRestore:true});
    if(protect&&!validSaveSlot(theme,source.state.saveSlot))source.state.saveSlot=legacySaveKey(theme)+'-restart-'+randomUUID();
    const doc=await commit(p,theme,source.state,old,'restore',clientId,protect?bootstrapSaveAuthority(source.state,theme,now()):newActionBook(),protect?{provenance:{version:1,origin:'local-checkpoint',sourceChecksum:source.checksum,at:new Date(now()).toISOString()}}:{});
    return {document:doc};
   });
  },
  async import(theme,{data,expectedVersion,clientId=''}){
   const source=structuredClone(data?.schema?validateDocument(data,theme).state:validateState(data,theme));
   clearActionHolds(source);
   return withLock(theme,async p=>{
    let old=null;
    try{old=await readCurrent(p,theme)}catch(error){if(error.code!=='save_corrupt'||expectedVersion!=='corrupt')throw error}
    if(old)compare(old,expectedVersion);
    else if(expectedVersion&&expectedVersion!=='corrupt')throw fail('主存档版本已变化',409,'save_conflict');
    if(externalEconomy){await journal(p,theme).assertReplacement(source,old);assertCrossTasks(source,old?.state);}
    assertHireReplacement(source,old);
    if(old)await snapshot(p,old,'before-import');
    const doc=await commit(p,theme,source,old,'import',clientId,newActionBook());
    return {document:doc};
   });
  },
  async restart(theme,{requestId,expectedVersion,defer=false,protect=false}={}){
   if(!/^[a-z0-9-]{8,80}$/.test(requestId||''))throw fail('无效的重开编号');
   return withLock(theme,async p=>{
    let request;try{request=JSON.parse(await readFile(p.restart,'utf8'))}catch{}
    const old=await readCurrent(p,theme);
    if(request?.id===requestId)return {pending:!request.applied,document:old};
    if(old)compare(old,expectedVersion);
    if(externalEconomy)await journal(p,theme).assertReplacement(null,old,{restart:true});
    request={id:requestId,requestedAt:new Date(now()).toISOString(),applied:false,protect};
    await atomicJSON(p.restart,request);
    if(!old||defer)return {pending:true,document:old};
    return {pending:false,document:await applyRestart(p,theme,old,request)};
   });
  }
 };
 return api;
}

// The complete-data verifier shares the exact game-save invariants.
export {validateDocument as validateSavedDocument};
