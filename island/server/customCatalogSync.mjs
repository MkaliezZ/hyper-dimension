import {validCustomCatalog} from '../src/customContent.js';
// Only the current approved registry contributes craftable recipes. Previously
// known item metadata remains available for owned goods and placement receipts.
export function customCatalogSnapshot(previous,next,worldKey){
 if(!validCustomCatalog(previous,worldKey)||!validCustomCatalog(next,worldKey))throw Object.assign(Error('共创发布目录校验失败，原进度已保留'),{status:503,code:'cocreation_catalog_invalid'});
 const items=new Map((previous?.items||[]).map(i=>[i.id,i]));
 for(const item of next?.items||[])items.set(item.id,item);
 if(!items.size)return null;
 const value={schema:1,worldKey,items:[...items.values()].sort((a,b)=>a.id.localeCompare(b.id)),recipes:next?.recipes||[]};
 if(!validCustomCatalog(value,worldKey))throw Object.assign(Error('已保留的共创物品目录已满，请保留旧作品或使用原发布版本'),{status:409,code:'cocreation_catalog_limit'});
 return structuredClone(value);
}
