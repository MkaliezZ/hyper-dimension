// Shared deterministic inventory rules. A reservation owns stock, not a copy.
const validKey=k=>typeof k==='string'&&/^[\w:.-]{1,160}$/.test(k)&&!['__proto__','constructor','prototype'].includes(k);
const entries=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.entries(v).every(([k,n])=>validKey(k)&&Number.isSafeInteger(n)&&n>=0);
const sorted=v=>Object.fromEntries(Object.entries(v).filter(([,n])=>n>0).sort(([a],[b])=>a.localeCompare(b)));
export function validResourceLedger(s){
 const ledger=s.resourceLedger;if(ledger===undefined)return true;
 if(!ledger||ledger.version!==1||!Number.isSafeInteger(ledger.sequence)||ledger.sequence<0||!ledger.reservations||typeof ledger.reservations!=='object'||Array.isArray(ledger.reservations)||!ledger.receipts||typeof ledger.receipts!=='object'||Array.isArray(ledger.receipts)||!Array.isArray(ledger.events))return false;
 const reserved={};for(const [owner,row] of Object.entries(ledger.reservations)){if(!validKey(owner)||!entries(row?.items))return false;for(const [id,n] of Object.entries(row.items))reserved[id]=(reserved[id]||0)+n;}
 return Object.entries(reserved).every(([id,n])=>Number.isSafeInteger(n)&&n<=resourceTotal(s,id));
}
export function hydrateResources(s){s.resourceLedger??={version:1,sequence:0,reservations:{},receipts:{},events:[]};return s.resourceLedger}
export function resourceTotal(s,item){return item==='coins'?(s.coins||0):(s.inventory?.[item]||0)}
export function reservedQuantity(s,item,exceptOwner=null){return Object.entries(s.resourceLedger?.reservations||{}).reduce((n,[owner,row])=>n+(owner===exceptOwner?0:row.items[item]||0),0)}
export function availableQuantity(s,item,owner=null){return Math.max(0,resourceTotal(s,item)-reservedQuantity(s,item,owner))}
export function canSpendResources(s,cost,owner=null){return entries(cost)&&Object.entries(cost).every(([item,n])=>availableQuantity(s,item,owner)>=n)}
export function nextOperationId(s,prefix='action'){return prefix+':'+(++hydrateResources(s).sequence)}
// Presentation identifiers never advance the server's inventory transaction sequence.
export function nextPresentationOperationId(s,prefix='action'){
 if(!s.resourceControl?.enabled)return nextOperationId(s,prefix);
 if(!validKey(prefix))throw Error('Invalid presentation prefix');
 const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
 return prefix+':ui-'+Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
}
export function validPresentationOperationId(id,prefix){
 return typeof id==='string'&&id.startsWith(prefix+':')&&/^(?:[1-9]\d*|ui-[a-f0-9]{32})$/.test(id.slice(prefix.length+1));
}
export function reserveResources(s,owner,items,{partial=false,purpose=''}={}){
 if(!validKey(owner)||!entries(items))return {ok:false,reason:'invalid_reservation'};
 const desired=sorted(items),missing=Object.fromEntries(Object.entries(desired).map(([id,n])=>[id,Math.max(0,n-availableQuantity(s,id,owner))]).filter(([,n])=>n));
 if(Object.keys(missing).length&&!partial)return {ok:false,reason:'insufficient_resources',missing};
 const held=Object.fromEntries(Object.entries(desired).map(([id,n])=>[id,Math.min(n,availableQuantity(s,id,owner))]).filter(([,n])=>n));
 const ledger=hydrateResources(s);
 if(Object.keys(held).length)ledger.reservations[owner]={items:held,purpose:String(purpose).slice(0,120),day:s.day};else delete ledger.reservations[owner];
 return {ok:true,complete:!Object.keys(missing).length,held,missing};
}
export function releaseResources(s,owner){const ledger=hydrateResources(s),held=ledger.reservations[owner];delete ledger.reservations[owner];return held?.items||{}}
export function commitResources(s,{id=null,owner=null,cost={},gain={},category='inventory',note=''}={}){
 if(!entries(cost)||!entries(gain)||id!==null&&!validKey(id))return {ok:false,reason:'invalid_command'};
 cost=sorted(cost);gain=sorted(gain);
 const ledger=hydrateResources(s),signature=JSON.stringify([owner,cost,gain,category]);
 if(id&&Object.hasOwn(ledger.receipts,id))return ledger.receipts[id].signature===signature?{ok:true,replayed:true,receipt:ledger.receipts[id]}:{ok:false,reason:'command_conflict'};
 const required={...cost,coins:Math.max(0,(cost.coins||0)-(gain.coins||0))};
 if(!canSpendResources(s,required,owner))return {ok:false,reason:'insufficient_resources'};
 const keys=[...new Set([...Object.keys(cost),...Object.keys(gain)])];
 if(keys.some(k=>!Number.isSafeInteger(resourceTotal(s,k)-(cost[k]||0)+(gain[k]||0))))return {ok:false,reason:'invalid_quantity'};
 const delta={};
 for(const key of keys){
  const used=cost[key]||0,added=gain[key]||0;delta[key]=added-used;
  if(key==='coins')s.coins=(s.coins||0)+delta[key];else{
   s.inventory[key]=(s.inventory[key]||0)+delta[key];
   if(used&&s.economy?.playerGoods)s.economy.playerGoods[key]=Math.max(0,(s.economy.playerGoods[key]||0)-used);
   if(added){s.discovered??={};s.discovered[key]=true;}
  }
  const held=owner&&ledger.reservations[owner];
  if(held&&used){held.items[key]=Math.max(0,(held.items[key]||0)-used);if(!held.items[key])delete held.items[key];}
 }
 if(owner&&ledger.reservations[owner]&&!Object.keys(ledger.reservations[owner].items).length)delete ledger.reservations[owner];
 const receipt={signature,day:s.day,category,delta};if(id)ledger.receipts[id]=receipt;
 ledger.events.push({id:id||nextOperationId(s),day:s.day,owner,category,note:String(note).slice(0,100),delta});ledger.events=ledger.events.slice(-160);
 return {ok:true,replayed:false,receipt};
}
