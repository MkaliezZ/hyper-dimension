import {writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {platform,arch,totalmem,freemem,cpus} from 'node:os';
import {observeOwnedBrowserProcesses,sampleOwnedBrowserStall} from './nativeBrowserResources.mjs';

// Read-only observations for the isolated native fixtures. No actor, clock,
// receipt, inventory, model request or browser visibility is changed.
const observation=`
let nativeWorkGraphics=null;
import('/src/connectedSpriteSurface.js').then(module=>nativeWorkGraphics=module.connectedSurfaceStatus).catch(()=>{});
const workFrameProbe={frames:0,lastAt:null,maxGapMs:0};
const workOriginalFrame=frame;
frame=at=>{if(workFrameProbe.lastAt!==null)workFrameProbe.maxGapMs=Math.max(workFrameProbe.maxGapMs,at-workFrameProbe.lastAt);workFrameProbe.lastAt=at;workFrameProbe.frames++;return workOriginalFrame(at);};
window.__nativeWorkObservation=()=>{
 const saved=saves.status(theme),resident=serverResident.inspect(),visitor=serverVisitor.inspect();
 return {rafDeliveryFault:window.__nativeFrameDrop||null,at:performance.now(),gameSeconds:now,day:state.day,daySeconds:state.daySeconds,hidden:document.hidden,overlay:!!window.hdLanOverlayOpen,recoveryBoot,changingTheme,crossSocialSending,firstDay:!!state.freshStartPending,frameLoop:typeof frameLoop==='undefined'?null:frameLoop.inspect(),blocked:saves.blocked(theme),frames:{...workFrameProbe},graphics:nativeWorkGraphics?.()||null,stewardInputPending:document.getElementById('hermesSend')?.disabled===true,save:{status:saved.status,capturing:!!saved.capturing,reconciling:!!saved.reconciling,commandSending:!!saved.commandSending,generation:saved.generation,acknowledgedGeneration:saved.acknowledgedSave?.generation,inflight:!!saved.inflight,planningCheckpoint:!!saved.planningCheckpointWorld},resident:{inflight:resident.inflight,locked:resident.locked},visitor:{inflight:visitor.inflight,locked:visitor.locked},npcs:npcs.map(n=>({id:n.npcId,x:n.x,y:n.y,path:n.path.length,inside:n.inside,homeRest:!!n.homeRest,think:n.think,intent:n.intent?{action:n.intent.action,goal:n.intent.goal,purposeId:n.intent.purposeId,starting:!!n.intent.starting}:null,indoor:n.indoorActor?{x:n.indoorActor.x,y:n.indoorActor.y,path:n.indoorActor.path?.length,arrivalPending:!!n.indoorActor.after,navigationOnly:n.indoorActor.after?.navigationOnly===true}:null,roomQueued:!!n.roomQueued,assignmentId:n.assignment?.id,intentStarting:!!n.intent?.starting,action:n.action?{type:n.action.type,t:n.action.t,duration:n.action.duration,acknowledgedAt:n.action.acknowledgedAt}:null})),projects:state.workProjects.map(p=>({id:p.id,status:p.status})),tasks:state.agentTaskLedger.map(t=>({id:t.id,status:t.status,completed:t.completed}))};
};`;

export function createNativeWorkJournal(out,report,{deadlineMs}={}){
 if(process.env.HD_QA_WORK_JOURNAL!=='1')return{install:async()=>{},observe(){},phase(){},beforeCleanup:async()=>{},finish:async()=>{}};
 const entries=[],browsers=new Map();let active=true,tail=Promise.resolve();
 report.nativeJournal={enabled:true,startedAt:new Date().toISOString(),host:{platform:platform(),arch:arch(),cpus:cpus().length,totalMemoryBytes:totalmem()},cleanupComplete:false};
 const flush=()=>{const encoded=JSON.stringify(report,null,2);tail=tail.then(async()=>{const tmp=join(out,'work-progress.json.tmp');await writeFile(tmp,encoded);await rename(tmp,join(out,'work-progress.json'));});return tail;};
 const timer=setInterval(()=>{
  report.nativeJournal.observedAt=new Date().toISOString();report.nativeJournal.freeMemoryBytes=freemem();report.nativeJournal.nodeRssBytes=process.memoryUsage().rss;
  for(const probe of browsers.values()){
   if(probe.pending||Date.now()-probe.last<10000)continue;
   probe.pending=true;probe.last=Date.now();report.nativeJournal.browserProbePendingSince=new Date().toISOString();
   probe.session.then(observeOwnedBrowserProcesses).then(processes=>{if(!active)return;report.nativeJournal.browserProcessSamples??=[];report.nativeJournal.browserProcessSamples.push({at:new Date().toISOString(),processes});if(report.nativeJournal.browserProcessSamples.length>12)report.nativeJournal.browserProcessSamples.shift();}).catch(e=>{if(active)report.nativeJournal.browserProbeError=String(e.message).slice(0,300);}).finally(()=>{probe.pending=false;delete report.nativeJournal.browserProbePendingSince;});
  }
  for(const entry of entries){
   if(entry.pending){
    if(platform()==='darwin'&&Date.now()-entry.pendingSince>=15000&&!report.nativeJournal.stallSampling){
     const probe=browsers.get(entry.page.context().browser());
     if(probe){report.nativeJournal.stallSampling={startedAt:new Date().toISOString(),reason:'Owned page observation unresponsive for 15 seconds',diagnosticIntervention:true,acceptanceInvalidated:true};probe.session.then(session=>sampleOwnedBrowserStall(session,{directory:out})).then(result=>{report.nativeJournal.stallSampling.result=result;}).catch(error=>{report.nativeJournal.stallSampling.error=String(error.message).slice(0,300);}).finally(async()=>{if(process.env.HD_QA_STALL_DIAGNOSTIC==='1'){report.passed=false;report.nativeJournal.stallSampling.expectedDiagnosticFailure=true;await flush();process.exit(1);}});}
    }continue;
   }
   if(entry.page.isClosed())continue;entry.pending=true;entry.pendingSince=Date.now();
   entry.page.evaluate(()=>window.__nativeWorkObservation?.()).then(sample=>{if(!active||!sample)return;entry.row.nativeWorkSamples??=[];entry.row.nativeWorkSamples.push(sample);if(entry.row.nativeWorkSamples.length>60)entry.row.nativeWorkSamples.shift();}).catch(e=>{if(active&&!entry.page.isClosed()&&!/Execution context was destroyed|Cannot find context/.test(e.message))entry.row.nativeObservationError=e.message;}).finally(()=>entry.pending=false);
  }
  flush().catch(e=>report.nativeJournal.writeError=e.message);
 },2000);timer.unref();
 const deadline=setTimeout(async()=>{report.passed=false;report.nativeJournal.deadlineExceededMs=deadlineMs;try{await flush();}finally{process.exit(1);}},deadlineMs);deadline.unref();
 return{
  async install(context,{additionalObservation=''}={}){await context.route('**/src/app.js',async route=>{try{const response=await route.fetch({maxRetries:1});await route.fulfill({response,body:(await response.text())+observation+additionalObservation});}catch(e){report.nativeJournal.routeError=e.message;await flush();await route.abort().catch(()=>{});}});},
  observe(page,row){entries.push({page,row,pending:false});
   const requests=new WeakMap();
   page.on('request',request=>{const path=new URL(request.url()).pathname,steward=path==='/api/hermes/command';if(request.method()!=='POST'||!path.startsWith('/api/saves/')&&!steward)return;let input;try{input=request.postDataJSON()}catch{}const sample={at:new Date().toISOString(),path,kind:input?.kind,operation:input?.operation,requestId:input?.requestId,startedMs:Date.now()};requests.set(request,sample);const key=steward?'nativeStewardRequests':'nativeSaveRequests',limit=steward?12:120;row[key]??=[];row[key].push(sample);if(row[key].length>limit)row[key].shift();});
   page.on('response',response=>{const sample=requests.get(response.request());if(sample){sample.status=response.status();sample.responseMs=Date.now()-sample.startedMs;}});
   page.on('requestfinished',request=>{const sample=requests.get(request);if(sample)sample.finishedMs=Date.now()-sample.startedMs;});
   page.on('requestfailed',request=>{const sample=requests.get(request);if(sample)sample.failure=request.failure()?.errorText||'request failed';});page.on('crash',()=>{row.nativePageCrashAt=new Date().toISOString();});const browser=page.context().browser();if(browser&&!browsers.has(browser)){const session=browser.newBrowserCDPSession();session.catch(()=>{});browsers.set(browser,{session,pending:false,last:0});}},
  phase(row,name){row.nativePhase=name;row.nativeStages??=[];row.nativeStages.push({name,at:new Date().toISOString()});},
  async beforeCleanup(){if(report.nativeJournal.stallSampling){report.passed=false;process.exitCode=1;}active=false;clearInterval(timer);report.nativeJournal.cleanupStartedAt=new Date().toISOString();await flush();},
  async finish(){clearTimeout(deadline);report.nativeJournal.cleanupComplete=true;report.nativeJournal.finishedAt=new Date().toISOString();await flush();}
 };
}
