import {encodedSnapshotChanges,applyImmutableSnapshotChanges} from './saveDelta.js';

// Worker-only response cache. Version and island identity must both match before
// an action-book delta is sent; a cache miss sends the original complete book.
export function createSaveResponseCache(limit=6){
 const books=new Map();
 function key(url,headers={}){
  const u=new URL(url,'http://localhost');
  const m=u.pathname.match(/^\/api\/saves\/(pixel|origami)(?:\/[^/]+)?$/);
  return m?u.origin+'/api/saves/'+m[1]+'|'+(headers['X-HD-Island']||headers['x-hd-island']||'local'):null;
 }
 return {
  prepare({url,headers,ok,status,text,metadataOnly=false,actionsVersion=null}){
   const data=JSON.parse(text),doc=data.document,k=key(url,headers);
   if(ok&&k&&doc&&typeof doc.version==='string'&&Object.hasOwn(doc,'actions')){
    const previous=books.get(k),next=doc.actions;
    books.delete(k);books.set(k,{version:doc.version,actions:next});
    while(books.size>limit)books.delete(books.keys().next().value);
    if(metadataOnly&&previous?.version===actionsVersion){
     const changes=encodedSnapshotChanges(previous.actions,next);
     delete doc.actions;doc.actionsDelta={baseVersion:actionsVersion,changes};
    }
   }
   if(metadataOnly&&doc)delete doc.state;
   return metadataOnly?{ok,status,text,data}:{ok,status,text};
  }
 };
}

// Capture the base before awaiting HTTP: another response must not change which
// action book these paths refer to. Receipt history remains immutable and shared.
export function applySaveResponseActions(doc,base){
 if(!doc?.actionsDelta)return doc;
 const delta=doc.actionsDelta;
 if(!base||delta.baseVersion!==base.version||!Array.isArray(delta.changes))
  throw Object.assign(Error('保存回执版本未匹配，暂存已保留'),{code:'save_cache_error'});
 const actions=applyImmutableSnapshotChanges(base.actions,delta.changes,true);
 delete doc.actionsDelta;doc.actions=actions;return doc;
}
