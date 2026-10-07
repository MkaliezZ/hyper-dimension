import {runtimeConfig} from './runtimeConfig.mjs';
import {resolve} from 'node:path';import {execFile} from 'node:child_process';import {runLedger} from './runLedger.mjs';import {createWorkbenchStore} from './workbenchStore.mjs';
const root=resolve(import.meta.dirname,'..');
export const artifactDirectory=resolve(process.env.HD_ARTIFACT_DIR||resolve(process.env.HD_SAVE_DIR||resolve(root,'data/saves'),'_artifacts'));
function readSnapshot(path,offset,sha256){
 if(!Number.isSafeInteger(offset)||offset<1||offset>1000000)throw Object.assign(Error('预览页码无效'),{status:400});
 const executable=runtimeConfig.paths.documentPython;
 return new Promise((resolveReply,reject)=>{
  const child=execFile(executable,[resolve(root,'server/document_worker.py')],{windowsHide:true,timeout:45000,maxBuffer:1024*1024,env:{...process.env,HD_ARTIFACT_DIR:artifactDirectory,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'},(error,stdout)=>{if(error)return reject(Object.assign(Error('正文预览暂不可用，请重试或下载原文件'),{status:503}));try{const d=JSON.parse(stdout);if(d.success===false)throw Error(d.error);resolveReply(d)}catch(e){reject(Object.assign(Error(String(e.message).slice(0,180)),{status:503}))}});
  child.stdin.end(JSON.stringify({operation:'snapshot_read',args:{path,offset,limit:120,sha256}}));
 });
}
export const workbench=createWorkbenchStore({directory:artifactDirectory,ledger:runLedger,preview:readSnapshot});
