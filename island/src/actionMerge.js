// Compare structure directly; repeated full JSON encoding can stall a large save.
export function sameState(a,b){
 if(a===b)return true;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);if(keys.length!==Object.keys(b).length)return false;
 for(const key of keys)if(!Object.hasOwn(b,key)||!sameState(a[key],b[key]))return false;
 return true;
}
// Preserve independent changes. The caller retains a separate remote baseline.
export function mergeActionState(base,local,remote,path='state'){
 if(sameState(local,base))return remote;
 if(sameState(remote,base)||sameState(local,remote))return local;
 if(base!==null&&local!==null&&remote!==null&&typeof base==='object'&&typeof local==='object'&&typeof remote==='object'&&!Array.isArray(base)&&!Array.isArray(local)&&!Array.isArray(remote)){
  const result={};
  for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
   if(['__proto__','constructor','prototype'].includes(key))throw Error('Invalid state key');
   const value=mergeActionState(base[key],local[key],remote[key],path+'.'+key);
   if(value!==undefined)result[key]=value;
  }
  return result;
 }
 throw Object.assign(Error('作业结算期间同一项进度发生变化，已保留暂存，请读取服务端进度'),{code:'save_conflict',path});
}
