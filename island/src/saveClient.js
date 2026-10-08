import {applySaveResponseActions} from './saveResponse.js';
import {yieldForSave} from "./saveScheduler.js";
import {mergeActionState,sameState} from './actionMerge.js';
import {activeSlotKey,activeSaveKey,validSaveSlot} from './saveStorage.js';
import {createSaveJournal} from './saveJournal.js';

export function createSaveClient({storageTheme=null,loadLocal,storeLocal,onStatus=()=>{},onRemoteState=()=>{}}){
 const sessions=new Map(),journal=createSaveJournal();
 const yieldFrame=yieldForSave;
 let clientId;
 try{clientId=sessionStorage.getItem('hd-save-client');if(!clientId){clientId=crypto.randomUUID();sessionStorage.setItem('hd-save-client',clientId)}}catch{clientId=crypto.randomUUID()}
 const autosaveKey=theme=>'hyper-dimension-'+theme+'-pending-clock-save';
 const commandKey=theme=>'hyper-dimension-'+theme+'-pending-action';
 const pendingKey=theme=>'hyper-dimension-'+theme+'-pending-server-save';
 const importKey=theme=>'hyper-dimension-'+theme+'-pending-import';
 const metaKey=theme=>'hyper-dimension-'+theme+'-server-meta';
 const record=theme=>{if(!sessions.has(theme))sessions.set(theme,{theme,state:null,version:null,dirty:false,inflight:null,timer:null,status:'loading',message:'正在读取服务端存档',updatedAt:'',generation:0});return sessions.get(theme)};
 async function reconcile(r,base,remote,path){
  r.reconciling=true;for(;;){
   const cached=await cache(r),generation=cached.generation,current=cached.state;
   // The durable snapshot is already isolated. Send its text instead of making
   // another synchronous clone of the live game state on every receipt.
   const result=await journal.reconcile(base,cached.serialized,remote.encoded||remote.state,path,current);
   if(generation===r.generation&&current===r.state)return {...result,generation};
  }
 }
 const read=key=>journal.get(key);
 const forget=key=>journal.remove(key);
 function status(r,name,message){if(r.status===name&&r.message===message)return;if(r.recovering&&name!=='recovering')return;r.status=name;r.message=message;onStatus(r.theme)}
 function cache(r){
  clearTimeout(r.cacheTimer);r.cacheTimer=null;
  const run=async()=>{
   // enqueue marks every progress change; reuse only a journal already committed for
   // this exact state, generation and server version. Receipts invalidate the memo.
   const memo=r.cachedSnapshot;if(memo&&memo.state===r.state&&memo.generation===r.generation&&memo.version===r.version&&memo.dirty===r.dirty)return memo;
   await yieldFrame();const snapshotState=r.state,savedAt=new Date().toISOString(),generation=r.generation,version=r.version,dirty=r.dirty;
   let serialized;r.capturing=true;
   try{serialized=await journal.encodeSnapshot(snapshotState,r.theme+':'+snapshotState.saveSlot,{isCurrent:()=>snapshotState===r.state&&generation===r.generation,onCaptured:()=>{r.capturing=false;}});}
   catch(error){if(error.code==='snapshot_retry')return run();throw error;}
   finally{r.capturing=false;}
   if(validSaveSlot(r.theme,r.state.saveSlot)&&localStorage.getItem(activeSlotKey(r.theme))!==r.state.saveSlot)localStorage.setItem(activeSlotKey(r.theme),r.state.saveSlot);
   const pending='{"baseVersion":'+JSON.stringify(version)+',"state":'+serialized+',"savedAt":'+JSON.stringify(savedAt)+',"clientId":'+JSON.stringify(clientId)+'}';
   if(journal.enabled())await journal.commit([[activeSaveKey(r.theme),serialized],['hyper-dimension-'+r.theme+'-journal-stamp',JSON.stringify({savedAt,version,clientId})],...(dirty?[[pendingKey(r.theme),pending]]:[])]);
   else{storeLocal(r.theme,JSON.parse(serialized),serialized);if(dirty)await journal.commit([[pendingKey(r.theme),pending]]);}
   r.cacheError=false;r.cachedSnapshot={state:snapshotState,serialized,generation,version,dirty};return r.cachedSnapshot;
  };
  const result=(r.cacheTail||Promise.resolve()).then(run,run);r.cacheTail=result.catch(()=>{r.cacheError=true;});return result;
 }
 async function request(theme,operation,body,encoded,metadataOnly=false){
  const actionsBase=metadataOnly?{version:record(theme).version,actions:record(theme).actions}:null;
  const payload=body===undefined?undefined:encoded??await journal.encode(body);
  const response=await journal.request('/api/saves/'+theme+(operation?'/'+operation:''),{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:payload},metadataOnly,actionsBase?.version);
  const data=response.data||JSON.parse(response.text);
  if(!response.ok)throw Object.assign(Error(data.error||'存档服务未连接'),{code:data.code,status:response.status});
  if(data.document){applySaveResponseActions(data.document,actionsBase);Object.defineProperty(data.document,'encoded',{value:response.text});}
  return data;
 }
 async function remember(r,doc){
  await yieldFrame();
  r.remoteEncoded=doc.encoded||null;r.version=doc.version;r.updatedAt=doc.updatedAt;r.actions=doc.actions||null;r.provenance=doc.provenance||null;r.remoteState=doc.encoded?null:structuredClone(doc.state);
  try{localStorage.setItem(metaKey(r.theme),JSON.stringify({version:r.version,updatedAt:r.updatedAt}))}catch{}
 }
 const hasCommand=theme=>{try{return journal.has(commandKey(theme))}catch{return false}};
 function schedule(r,delay=5000){
  if(r.recovering||r.previewPreparing||r.previewLock||read(importKey(r.theme))||r.timer||r.commandSending||hasCommand(r.theme)||r.status==='conflict'||r.status==='blocked')return;
  r.timer=setTimeout(()=>{r.timer=null;flush(r.theme).catch(()=>{})},delay);
 }
 async function load(theme){
  await journal.prepare(theme);
  const r=record(theme),pending=read(pendingKey(theme));
  let local=read(activeSaveKey(theme))||loadLocal(theme);
  // Legacy minigame records were separate browser keys; migrate them with the first save.
  if(!local.workshopBests){local.workshopBests={};try{
   for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i),m=key.match(/^hd-workshop-best-v19-(\d+)-(\d+)$/);if(m)local.workshopBests[m[1]+'-'+m[2]]=read(key)}
  }catch{}}
  try{
   const result=await request(theme,'open',{legacyState:pending?.state||local,clientId});let doc=result.document;
   r.migration=result.migration||null;
   if(read(importKey(theme))){r.state=doc.state;await remember(r,doc);const imported=await retryImport(theme,{reload:false});return imported.document.state;}
   if(result.initialCreated||result.restarted){
    await journal.set(pendingKey(theme)+'-previous',{state:pending?.state||local,pendingAction:read(commandKey(theme)),autosave:read(autosaveKey(theme)),savedAt:new Date().toISOString()});
    await forget(autosaveKey(theme));await forget(commandKey(theme));await forget(pendingKey(theme));await remember(r,doc);r.state=doc.state;r.dirty=false;await cache(r);status(r,'saved',r.migration?'新岛已创建 · 浏览器旧档等待确认':'进度已保存到本机服务');return r.state;
   }
   const auto=read(autosaveKey(theme));
   if(auto&&!result.restarted){
    const response=await request(theme,'save',auto.body);doc=response.document;
    const merged=mergeActionState(auto.body.state,pending?.state||auto.body.state,doc.state);
    await remember(r,doc);r.state=merged;r.dirty=!sameState(merged,doc.state);await forget(autosaveKey(theme));await forget(pendingKey(theme));await cache(r);
    status(r,r.dirty?'pending':'saved','上次有效游戏时间已核对');if(r.dirty)schedule(r);return r.state;
   }
   if(result.restarted)await forget(autosaveKey(theme));
   const recovery=read(commandKey(theme));
   if(recovery){
    if(result.restarted){await forget(commandKey(theme));await forget(pendingKey(theme));}
    else{
     const response=await request(theme,'action',recovery.body);doc=response.document;
     const merged=mergeActionState(recovery.baseState,pending?.state||recovery.baseState,doc.state);
     await remember(r,doc);r.state=merged;r.dirty=!sameState(merged,doc.state);r.recoveredAction=response;
     await forget(commandKey(theme));await forget(pendingKey(theme));await cache(r);
     status(r,r.dirty?'pending':'saved','上次作业结算已核对');if(r.dirty)schedule(r);
     return r.state;
    }
   }
   await remember(r,doc);r.state=doc.state;r.dirty=false;
   if(!result.restarted&&pending&&!sameState(pending.state,doc.state)){
    if(pending.baseVersion===doc.version||doc.parentVersion===pending.baseVersion&&doc.clientId===pending.clientId){
     r.state=pending.state;r.dirty=true;status(r,'pending','暂存进度等待写入服务端');schedule(r,100);
    }else{
     r.state=pending.state;r.version=pending.baseVersion;r.dirty=true;status(r,'conflict','存档冲突 · 点击选择进度');
    }
   }else{
    await forget(pendingKey(theme));
    status(r,'saved',doc.reason==='recovery'?'已从备份恢复 · 点击查看':'进度已保存到本机服务');
   }
   await cache(r);return r.state;
  }catch(error){
   if(read(importKey(theme))){r.state=r.state||pending?.state||local;r.dirty=false;status(r,'import_pending','导入结果待核对 · 点击重试');return r.state;}
   r.state=pending?.state||local;r.version=pending?.baseVersion||read(metaKey(theme))?.version||null;r.dirty=true;
   const blocked=['save_corrupt','save_version','lan_wallet_corrupt','lan_travel_active'].includes(error.code);
   if(['save_conflict','resource_state_conflict'].includes(error.code)){status(r,'conflict',error.code==='resource_state_conflict'?'物资记录与服务端不一致 · 点击核对进度':'存档冲突 · 点击选择进度');await cache(r);return r.state;}
   if(read(commandKey(theme))){status(r,error.code==='save_conflict'?'conflict':'action_pending','作业结算待核对 · 请重试');await cache(r);return r.state;}
   if(error.code==='lan_travel_active'){status(r,'blocked',error.message);await cache(r);return r.state;}
   status(r,blocked?'blocked':'offline',blocked?'服务端存档异常 · 游戏已暂停':'服务未连接 · 浏览器暂存');
   await cache(r);if(!blocked)schedule(r,15000);return r.state;
  }
 }
 function enqueue(theme,state){
  const r=record(theme);if(r.recovering||r.previewLock||r.previewPreparing||read(importKey(theme)))return;r.state=state;r.dirty=true;r.generation++;
  // Coalesce same-frame NPC changes; flush awaits a durable journal before sending.
  if(!r.cacheTimer)r.cacheTimer=setTimeout(()=>{r.cacheTimer=null;cache(r).catch(()=>{})},250);
  if(!r.commandSending&&!hasCommand(theme)&&!['conflict','blocked','offline','action_pending'].includes(r.status))status(r,'pending','进度待保存 · 自动写入中');
  schedule(r);
 }
 async function flush(theme){
  const r=record(theme);
  if(r.previewLock||r.previewPreparing||read(importKey(theme)))throw Object.assign(Error('存档导入尚待确认'),{code:'import_pending'});
  if(r.recovering)throw Object.assign(Error('正在核对进度，请稍候'),{code:'save_recovering'});
  if(r.commandSending||read(commandKey(theme)))throw Object.assign(Error('作业结算待核对，请先重试该次作业'),{code:'action_pending'});
  if(['conflict','blocked'].includes(r.status))throw Error(r.message);
  if(r.inflight){await r.inflight;if(r.dirty)return flush(theme);return}
  if(!r.dirty||!r.state)return;
  clearTimeout(r.timer);r.timer=null;
  r.inflight=(async()=>{
   try{
    const cached=await cache(r),generation=cached.generation;status(r,'saving','正在保存到本机服务');
    if(!r.version){
     const result=await request(theme,'open',{legacyState:r.state,clientId}),doc=result.document;
     if(result.restarted||result.initialCreated){r.state=doc.state;await remember(r,doc);r.dirty=false;await forget(pendingKey(theme));location.reload();return}
     if(!sameState(doc.state,r.state))throw Object.assign(Error('服务器已有另一份进度'),{code:'save_conflict'});
     await remember(r,doc);
    }
    await yieldFrame();const farm=cached.state.farmControl?.version===1||cached.state.visitorControl?.version===1||cached.state.commerceControl?.version===1||cached.state.facilityControl?.version===1;
    let auto=farm?read(autosaveKey(theme)):null,newAuto=false;
    if(farm&&!auto){auto={body:{expectedVersion:r.version,clientId,saveId:crypto.randomUUID(),activeSeconds:Math.min(15,r.activeSeconds||0)}};newAuto=true;r.activeSeconds=0;await journal.commit([[autosaveKey(theme),'{"body":{"state":'+cached.serialized+',"expectedVersion":'+JSON.stringify(r.version)+',"clientId":'+JSON.stringify(clientId)+',"saveId":'+JSON.stringify(auto.body.saveId)+',"activeSeconds":'+auto.body.activeSeconds+'}}']]);}
    const body=auto?.body||{expectedVersion:r.version,clientId};
    const encoded=auto&&!newAuto?undefined:'{"state":'+cached.serialized+',"expectedVersion":'+JSON.stringify(r.version)+',"clientId":'+JSON.stringify(clientId)+(auto?',"saveId":'+JSON.stringify(auto.body.saveId)+',"activeSeconds":'+auto.body.activeSeconds:'')+'}';
    const {document:doc}=await request(theme,'save',body,encoded,true);
    let merged;if(farm){merged=await reconcile(r,journal.serialized(autosaveKey(theme)),doc,'body.state');r.state=merged.state;onRemoteState(theme,r.state);await forget(autosaveKey(theme));}
    await remember(r,doc);r.dirty=farm?merged.dirty||r.generation!==merged.generation:r.generation!==generation;
    if(!r.dirty)await forget(pendingKey(theme));
    await cache(r);status(r,r.dirty?'pending':'saved',r.dirty?'新进度等待保存':'进度已保存到本机服务');
    if(r.dirty)schedule(r);
   }catch(error){
    r.activeSeconds=0;
    const name=['save_conflict','resource_state_conflict','planning_state_conflict','personal_state_conflict','farm_state_conflict','field_state_conflict','resident_state_conflict','visitor_state_conflict','commerce_state_conflict','party_state_conflict','night_state_conflict','hire_state_conflict','fishing_state_conflict','festival_state_conflict','couture_state_conflict','fireworks_state_conflict','facility_state_conflict','action_hold_conflict','lan_wallet_state','lan_wallet_cash'].includes(error.code)?'conflict':['save_corrupt','save_version','lan_travel_active'].includes(error.code)?'blocked':'offline';
    status(r,name,error.code==='lan_travel_active'?error.message:name==='conflict'?(error.code==='resource_state_conflict'?'物资记录与服务端不一致 · 点击核对进度':'存档冲突 · 点击选择进度'):name==='blocked'?'存档异常 · 游戏已暂停':'服务未连接 · 浏览器暂存');
    if(name==='offline')schedule(r,15000);
    throw error;
   }
  })();
  try{await r.inflight}finally{r.inflight=null;r.reconciling=false}
 }
 async function action(theme,input){
  const r=record(theme);if(r.recovering)throw Object.assign(Error('正在核对进度，请稍候'),{code:'save_recovering'});const run=()=>actionNow(theme,input),result=(r.actionTail||Promise.resolve()).then(run,run);r.actionTail=result.catch(()=>{});return result;
 }
 async function actionNow(theme,input){
  const r=record(theme);if(r.recovering)throw Object.assign(Error('正在核对进度，请稍候'),{code:'save_recovering'});if(r.commandSending)throw Object.assign(Error('作业结算进行中'),{code:'action_pending'});
  let envelope=read(commandKey(theme));
  if(envelope&&(envelope.body.requestId!==input.requestId||envelope.body.operation!==input.operation))throw Object.assign(Error('另一次作业结果待核对，请先重试'),{code:'action_pending'});
  if(!envelope){
   await flush(theme);
   const body={...input,expectedVersion:r.version,clientId};
   if(input.operation==='begin'){body.expectedSequence=r.actions?.sequence||0;body.epoch=r.actions?.epoch||null;}
   const {serialized}=await cache(r);envelope={body};
   // Persist the exact operation before sending it, so a lost response can be retried.
   try{await journal.commit([[commandKey(theme),'{"body":'+JSON.stringify(body)+',"baseState":'+serialized+'}']])}catch{throw Error('浏览器无法保存作业回执，请释放本地存储空间后重试');}
  }
  r.commandSending=true;clearTimeout(r.timer);r.timer=null;status(r,'saving','正在核对作业');
  try{
   const response=await request(theme,'action',envelope.body,undefined,true),doc=response.document;
   const result=await reconcile(r,journal.serialized(commandKey(theme)),doc,'baseState'),merged=result.state;
   r.state=merged;onRemoteState(theme,r.state);await remember(r,doc);r.dirty=result.dirty||r.generation!==result.generation;
   await forget(commandKey(theme));await forget(pendingKey(theme));await cache(r);
   status(r,r.dirty?'pending':'saved','作业已保存到本机服务');// Controllers may resume after another local change; never republish the earlier snapshot.
   return {...response,get state(){return r.state;}};
  }catch(error){
   const uncertain=!Number.isInteger(error.status)||!error.code||error.status>=500||[401,403,408,429].includes(error.status)||error.code==='save_unavailable'||error.code==='save_busy';
   if(!uncertain)await forget(commandKey(theme));
   status(r,error.code==='lan_travel_active'?'blocked':['save_conflict','resource_state_conflict'].includes(error.code)?'conflict':uncertain?'action_pending':'saved',uncertain?'作业结算待核对 · 请重试':error.message);
   await cache(r);throw error;
  }finally{r.commandSending=false;r.reconciling=false;if(r.dirty&&!read(commandKey(theme)))schedule(r);}
 }
 async function refresh(theme){
  const r=record(theme);if(r.commandSending||r.inflight||read(commandKey(theme))||read(autosaveKey(theme)))throw Object.assign(Error('作业结果待核对，请先完成该次操作'),{code:'action_pending'});
  const {document:doc}=await request(theme,'');if(!doc||doc.version===r.version)return;if(doc.state.saveSlot!==r.state?.saveSlot){location.reload();return;}
  try{
   if(r.dirty){const result=await reconcile(r,r.remoteEncoded||r.remoteState,doc,r.remoteEncoded?'document.state':undefined);r.state=result.state;onRemoteState(theme,r.state);await remember(r,doc);r.dirty=result.dirty||r.generation!==result.generation;await cache(r);status(r,r.dirty?'pending':'saved','跨岛结算已核对，本岛操作已保留');if(r.dirty)schedule(r);return;}
   r.reconciling=true;r.state=doc.state;r.activeSeconds=0;onRemoteState(theme,r.state);await remember(r,doc);await forget(autosaveKey(theme));await forget(pendingKey(theme));await cache(r);status(r,'saved','跨岛结算与本岛进度已同步');
  }catch(error){await cache(r);status(r,'conflict','跨岛结算与本岛同一项进度发生冲突 · 请核对进度');throw Object.assign(Error(r.message),{code:'save_conflict'});}
  finally{r.reconciling=false;}
 }
 async function backups(theme){return (await request(theme,'backups')).backups}
 async function backup(theme){await flush(theme);return request(theme,'backup',{expectedVersion:record(theme).version})}
 async function restore(theme,id){
  const r=record(theme);clearTimeout(r.timer);
  if(r.inflight)await r.inflight.catch(()=>{});
  const {document:doc}=await request(theme,'restore',{id,expectedVersion:r.version,clientId});
  r.state=doc.state;r.dirty=false;await remember(r,doc);await forget(pendingKey(theme));await forget(commandKey(theme));await forget(autosaveKey(theme));await cache(r);
  location.reload();
 }

 async function previewImport(theme,data,{migrationId}={}){
  const r=record(theme);cancelImportPreview(theme);clearTimeout(r.timer);r.timer=null;
  if(r.inflight)await r.inflight.catch(()=>{});
  if(r.actionTail)await r.actionTail.catch(()=>{});
  if(read(commandKey(theme))||read(autosaveKey(theme))||read(importKey(theme)))throw Object.assign(Error('上一次操作结果尚待核对，请先恢复进度'),{code:'action_pending'});
  if(r.dirty&&!['conflict','blocked'].includes(r.status))await flush(theme);
  let expectedVersion;try{expectedVersion=(await request(theme,'')).document?.version||null}catch(error){if(error.code!=='save_corrupt')throw error;expectedVersion='corrupt'}
  r.previewPreparing=true;clearTimeout(r.timer);r.timer=null;
  try{const result=await request(theme,'import-preview',{...(migrationId?{migrationId}:{data}),expectedVersion,clientId,requestId:crypto.randomUUID()});const preview=result.preview||result;r.previewLock=preview.allowed?preview.id:null;return preview;}
  finally{r.previewPreparing=false;if(!r.previewLock&&r.dirty)schedule(r);}
 }
 function cancelImportPreview(theme){const r=record(theme);r.previewLock=null;if(r.dirty)schedule(r);}
 async function adoptImport(r,doc){
  r.state=doc.state;r.activeSeconds=0;r.dirty=false;r.migration=null;await remember(r,doc);
  await forget(pendingKey(r.theme));await forget(commandKey(r.theme));await forget(autosaveKey(r.theme));await forget(importKey(r.theme));await cache(r);
 }
 async function retryImport(theme,{reload=true}={}){
  const r=record(theme);if(r.importing)return r.importing;const envelope=read(importKey(theme));if(!envelope)throw Error('没有待确认的导入操作');
  r.recovering=true;status(r,'recovering','正在核对存档导入…');clearTimeout(r.timer);r.timer=null;
  r.importing=(async()=>{
   try{const response=await request(theme,'import',envelope.body);await adoptImport(r,response.document);r.recovering=false;status(r,'saved','导入已确认，进度已保存');if(reload)location.reload();return response;}
   catch(error){r.recovering=false;const uncertain=!error.code||!Number.isInteger(error.status)||error.status>=500||[401,403,408,429].includes(error.status);
    if(!uncertain){await forget(importKey(theme));status(r,'conflict','导入未生效 · '+error.message);}else status(r,'import_pending','导入结果待核对 · 点击重试');
    throw error;
   }finally{r.recovering=false;r.previewLock=null;r.importing=null;}
  })();return r.importing;
 }
 async function importSave(theme,preview){
  const r=record(theme);if(!preview?.id||!preview.allowed)throw Error('请先预览并确认可以导入的文件');
  if(read(importKey(theme)))return retryImport(theme);
  await journal.set(importKey(theme),{body:{previewId:preview.id,expectedVersion:preview.expectedVersion,clientId:preview.clientId}});
  return retryImport(theme);
 }

 function acceptServer(theme){
  const r=record(theme);if(read(importKey(theme)))return retryImport(theme);if(r.recoveryPromise)return r.recoveryPromise;
  const previousStatus=r.status;r.recovering=true;clearTimeout(r.timer);r.timer=null;
  status(r,'recovering','正在核对作业与服务端进度…');
  r.recoveryPromise=(async()=>{
   // Drain old submissions; new and queued commands cannot race recovery.
   if(r.actionTail)await r.actionTail.catch(()=>{});
   if(r.inflight)await r.inflight.catch(()=>{});
   const pending=read(commandKey(theme)),auto=read(autosaveKey(theme));
   await journal.set(pendingKey(theme)+'-previous',{state:r.state,pendingAction:pending,autosave:auto,savedAt:new Date().toISOString()});
   async function replay(operation,body){
    try{await request(theme,operation,body);}
    catch(error){
     // Only a definite application rejection permits choosing the stored progress.
     // Unavailable service or expired identity is not a receipt.
     if(!error.code||!error.status||error.status>=500||[401,403,408,429].includes(error.status))throw error;
    }
   }
   if(auto)await replay('save',auto.body);
   if(pending)await replay('action',pending.body);
   const {document:doc}=await request(theme,'');
   if(!doc?.state||!doc.version)throw Error('尚未取得有效的服务端进度，暂存已保留');
   r.state=doc.state;r.activeSeconds=0;r.dirty=false;await remember(r,doc);await cache(r);
   await forget(pendingKey(theme));await forget(commandKey(theme));await forget(autosaveKey(theme));
   r.recovering=false;status(r,'saved','服务端进度已核对，即将继续');location.reload();
  })().catch(error=>{
   r.recovering=false;status(r,['conflict','blocked','offline','action_pending'].includes(previousStatus)?previousStatus:'action_pending','核对未完成 · '+(error.message||'请稍后重试'));throw error;
  }).finally(()=>{r.recovering=false;r.recoveryPromise=null;});
  return r.recoveryPromise;
 }

 function suspend(){for(const r of sessions.values())if(r.dirty&&!r.previewLock&&!r.previewPreparing&&!read(importKey(r.theme))){
  // pagehide can terminate a worker: retain a synchronous emergency journal only here.
  try{const serialized=JSON.stringify(r.state);if(!journal.enabled())storeLocal(r.theme,r.state,serialized);localStorage.setItem(journal.enabled()?'hyper-dimension-'+r.theme+'-emergency-save':pendingKey(r.theme),'{"baseVersion":'+JSON.stringify(r.version)+',"state":'+serialized+',"savedAt":'+JSON.stringify(new Date().toISOString())+',"clientId":'+JSON.stringify(clientId)+'}');}catch{}
  cache(r).catch(()=>{});flush(r.theme).catch(()=>{});
 }}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend()});
 window.addEventListener('pagehide',suspend);
 async function appearance(theme,next){
  const r=record(theme);await flush(theme);if(read(commandKey(theme))||read(autosaveKey(theme))||r.dirty)throw Error('请先核对当前作业与保存结果');
  r.appearanceRequest??={expectedVersion:r.version,appearance:next,requestId:crypto.randomUUID(),clientId};if(r.appearanceRequest.appearance!==next)throw Error('请先完成上次画风切换');
  try{const {document:doc}=await request(theme,'appearance',r.appearanceRequest);r.state=doc.state;r.dirty=false;await remember(r,doc);await cache(r);r.appearanceRequest=null;status(r,'saved','画风已切换 · 同一座小岛的进度');return r.state;}catch(e){if(e.status&&e.status<500)r.appearanceRequest=null;throw e;}
 }
 const api={appearance,load,enqueue,flush,action,refresh,async idle(theme){const r=record(theme);let tail;do{tail=r.actionTail;if(tail)await tail;if(r.inflight)await r.inflight;if(r.cacheTail)await r.cacheTail;}while(tail!==r.actionTail);if(read(commandKey(theme)))throw Object.assign(Error('作业结果待核对，请先完成恢复'),{code:'action_pending'});},advanceTime(theme,dt){const r=record(theme);if(r.state?.farmControl?.version!==1&&r.state?.visitorControl?.version!==1&&r.state?.commerceControl?.version!==1&&r.state?.facilityControl?.version!==1||document.hidden)return;if(r.previewLock||r.previewPreparing||['recovering','offline','blocked','conflict','action_pending','import_pending'].includes(r.status)){r.activeSeconds=0;return}if(Number.isFinite(dt)&&dt>0&&dt<=.05)r.activeSeconds=Math.min(15,(r.activeSeconds||0)+dt);},pendingAction:theme=>read(commandKey(theme)),backups,backup,restore,previewImport,importSave,retryImport,cancelImportPreview,acceptServer,
  status:theme=>record(theme),blocked:theme=>!!record(theme).previewLock||!!record(theme).previewPreparing||['recovering','conflict','blocked','action_pending','import_pending'].includes(record(theme).status)};
 return storageTheme?Object.fromEntries(Object.entries(api).map(([k,fn])=>[k,(ignored,...args)=>fn(storageTheme,...args)])):api;
}
