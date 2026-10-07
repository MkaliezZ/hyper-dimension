export async function readBrowserSaveJournal(page,key){return page.evaluate(async key=>{
 const legacy=localStorage.getItem(key);if(legacy)return JSON.parse(legacy);
 const namespace=localStorage.namespace||'hd-local:';
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('hyper-dimension-save-journal',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 if(!db.objectStoreNames.contains('entries')){db.close();return null;}
 const value=await new Promise((resolve,reject)=>{const r=db.transaction('entries','readonly').objectStore('entries').get(namespace+key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return value?JSON.parse(value):null;
},key);}
