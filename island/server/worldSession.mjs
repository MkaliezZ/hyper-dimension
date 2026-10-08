import {readFile,mkdir,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {atomicJSON} from './atomicJson.mjs';
import {alive} from './dataLease.mjs';
const themes=['pixel','origami'];
const fail=(message,code='world_session_invalid')=>Object.assign(Error(message),{code,status:409});
export function createWorldSession({directory,saves}){
 const file=resolve(directory,'world-session.json'),lock=file+'.lock';
 async function read(){try{const d=JSON.parse(await readFile(file,'utf8'));if(d.version!==1||!themes.includes(d.storageTheme))throw fail('小岛身份记录需要核对，原数据已保留');return d;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async function resolveTheme(preferred){const d=await read();return d?.storageTheme||preferred;}
 return {resolveTheme,async open(preferred='pixel'){
  if(!themes.includes(preferred))throw fail('画风选择无效');let d=await read();if(d)return d;
  await mkdir(directory,{recursive:true});let owned=false;
  for(let attempt=0;attempt<100&&!owned;attempt++)try{const h=await open(lock,'wx',0o600);await h.writeFile(JSON.stringify({pid:process.pid}));await h.close();owned=true;}catch(e){if(e.code!=='EEXIST')throw e;try{const holder=JSON.parse(await readFile(lock,'utf8'));if(!alive(holder.pid))await unlink(lock);}catch{}await new Promise(r=>setTimeout(r,30));}
  if(!owned)throw fail('正在核对小岛身份，请稍后重试','world_session_busy');
  try{d=await read();if(d)return d;const other=preferred==='pixel'?'origami':'pixel',selected=await saves.current(preferred),alternate=await saves.current(other);d={version:1,storageTheme:selected?preferred:alternate?other:preferred,createdAt:new Date().toISOString(),legacyAlternatePreserved:!!selected&&!!alternate};await atomicJSON(file,d);return d;}finally{await unlink(lock).catch(()=>{});}
 }};
}
export function bindWorldStore(store,session){return Object.fromEntries(Object.entries(store).map(([key,value])=>[key,typeof value==='function'?async(theme,...args)=>value(await session.resolveTheme(theme),...args):value]));}
