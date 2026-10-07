import {yieldForSave} from './saveScheduler.js';
// The worker retains a complete JSON snapshot. Only changed JSON values cross
// the animation thread after the first snapshot; the durable journal stays whole.
const unsafe = key => key === '__proto__' || key === 'constructor' || key === 'prototype';
const omitted = value => value === undefined || typeof value === 'function' || typeof value === 'symbol';
const normalized = value => typeof value === 'number' && !Number.isFinite(value) ? null : value;
const enumerable=(value,key)=>Object.prototype.propertyIsEnumerable.call(value,key);
const indexKey=key=>String(key>>>0)===key&&key!=='4294967295';
const plain = value => value !== null && typeof value === 'object' &&
 (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function changeWalker(previous,next) {
 const changes=[],path=[],ancestors=new Set(),frames=[];
 let depth=-1;
 const set=value=>changes.push({operation:'set',path:[...path],value});
 function visit(a,raw) {
  const b=normalized(raw);if(a===b)return false;
  if(!plain(a)||!plain(b)||Array.isArray(a)!==Array.isArray(b)){set(b);return false;}
  if(ancestors.has(b))throw TypeError('Cannot serialize a circular save');
  const array=Array.isArray(b),level=depth+1;
  const frame=frames[level]||(frames[level]={keyBuffer:[],oldKeyBuffer:[]});
  let keys=null;
  if(!array){
   keys=frame.keyBuffer;keys.length=0;
   for(const key in b)if(Object.hasOwn(b,key))keys.push(key);
  }
  // Retain JSON property order as well as values; receipt fingerprints use JSON.
  if(!array){
   const oldKeys=frame.oldKeyBuffer;oldKeys.length=0;for(const key in a)if(Object.hasOwn(a,key))oldKeys.push(key);let cursor=0,added=false,reordered=false;
   for(const key of keys){
    if(indexKey(key)||omitted(b[key]))continue;
    if(!Object.hasOwn(a,key)){added=true;continue;}
    while(cursor<oldKeys.length&&(indexKey(oldKeys[cursor])||!enumerable(b,oldKeys[cursor])||omitted(b[oldKeys[cursor]])))cursor++;
    if(added||oldKeys[cursor++]!==key){reordered=true;break;}
   }
   if(reordered){set(b);return false;}
  }
  ancestors.add(b);
  depth=level;
  frame.a=a;frame.b=b;frame.array=array;frame.index=0;frame.pathLength=path.length;
  frame.keys=keys;
  if(array) {
   if(a.length!==b.length)changes.push({operation:'length',path:[...path],value:b.length});
  }else for(const key in a)if(Object.hasOwn(a,key)&&(!enumerable(b,key)||omitted(b[key]))){
   if(unsafe(key))throw TypeError('Invalid save key');
   changes.push({operation:'delete',path:[...path,key]});
  }
  return true;
 }
 visit(previous,next);
 return {changes,step(budgetMs=Infinity){
  const start=performance.now();let count=0;
  while(depth>=0){
   const frame=frames[depth],length=frame.array?frame.b.length:frame.keys.length;
   if(frame.index>=length){
    ancestors.delete(frame.b);path.length=Math.max(0,frame.pathLength-1);depth--;continue;
   }
   const key=frame.array?frame.index++:frame.keys[frame.index++],raw=frame.b[key];
   if(!frame.array&&omitted(raw))continue;
   if(unsafe(key))throw TypeError('Invalid save key');
   path.push(key);
   if(!visit(frame.a[key],frame.array&&omitted(raw)?null:raw))path.pop();
   if(++count%64===0&&performance.now()-start>=budgetMs)return false;
  }
  return true;
 }};
}
export function snapshotChanges(previous,next) {
 const walker=changeWalker(previous,next);walker.step();return walker.changes;
}
export async function snapshotChangesAsync(previous,next,isCurrent=()=>true) {
 const walker=changeWalker(previous,next);
 while(!walker.step(1.5)){
  await yieldForSave();
  if(!isCurrent())throw Object.assign(Error('Save snapshot changed during capture'),{code:'snapshot_retry'});
 }
 if(!isCurrent())throw Object.assign(Error('Save snapshot changed during capture'),{code:'snapshot_retry'});
 return walker.changes;
}

export function applySnapshotChanges(snapshot, changes, encoded=false) {
 let root=snapshot;
 for (const change of changes) {
  const {operation,path}=change;
  if (!Array.isArray(path) || path.some(unsafe)) throw TypeError('Invalid save path');
  const value=encoded && operation==='set' ? JSON.parse(change.encoded) : change.value;
  if (!path.length) {
   if (operation==='set') root=value;
   else if (operation==='length' && Array.isArray(root)) root.length=value;
   else throw TypeError('Invalid root save change');
   continue;
  }
  let parent=root;for (const key of path.slice(0,-1)) parent=parent[key];
  const key=path.at(-1);
  if (operation==='set') Object.defineProperty(parent,key,{value,writable:true,enumerable:true,configurable:true});
  else if (operation==='delete') delete parent[key];
  else if (operation==='length' && Array.isArray(parent[key])) parent[key].length=value;
  else throw TypeError('Invalid save change');
 }
 return root;
}

export function applyImmutableSnapshotChanges(snapshot,changes,encoded=false) {
 const owned=new WeakSet();
 const copy=value=>{if(owned.has(value))return value;const out=Array.isArray(value)?value.slice():{...value};owned.add(out);return out;};
 let root=snapshot;
 for(const change of changes){
  const {operation,path}=change;
  if(!Array.isArray(path)||path.some(unsafe))throw TypeError('Invalid save path');
  const value=encoded&&operation==='set'?JSON.parse(change.encoded):change.value;
  if(!path.length){
   if(operation==='set')root=value;
   else if(operation==='length'&&Array.isArray(root)){root=copy(root);root.length=value;}
   else throw TypeError('Invalid root save change');
   continue;
  }
  root=copy(root);let parent=root;
  for(const key of path.slice(0,-1)){const child=copy(parent[key]);Object.defineProperty(parent,key,{value:child,writable:true,enumerable:true,configurable:true});parent=child;}
  const key=path.at(-1);
  if(operation==='set')Object.defineProperty(parent,key,{value,writable:true,enumerable:true,configurable:true});
  else if(operation==='delete')delete parent[key];
  else if(operation==='length'&&Array.isArray(parent[key])){parent[key]=copy(parent[key]);parent[key].length=value;}
  else throw TypeError('Invalid save change');
 }
 return root;
}

export function encodedSnapshotChanges(previous,next) {
 return snapshotChanges(previous,next).map(c=>c.operation==='set'?{operation:c.operation,path:c.path,encoded:JSON.stringify(c.value)}:c);
}

export function createSnapshotEncoder() {
 const snapshots=new Map();
 return {
  encode({channel,reset,value,changes}) {
   try {
    if (reset) snapshots.set(channel,value);
    else {
     if (!snapshots.has(channel)) throw Error('Save snapshot baseline is missing');
     snapshots.set(channel,applySnapshotChanges(snapshots.get(channel),changes));
    }
    const serialized=JSON.stringify(snapshots.get(channel));
    if (typeof serialized!=='string') throw TypeError('Invalid save snapshot');
    // Main-thread mirrors use these isolated JSON values, never live references.
    const reply=reset ? {serialized,reset:true} : {serialized,changes:changes.map(c=>c.operation==='set' ? {operation:c.operation,path:c.path,encoded:JSON.stringify(c.value)} : c)};
    while(snapshots.size>6) snapshots.delete(snapshots.keys().next().value);
    return reply;
   } catch(error) {snapshots.delete(channel);throw error;}
  }
 };
}
