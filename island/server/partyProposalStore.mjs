import {mkdir,readFile,open,rename,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
const runOK=v=>typeof v==='string'&&/^hd-island-[a-f0-9]{32}$/.test(v),proposalOK=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v),tails=new Map();
function serial(key,fn){const previous=tails.get(key)||Promise.resolve(),next=previous.catch(()=>{}).then(fn);tails.set(key,next);next.finally(()=>{if(tails.get(key)===next)tails.delete(key);}).catch(()=>{});return next;}
export function createPartyProposalStore({directory}){
 const root=resolve(directory,'_party_proposals');
 return {
  async record({theme,worldKey,runId,parties}){
   if(!['pixel','origami'].includes(theme)||typeof worldKey!=='string'||!worldKey||worldKey.length>200||!runOK(runId)||!Array.isArray(parties)||parties.length<1||parties.length>5||parties.some(p=>!proposalOK(p?.id)||!['fishing','night','market','couture','fireworks'].includes(p.template??'fishing'))||new Set(parties.map(p=>p.id)).size!==parties.length)throw Error('Invalid party proposal proof');
   const file=join(root,runId+'.json');
   return serial(file,async()=>{
    await mkdir(root,{recursive:true});let old=null;
    try{old=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    if(old&&(old.version!==1||old.theme!==theme||old.worldKey!==worldKey||old.runId!==runId||!Array.isArray(old.parties)))throw Error('Party proof identity conflict');
    const combined=structuredClone(old?.parties||[]);let changed=!old;
    for(const p of parties){const prior=combined.find(x=>x.id===p.id);if(prior){if(JSON.stringify(prior)!==JSON.stringify(p))throw Error('Party proof identity conflict');}else{combined.push(structuredClone(p));changed=true;}}
    if(combined.length>128)throw Error('Party proposal session limit reached');if(!changed)return;
    const value={version:1,theme,worldKey,runId,parties:combined,at:old?.at||new Date().toISOString(),updatedAt:new Date().toISOString()},tmp=file+'.'+randomUUID()+'.tmp';let h;
    try{h=await open(tmp,'wx',0o600);await h.writeFile(JSON.stringify(value));await h.sync();await h.close();h=null;await rename(tmp,file);}finally{await h?.close().catch(()=>{});await unlink(tmp).catch(()=>{});}
   });
  },
  async peek({theme,worldKey,runId,proposalId}){
   if(!runOK(runId)||!proposalOK(proposalId))return null;
   try{const r=JSON.parse(await readFile(join(root,runId+'.json'),'utf8'));return r.version===1&&r.theme===theme&&r.worldKey===worldKey&&r.runId===runId&&Array.isArray(r.parties)?r.parties.find(p=>p.id===proposalId)||null:null;}catch(e){if(e.code==='ENOENT')return null;throw e;}
  }
 };
}
