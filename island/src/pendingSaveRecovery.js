import {mergeActionState} from './actionMerge.js';

// Only an acknowledged document for this exact island and version can be the
// baseline. Older journals without one retain the explicit recovery flow.
export function recoverPendingProgress(pending,remote){
 const base=pending?.baseDocument?.document,local=pending?.state;
 if(!base?.state||!local||!remote?.state||!pending.baseVersion||base.version!==pending.baseVersion)return null;
 const slot=base.state.saveSlot;
 if(typeof slot!=='string'||!slot||local.saveSlot!==slot||remote.state.saveSlot!==slot)return null;
 return mergeActionState(base.state,local,remote.state);
}
