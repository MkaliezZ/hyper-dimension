import {snapshotChangesAsync,applySnapshotChanges,applyImmutableSnapshotChanges} from './saveDelta.js';
import {yieldForSave} from "./saveScheduler.js";
// Large snapshots and their durable recovery journal stay off the animation thread.
// The legacy localStorage journal remains readable and is migrated only after commit.
import {activeSaveKey} from './saveStorage.js';
import {mergeActionState,sameState} from './actionMerge.js';
export function createSaveJournal(){
 const namespace=localStorage.namespace||'hd-local:',snapshots=new Map();
 let worker=null,sequence=0,enabled=false;const pending=new Map(),raw=new Map(),parsed=new Map(),ready=new Map();
 if(typeof Worker==='function'&&typeof indexedDB!=='undefined')try{
  worker=new Worker(new URL('./saveWorker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const call=pending.get(data.id);if(!call)return;pending.delete(data.id);clearTimeout(call.timer);if(data.error)call.reject(Object.assign(Error(data.error.message),{code:data.error.code,path:data.error.path}));else call.resolve(data.result);};
  worker.onerror=()=>{for(const call of pending.values()){clearTimeout(call.timer);call.reject(Error('浏览器暂存后台不可用，未提交新作业'));}pending.clear();};
 }catch{}
 async function rpc(operation,value){if(operation==="encode"||operation==="merge")await yieldForSave();return new Promise((resolve,reject)=>{
  const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('浏览器暂存写入超时，未提交新作业'));},operation==='request'?15000:12000);
  pending.set(id,{resolve,reject,timer});try{worker.postMessage({id,operation,value});}catch(e){pending.delete(id);clearTimeout(timer);reject(e);}
 });}
 async function prepare(theme){if(ready.has(theme))return ready.get(theme);const job=(async()=>{
  if(!worker)return;
  try{const stored=await rpc('entries',namespace+'hyper-dimension-'+theme+'-');for(const [key,value] of stored)raw.set(key.slice(namespace.length),value);enabled=true;}
  catch{worker.terminate();worker=null;return;}
  const keys=[activeSaveKey(theme),...['pending-server-save','pending-clock-save','pending-action','server-meta','pending-server-save-previous'].map(k=>'hyper-dimension-'+theme+'-'+k)],imports=[];
  for(const key of keys){let value;try{value=localStorage.getItem(key);}catch{}if(value!==null&&value!==undefined){raw.set(key,value);parsed.delete(key);imports.push([key,value]);}}
  const emergencyKey='hyper-dimension-'+theme+'-emergency-save';let emergency;try{emergency=JSON.parse(localStorage.getItem(emergencyKey)||'null');}catch{}
  const stamp=get('hyper-dimension-'+theme+'-journal-stamp');
  if(emergency?.state&&(!stamp?.savedAt||emergency.savedAt>stamp.savedAt)){const key=emergency.state.saveSlot||activeSaveKey(theme),snapshot=JSON.stringify(emergency.state),pendingKey='hyper-dimension-'+theme+'-pending-server-save';imports.push([key,snapshot],[pendingKey,JSON.stringify(emergency)]);raw.set(key,snapshot);raw.set(pendingKey,JSON.stringify(emergency));parsed.delete(key);parsed.delete(pendingKey);}
  if(imports.length){await rpc('commit',imports.map(([k,v])=>[namespace+k,v]));for(const [key] of imports)try{localStorage.removeItem(key)}catch{}}
  if(emergency)try{localStorage.removeItem(emergencyKey)}catch{}
 })();ready.set(theme,job);return job;}
 function get(key){if(!enabled){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  if(parsed.has(key))return parsed.get(key);const value=raw.get(key);let result=null;try{result=value?JSON.parse(value):null}catch{}parsed.set(key,result);return result;}
 async function commit(changes){if(enabled)await rpc('commit',changes.map(([k,v])=>[namespace+k,v]));else for(const [key,value] of changes){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}
  for(const [key,value] of changes){if(value===null){raw.delete(key);parsed.delete(key);}else{raw.set(key,value);parsed.delete(key);}}}
 async function set(key,value,serialized){const text=serialized??await encode(value);await commit([[key,text]]);parsed.set(key,value);}
 async function remove(key){await commit([[key,null]]);}
 async function request(url,init,metadataOnly=false,actionsVersion=null){const island=namespace.match(/^hd-lan:([a-f0-9-]{36}):$/)?.[1];if(enabled)return rpc('request',{metadataOnly,actionsVersion,url:new URL(url,location.href).href,init:{...init,headers:{...init.headers,...(island?{'X-HD-Island':island}:{})}}});const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(url,{...init,signal:controller.signal,cache:'no-store'});return {ok:response.ok,status:response.status,text:await response.text()};}finally{clearTimeout(timer)}}
 function has(key){return enabled?raw.has(key):!!localStorage.getItem(key);}
 async function encode(value){return enabled?rpc('encode',value):JSON.stringify(value);}
 async function encodeSnapshot(value,channel,{isCurrent=()=>true,onCaptured=()=>{}}={}){
  if(!enabled)return encode(value);
  await yieldForSave();
  const previous=snapshots.get(channel);
  const input=previous?{channel,changes:await snapshotChangesAsync(previous,value,isCurrent)}:{channel,reset:true,value};
  try{
   if(!isCurrent())throw Object.assign(Error('Save snapshot changed during capture'),{code:'snapshot_retry'});
   const pending=rpc('snapshot',input);onCaptured();const result=await pending;
   if(result.reset){await yieldForSave();snapshots.set(channel,JSON.parse(result.serialized));}
   else snapshots.set(channel,applySnapshotChanges(previous,result.changes,true));
   while(snapshots.size>6)snapshots.delete(snapshots.keys().next().value);
   return result.serialized;
  }catch(error){snapshots.delete(channel);throw error;}
 }
 function serialized(key){return enabled?raw.get(key):localStorage.getItem(key);}
 async function reconcile(base,local,remote,path,current){
  if(enabled){const result=await rpc('merge',{base,local,remote,path,delta:!!current});return {state:current?applyImmutableSnapshotChanges(current,result.changes,true):JSON.parse(result.serialized),dirty:result.dirty};}
  if(typeof base==='string')base=JSON.parse(base);for(const key of path?.split('.')||[])base=base[key];
  if(typeof remote==='string')remote=JSON.parse(remote).document.state;if(typeof local==='string')local=JSON.parse(local);const state=mergeActionState(base,local,remote);return {state,dirty:!sameState(state,remote)};
 }
 return {prepare,get,set,remove,has,commit,encode,encodeSnapshot,serialized,reconcile,request,enabled:()=>enabled,dispose(){worker?.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Save journal closed'));}pending.clear();}};
}
