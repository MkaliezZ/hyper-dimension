// Observe only the original fictional queue fixture. Keep its real clock,
// first-job120s/shared240s budgets, actions, reload, and all assertions unchanged.
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=resolve('island'),require=createRequire(join(root,'package.json'));
const {chromium}=require('playwright-core');
const out=resolve(root,'qa/v213/native-task-chains');
const replaceOnce=(source,needle,value)=>{
 if(source.split(needle).length!==2)throw Error('Task-chain observation hook changed');
 return source.replace(needle,value);
};
const hooks={
 'pendingSaveRecovery.js':source=>replaceOnce(source,' return mergeActionState(base.state,local,remote.state);',` try{return mergeActionState(base.state,local,remote.state);}catch(error){
  window.__hdPendingMergeFailure={at:Date.now(),code:error.code,path:error.path,message:error.message,pending:structuredClone(pending),remote:structuredClone(remote)};throw error;
 }`),
 'saveClient.js':source=>{
  source=replaceOnce(source,'function status(r,name,message){',`function status(r,name,message){
   if(name==='conflict'&&!window.__hdFirstSaveConflict)window.__hdFirstSaveConflict={at:Date.now(),name,message,version:r.version,remoteVersion:r.remoteVersion,generation:r.generation,dirty:r.dirty,commandSending:!!r.commandSending,pending:structuredClone(read(pendingKey(r.theme))),action:structuredClone(read(commandKey(r.theme))),autosave:structuredClone(read(autosaveKey(r.theme)))};
  `);
  return replaceOnce(source,'   r.state=pending?.state||local;r.version=pending?.baseVersion||read(metaKey(theme))?.version||null;r.dirty=true;',`   window.__hdSaveLoadFailure={at:Date.now(),code:error.code,path:error.path,message:error.message};
   r.state=pending?.state||local;r.version=pending?.baseVersion||read(metaKey(theme))?.version||null;r.dirty=true;`);
 }
};
if(process.argv.includes('--check-hooks')){
 for(const [name,hook]of Object.entries(hooks)){
  const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:hook(await readFile(join(root,'src',name),'utf8')),encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr);
 }
 console.log(JSON.stringify({hooksParsed:2,readOnly:true,originalNativeGatesUnchanged:true,browserStarted:false}));
 process.exit(0);
}
await mkdir(out,{recursive:true});
process.env.HD_QA_WORK_JOURNAL='1';
const launch=chromium.launch.bind(chromium);let sequence=0;
chromium.launch=async(...args)=>{
 const browser=await launch(...args),newContext=browser.newContext.bind(browser);
 browser.newContext=async(...contextArgs)=>{
  const context=await newContext(...contextArgs),index=++sequence,pages=[],snapshots=[];
  for(const [name,hook]of Object.entries(hooks))await context.route('**/src/'+name,async route=>{
   if(route.request().method()!=='GET')throw Error('Source observation is GET only');
   const response=await route.fetch({maxRetries:1});
   await route.fulfill({response,body:hook(await response.text())});
  });
  context.on('page',page=>pages.push(page));
  const close=context.close.bind(context);
  context.close=async(...closeArgs)=>{
   try{
    for(const page of pages)if(!page.isClosed())snapshots.push(await page.evaluate(()=>({url:location.pathname,conflict:window.__hdFirstSaveConflict||null,merge:window.__hdPendingMergeFailure||null,load:window.__hdSaveLoadFailure||null,status:document.querySelector('#saveStatus')?.dataset.status})).catch(error=>({error:error.message})));
    await writeFile(join(out,'reload-observation-'+index+'.json'),JSON.stringify({scope:'Owned fictional fixture; read-only first-conflict journal and exact merge path; no user data.',snapshots},null,2));
   }finally{await close(...closeArgs);}
  };
  return context;
 };
 return browser;
};
process.chdir(root);
await import(pathToFileURL(join(root,'tests/v213-task-chain-browser.mjs')).href);
