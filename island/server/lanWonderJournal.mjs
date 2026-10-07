import {readFile,open,rename,unlink,mkdir} from 'node:fs/promises';import {join} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {validWonderBook,restoreLanWonderProgress,lanWonderProgress} from './wonderAuthority.mjs';
const sha=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex'),clone=v=>structuredClone(v),fail=()=>Object.assign(Error('联机奇观凭据校验失败，原存档与凭据已保留'),{status:503,code:'lan_wonder_corrupt'});
async function atomic(file,v){const tmp=file+'.'+randomUUID()+'.tmp';let h;try{h=await open(tmp,'wx',0o600);await h.writeFile(JSON.stringify(v));await h.sync();await h.close();h=null;await rename(tmp,file);}finally{await h?.close().catch(()=>{});await unlink(tmp).catch(()=>{});}}
export function createLanWonderJournal({paths:p,theme,now=()=>Date.now(),validateDocument}){
 const dir=join(p.dir,'lan-wonders'),file=world=>join(dir,sha(String(world))+'.json');
 const valid=d=>d?.schema===1&&d.theme===theme&&typeof d.worldKey==='string'&&d.checksum===sha({...d,checksum:undefined})&&validWonderBook({version:3,snapshot:d.progress?.snapshot,cooperations:{},visits:d.progress?.visits,lanEvents:d.progress?.lanEvents,externalRequests:d.progress?.externalRequests})&&Object.keys(d.progress.snapshot.owned).every(id=>id==='archipelago_lighthouse');
 async function read(world){try{const d=JSON.parse(await readFile(file(world),'utf8'));if(!valid(d)||d.worldKey!==world)throw fail();return d;}catch(e){if(e.code==='ENOENT')return null;throw fail();}}
 async function merge(state,actions){const d=await read(state.saveSlot);if(!d)return false;if(JSON.stringify(lanWonderProgress(actions?.wonders))===JSON.stringify(d.progress))return false;if(!actions)throw fail();restoreLanWonderProgress(state,actions,d.progress);return true;}
 return{
  file,
  async remember(state,actions){const d={schema:1,theme,worldKey:state.saveSlot,progress:lanWonderProgress(actions.wonders)};d.checksum=sha(d);if(!valid(d))throw fail();await mkdir(dir,{recursive:true});await atomic(file(state.saveSlot),d);},
  merge,
  async repair(document){if(!document)return document;const d=clone(document);if(!await merge(d.state,d.actions))return document;d.version=randomUUID();d.parentVersion=document.version;d.revision=document.revision+1;d.updatedAt=new Date(now()).toISOString();d.reason='lan-wonder-recovery';d.checksum=sha(d.state);d.actionsChecksum=sha(d.actions);validateDocument(d,theme);await atomic(p.previous,document);await atomic(p.current,d);return d;}
 };
}
