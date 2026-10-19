// Observe the unmodified recruitment test on its fictional islands. Baseline
// hooks only record scheduling. The opt-in candidate retains the island backdrop
// during recruitment; neither mode resolves receipts or changes the game clock.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=resolve('island'),require=createRequire(join(root,'package.json'));
const {chromium}=require('playwright-core');
const nativeCase=process.env.HD_QA_NATIVE_CASE||'recruitment';
if(!['recruitment','player-action','custom-content','pearl-cup'].includes(nativeCase))throw Error('Unknown native diagnostic case');
const backdropCandidate=process.env.HD_QA_RECRUIT_BACKDROP==='1';
if(backdropCandidate&&nativeCase!=='recruitment')throw Error('Recruitment candidate cannot modify player-action diagnostics');
const profileEnabled=process.env.HD_QA_NATIVE_PROFILE==='1';
const nativeTest=({'recruitment':'v287-recruitment-progress-browser.mjs','player-action':'v281-player-action-browser.mjs','custom-content':'v224-custom-content-browser.mjs','pearl-cup':'v156-pearl-cup-craft-browser.mjs'})[nativeCase];
const out=resolve(process.env.HD_QA_OUT||join(root,({'recruitment':'qa/v287/native-recruitment-progress','player-action':'qa/v281/native-player-action','custom-content':'qa/v224/native-custom-content','pearl-cup':'qa/v156/native-pearl-cup-craft'})[nativeCase]));
await mkdir(out,{recursive:true});
const originalLaunch=chromium.launch.bind(chromium),cases=[];
const record=(row,event,details={})=>{if(row.events.length<1500)row.events.push({at:Date.now(),event,...details});};
const safeError=error=>String(error?.message||error).slice(0,300);
function insert(source,needle,replacement){
 if(source.split(needle).length!==2)throw Error('Recruitment diagnostic source hook changed: '+needle);
 return source.replace(needle,replacement);
}
function observeClient(source){
 const mark='window.__hdRecruitMark?.';
 source=insert(source,'function cache(r){',`function cache(r){${mark}('cache',{theme:r.theme,generation:r.generation});`);
 source=insert(source,'function status(r,name,message){',`function status(r,name,message){${mark}('status',{theme:r.theme,name});`);
 source=insert(source,'function queueOperation(r,run,options){',`function queueOperation(r,run,options){${mark}('queue',{theme:r.theme,barrier:!!options?.barrier});`);
 source=insert(source,'async function actionNow(theme,input,prepareInput){',`async function actionNow(theme,input,prepareInput){${mark}('action-start',{theme,kind:input.kind,operation:input.operation});`);
 source=insert(source,'const response=await journal.request(',`${mark}('request-start',{theme,operation});const response=await journal.request(`);
 return insert(source,'const data=response.data||JSON.parse(response.text);',`${mark}('request-end',{theme,operation,status:response.status});const data=response.data||JSON.parse(response.text);`);
}
function observeJournal(source){
 source=insert(source,'const id=++sequence,timer=',"const id=++sequence;window.__hdRecruitMark?.('rpc-start',{id,operation});const timer=");
 return insert(source,'pending.delete(data.id);clearTimeout(call.timer);',"pending.delete(data.id);clearTimeout(call.timer);window.__hdRecruitMark?.('rpc-end',{id:data.id,error:!!data.error});");
}
function candidateBackdrop(source){
 if(source.includes('const recruitmentWaiting=!!modal'))return source;
 return insert(source,'const personalWaiting=!!modal',`const recruitmentWaiting=!!modal&&!!$('modalRoot').querySelector('#recruitmentPanel[aria-busy="true"]');if(recruitmentWaiting&&render.recruitmentSnapshot&&!render.invalidated)return;render.recruitmentSnapshot=recruitmentWaiting;const personalWaiting=!!modal`);
}
async function snapshot(row,page,phase){
 let timer;
 try{row.snapshots.push({phase,...await Promise.race([page.evaluate(()=>{
  const progress=window.__recruitProgress,view=window.islandInspect?.(),theme=view?.theme;
  const status=progress&&theme?progress.saves.status(theme):null,co=view?.cocreation;
  return {diagnostic:window.__hdRecruitDiagnostic,foreign:window.__recruitForeign,theme,playerAction:window.__playerActionQA?.inspect(),
   ocean:{backend:view?.environment?.art?.backend,worker:view?.environment?.art?.oceanWorker},frameLoop:view?.frameLoop,raster:view?.rendering?.raster,cocreation:co?{view:co.view,chosen:co.chosen,flight:co.flight,pending:!!co.pending,catalogSync:co.catalogSync,badges:document.querySelector('.co-badges')?.textContent}:null,saveUI:{status:document.querySelector('#saveStatus')?.dataset.status,message:document.querySelector('#saveStatus')?.textContent},
   save:status?Object.fromEntries(['status','message','dirty','capturing','reconciling','pending','recovering'].map(k=>[k,status[k]])):null,
   resumeDisabled:document.querySelector('#recruitResume')?.disabled,
   busy:document.querySelector('#recruitmentPanel')?.getAttribute('aria-busy'),
   feedback:document.querySelector('.recruit-await')?.textContent};
 }),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Diagnostic snapshot unavailable within2000ms')),2000))])});}
 catch(error){row.snapshots.push({phase,error:safeError(error)});}finally{clearTimeout(timer);}
}
function beginProfile(context,page,row,index,phase){
 const ready=context.newCDPSession(page).then(async session=>{
  await session.send('Profiler.enable');await session.send('Profiler.setSamplingInterval',{interval:1000});await session.send('Profiler.start');return session;
 });
 ready.catch(error=>record(row,'profile-start-error',{phase,error:safeError(error)}));
 return {ready,index,phase,stopped:false};
}
async function stopProfile(row,job){
 if(!job||job.stopped)return;job.stopped=true;let timer,session;
 try{
  const result=await Promise.race([(async()=>{session=await job.ready;return await session.send('Profiler.stop');})(),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Diagnostic profiler stop unavailable within5000ms')),5000))]);
  const file='scheduling-profile-'+row.context+'-'+job.index+'-'+job.phase+'.cpuprofile';await writeFile(join(out,file),JSON.stringify(result.profile));row.profiles.push({file,phase:job.phase,nodes:result.profile.nodes.length,samples:result.profile.samples?.length||0,wallMs:(result.profile.endTime-result.profile.startTime)/1000});
 }catch(error){row.profiles.push({phase:job.phase,error:safeError(error)});}finally{clearTimeout(timer);if(session)await session.detach().catch(()=>{});else job.ready.then(value=>value.detach()).catch(()=>{});}
}
if(process.argv.includes('--check-hooks')){
 for(const [file,transform] of [['saveClient.js',observeClient],['saveJournal.js',observeJournal],['app.js',candidateBackdrop]]){
  const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:transform(await readFile(join(root,'src',file),'utf8')),encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr||'Diagnostic module did not parse');
 }
 const original=chromium.launch;chromium.launch=originalLaunch;
 if(chromium.launch!==originalLaunch)throw Error('Browser launch cannot be observed');
 chromium.launch=original;
 console.log(JSON.stringify({sourceHooksParsed:3,originalTestUnmodified:true,browserStarted:false}));
 process.exit(0);
}
chromium.launch=async(...args)=>{
 const browser=await originalLaunch(...args),originalContext=browser.newContext.bind(browser);
 browser.newContext=async(...contextArgs)=>{
  const context=await originalContext(...contextArgs),row={context:cases.length+1,nativeCase,variant:backdropCandidate?'pending-backdrop-candidate':'unchanged-game-baseline',events:[],sourceHooks:[],pages:[],snapshots:[],profiles:[]},profileJobs=[];cases.push(row);
  if(backdropCandidate){
   // The original test registers its own app hook last. Observe that hook's
   // actual fetched response so its recruitment fixture remains unchanged.
   const originalRoute=context.route.bind(context);
   context.route=async(pattern,handler,...routeArgs)=>{
    if(pattern!=='**/src/app.js')return originalRoute(pattern,handler,...routeArgs);
    return originalRoute(pattern,async route=>handler(new Proxy(route,{get(target,key){
     if(key==='fetch')return async(...fetchArgs)=>{
      const response=await target.fetch(...fetchArgs);
      return new Proxy(response,{get(value,property){
       if(property==='text')return async()=>{const source=candidateBackdrop(await value.text());row.sourceHooks.push('pending-recruitment-backdrop-candidate');return source;};
       const member=Reflect.get(value,property,value);return typeof member==='function'?member.bind(value):member;
      }});
     };
     const member=Reflect.get(target,key,target);return typeof member==='function'?member.bind(target):member;
    }})),...routeArgs);
   };
  }
  await context.addInitScript(()=>{
   const events=[];window.__hdRecruitDiagnostic={events,longTasks:[]};
   window.__hdRecruitMark=(event,details={})=>{if(events.length<1500)events.push({at:performance.now(),event,...details});};
   try{new PerformanceObserver(list=>{for(const task of list.getEntries())if(window.__hdRecruitDiagnostic.longTasks.length<120)window.__hdRecruitDiagnostic.longTasks.push({start:task.startTime,duration:task.duration});}).observe({type:'longtask',buffered:true});}catch{}
  });
  context.on('page',page=>{
   row.pages.push(page);
   if(profileEnabled){
    // This session belongs solely to the newly created fictional fixture page.
    // Sampling never attaches to an existing or user-owned browser.
    const index=row.pages.length;let phase=1,job=beginProfile(context,page,row,index,phase);profileJobs.push(job);
    const originalReload=page.reload.bind(page);
    // Preserve the critical completed interaction before its original reload.
    // Chrome may reset a CPU profile and init-script observations on navigation.
    // This collection starts only after the test has called its actual reload;
    // it never runs inside or extends an interaction assertion's deadline.
    page.reload=async(...reloadArgs)=>{
     await snapshot(row,page,'before-reload-'+phase);await stopProfile(row,job);
     const result=await originalReload(...reloadArgs);
     job=beginProfile(context,page,row,index,++phase);profileJobs.push(job);return result;
    };
   }
   page.on('request',request=>{
    const path=new URL(request.url()).pathname;if(!path.startsWith('/api/'))return;
    let input;try{input=request.postDataJSON();}catch{}
    record(row,'request',{path,method:request.method(),...(input&&typeof input==='object'?{kind:input.kind,operation:input.operation}:{} )});
   });
   page.on('response',response=>{const path=new URL(response.url()).pathname;if(path.startsWith('/api/'))record(row,'response',{path,status:response.status()});});
   page.on('requestfailed',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/api/'))record(row,'requestfailed',{path,error:request.failure()?.errorText});});
   page.on('pageerror',error=>record(row,'pageerror',{error:safeError(error)}));
  });
  await context.route('**/src/saveClient.js',async route=>{
   const response=await route.fetch(),source=observeClient(await response.text());
   row.sourceHooks.push('saveClient');await route.fulfill({response,body:source});
  });
  await context.route('**/src/saveJournal.js',async route=>{
   const response=await route.fetch(),source=observeJournal(await response.text());
   row.sourceHooks.push('saveJournal');await route.fulfill({response,body:source});
  });
  const originalClose=context.close.bind(context);
  context.close=async(...closeArgs)=>{
   try{
    for(const page of row.pages){
     if(page.isClosed())continue;
     await snapshot(row,page,'context-close');
    }
    for(const job of profileJobs)await stopProfile(row,job);
    await writeFile(join(out,'scheduling-journal-'+row.context+'.json'),JSON.stringify({...row,pages:row.pages.length},null,2));
   }finally{await originalClose(...closeArgs);}
  };
  return context;
 };
 return browser;
};
// The original test retains its inputs, assertions, response-loss choreography
// and original per-case time limits. Import it from its actual package.
process.chdir(root);
await import(pathToFileURL(join(root,'tests',nativeTest)).href);
