import {open,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const RETRY_DELAYS=[20,40,80,120,180,240];
const TRANSIENT_WINDOWS_ERRORS=new Set(['EPERM','EACCES','EBUSY']);
// Keep the original destination and the already-synced temporary file intact between attempts.
// Never delete the destination to work around an occupied file or persistent permission failure.
export async function replaceAtomicFile(temporary,destination,{platform=process.platform,replace=rename,wait=delay}={}){
 for(let attempt=0;;attempt++){
  try{return await replace(temporary,destination)}catch(error){
   if(platform!=='win32'||!TRANSIENT_WINDOWS_ERRORS.has(error.code)||attempt>=RETRY_DELAYS.length)throw error;
   await wait(RETRY_DELAYS[attempt]);
  }
 }
}
// Windows may report sharing/delete-pending contention as EPERM rather than
// EEXIST. Retry only acquisition: never remove the lock or run without ownership.
export async function openExclusiveFile(path,{platform=process.platform,create=open,wait=delay}={}){
 for(let attempt=0;;attempt++){
  try{return await create(path,'wx',0o600)}catch(error){
   if(platform!=='win32'||!TRANSIENT_WINDOWS_ERRORS.has(error.code)||attempt>=RETRY_DELAYS.length)throw error;
   await wait(RETRY_DELAYS[attempt]);
  }
 }
}
export async function atomicJSON(path,value){
 const temporary=path+'.'+randomUUID()+'.tmp';let file;
 try{
  file=await open(temporary,'wx',0o600);await file.writeFile(JSON.stringify(value));await file.sync();await file.close();file=null;
  await replaceAtomicFile(temporary,path);
 }finally{await file?.close().catch(()=>{});await unlink(temporary).catch(()=>{});}
}
