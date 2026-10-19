// Observe the original four-case native fixture without changing its inputs,
// request identity, poll scheduling, assertions, or deadlines. Owned CI pages only.
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=resolve('island'),require=createRequire(join(root,'package.json'));
const {chromium}=require('playwright-core');
const out=resolve(root,'qa/v222/native-recruitment-errors');
await mkdir(out,{recursive:true});
const hook=source=>{
 const needle='const $=id=>document.getElementById(id);';
 if(source.split(needle).length!==2)throw Error('Recruitment observation hook changed');
 return source.replace(needle,`window.__hdRecruitStatusInspect=()=>({polling,busy,error,errorRequestId,pollError,lastPoll,generation,world:here().world,activeId:registry?.active?.id,pendingId:state().recruitment?.pending?.id});${needle}`);
};
if(process.argv.includes('--check-hooks')){
 const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:hook(await readFile(join(root,'src/recruitmentUI.js'),'utf8')),encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr);
 console.log(JSON.stringify({hookParsed:true,gameLogicChanged:false,browserStarted:false}));
 process.exit(0);
}
const launch=chromium.launch.bind(chromium);let sequence=0;
chromium.launch=async(...args)=>{
 const browser=await launch(...args),newContext=browser.newContext.bind(browser);
 browser.newContext=async(...contextArgs)=>{
  const context=await newContext(...contextArgs),index=++sequence,row={index,scope:'Owned fictional native recruitment fixture; read-only observations; original assertions and deadlines retained.',network:[],snapshots:[]},pages=[];
  await context.addInitScript(()=>{
   const samples=[];window.__hdRecruitStatusSamples=samples;let previous='';
   setInterval(()=>{
    const inspect=window.__hdRecruitStatusInspect;if(!inspect)return;
    const active=document.activeElement,root=document.querySelector('#recruitmentPanel');
    const value={...inspect(),focus:{id:active?.id,tag:active?.tagName,policy:!!active?.closest('#recruitPolicyForm')},issue:root?.querySelector('.recruit-error')?.textContent||'',panelBusy:root?.getAttribute('aria-busy'),visible:document.visibilityState};
    const signature=JSON.stringify(value);if(signature===previous)return;previous=signature;
    if(samples.length<1200)samples.push({at:performance.now(),...value});
   },250);
  });
  await context.route('**/src/recruitmentUI.js',async route=>{
   const response=await route.fetch();await route.fulfill({response,body:hook(await response.text())});
  });
  context.on('page',page=>{
   pages.push(page);const requests=new WeakMap();let requestSequence=0;
   const relevant=request=>new URL(request.url()).pathname.startsWith('/api/');
   page.on('request',request=>{
    if(!relevant(request)||row.network.length>=1500)return;
    const entry={id:++requestSequence,at:Date.now(),path:new URL(request.url()).pathname,method:request.method()};requests.set(request,entry);row.network.push(entry);
   });
   page.on('response',response=>{const entry=requests.get(response.request());if(entry){entry.responseAt=Date.now();entry.status=response.status();}});
   page.on('requestfinished',request=>{const entry=requests.get(request);if(entry){entry.finishedAt=Date.now();entry.timing=request.timing();}});
   page.on('requestfailed',request=>{const entry=requests.get(request);if(entry){entry.failedAt=Date.now();entry.failure=request.failure()?.errorText;}});
  });
  const close=context.close.bind(context);
  context.close=async(...closeArgs)=>{
   try{
    for(const page of pages){
     let timer;
     try{row.snapshots.push(await Promise.race([page.evaluate(()=>({samples:window.__hdRecruitStatusSamples||[],last:window.__hdRecruitStatusInspect?.(),save:document.querySelector('#saveStatus')?.textContent,frameLoop:window.islandInspect?.().frameLoop})),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Owned snapshot unavailable within2000ms')),2000))]));}
     catch(error){row.snapshots.push({error:String(error.message).slice(0,300)});}finally{clearTimeout(timer);}
    }
    await writeFile(join(out,'status-observations-'+index+'.json'),JSON.stringify(row,null,2));
   }finally{await close(...closeArgs);}
  };
  return context;
 };
 return browser;
};
process.chdir(root);
await import(pathToFileURL(join(root,'tests/v222-recruitment-errors-browser.mjs')).href);
