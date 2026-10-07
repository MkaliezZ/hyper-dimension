import {createSaveResponseCache} from './saveResponse.js';
const responseCache=createSaveResponseCache();
import {createSnapshotEncoder,encodedSnapshotChanges} from './saveDelta.js';
const snapshotEncoder=createSnapshotEncoder();
import {mergeActionState,sameState} from './actionMerge.js';
const database = new Promise((resolve,reject)=>{
 const request=indexedDB.open('hyper-dimension-save-journal',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('entries');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
async function request(value){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(value.url,{...value.init,signal:controller.signal,cache:'no-store',credentials:'same-origin'});const text=await response.text();return responseCache.prepare({url:value.url,headers:value.init?.headers,ok:response.ok,status:response.status,text,metadataOnly:value.metadataOnly,actionsVersion:value.actionsVersion});}finally{clearTimeout(timer)}}
async function entries(prefix){const db=await database;return new Promise((resolve,reject)=>{
 const tx=db.transaction('entries','readonly'),out=[];
 const request=tx.objectStore('entries').openCursor();
 request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(String(cursor.key).startsWith(prefix))out.push([cursor.key,cursor.value]);cursor.continue();};
 tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
async function commit(changes){const db=await database;return new Promise((resolve,reject)=>{
 const tx=db.transaction('entries','readwrite',{durability:'strict'}),store=tx.objectStore('entries');
 for(const [key,value] of changes){if(value===null)store.delete(key);else store.put(value,key);}
 tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Save journal transaction aborted'));
});}
function reconcile(value){let base=typeof value.base==='string'?JSON.parse(value.base):value.base;for(const key of value.path?.split('.')||[])base=base[key];const remote=typeof value.remote==='string'?JSON.parse(value.remote).document.state:value.remote;const local=typeof value.local==='string'?JSON.parse(value.local):value.local;const state=mergeActionState(base,local,remote);return value.delta?{changes:encodedSnapshotChanges(local,state),dirty:!sameState(state,remote)}:{serialized:JSON.stringify(state),dirty:!sameState(state,remote)};}
self.onmessage=async({data:{id,operation,value}})=>{
 try{const result=operation==='snapshot'?snapshotEncoder.encode(value):operation==='request'?await request(value):operation==='merge'?reconcile(value):operation==='encode'?JSON.stringify(value):operation==='entries'?await entries(value):operation==='commit'?await commit(value):await database.then(()=>true);self.postMessage({id,result});}
 catch(error){self.postMessage({id,error:{message:error.message||String(error),code:operation==='request'?'save_unavailable':error.code||'save_cache_error',path:error.path}});}
};
