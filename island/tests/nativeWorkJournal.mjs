import {writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {platform,arch,totalmem,freemem,cpus} from 'node:os';

// Read-only observations for the isolated native fixtures. No actor, clock,
// receipt, inventory, model request or browser visibility is changed.
const observation=`
const workFrameProbe={frames:0,lastAt:null,maxGapMs:0};
const workOriginalFrame=frame;
frame=at=>{if(workFrameProbe.lastAt!==null)workFrameProbe.maxGapMs=Math.max(workFrameProbe.maxGapMs,at-workFrameProbe.lastAt);workFrameProbe.lastAt=at;workFrameProbe.frames++;return workOriginalFrame(at);};
window.__nativeWorkObservation=()=>{
 const saved=saves.status(theme),resident=serverResident.inspect(),visitor=serverVisitor.inspect();
 return {at:performance.now(),gameSeconds:now,day:state.day,daySeconds:state.daySeconds,hidden:document.hidden,overlay:!!window.hdLanOverlayOpen,recoveryBoot,changingTheme,crossSocialSending,firstDay:!!state.freshStartPending,blocked:saves.blocked(theme),frames:{...workFrameProbe},save:{status:saved.status,capturing:!!saved.capturing,reconciling:!!saved.reconciling,commandSending:!!saved.commandSending},resident:{inflight:resident.inflight,locked:resident.locked},visitor:{inflight:visitor.inflight,locked:visitor.locked},npcs:npcs.map(n=>({id:n.npcId,x:n.x,y:n.y,path:n.path.length,inside:n.inside,homeRest:!!n.homeRest,think:n.think,intent:n.intent?{action:n.intent.action,goal:n.intent.goal,purposeId:n.intent.purposeId,starting:!!n.intent.starting}:null,indoor:n.indoorActor?{x:n.indoorActor.x,y:n.indoorActor.y,path:n.indoorActor.path?.length,arrivalPending:!!n.indoorActor.after,navigationOnly:n.indoorActor.after?.navigationOnly===true}:null,roomQueued:!!n.roomQueued,assignmentId:n.assignment?.id,intentStarting:!!n.intent?.starting,action:n.action?{type:n.action.type,t:n.action.t,duration:n.action.duration,acknowledgedAt:n.action.acknowledgedAt}:null})),projects:state.workProjects.map(p=>({id:p.id,status:p.status})),tasks:state.agentTaskLedger.map(t=>({id:t.id,status:t.status,completed:t.completed}))};
};`;

export function createNativeWorkJournal(out,report,{deadlineMs}={}){
 if(process.env.HD_QA_WORK_JOURNAL!=='1')return{install:async()=>{},observe(){},phase(){},beforeCleanup:async()=>{},finish:async()=>{}};
 const entries=[];let active=true,tail=Promise.resolve();
 report.nativeJournal={enabled:true,startedAt:new Date().toISOString(),host:{platform:platform(),arch:arch(),cpus:cpus().length,totalMemoryBytes:totalmem()},cleanupComplete:false};
 const flush=()=>{const encoded=JSON.stringify(report,null,2);tail=tail.then(async()=>{const tmp=join(out,'work-progress.json.tmp');await writeFile(tmp,encoded);await rename(tmp,join(out,'work-progress.json'));});return tail;};
 const timer=setInterval(()=>{
  report.nativeJournal.observedAt=new Date().toISOString();report.nativeJournal.freeMemoryBytes=freemem();report.nativeJournal.nodeRssBytes=process.memoryUsage().rss;
  for(const entry of entries){
   if(entry.pending||entry.page.isClosed())continue;entry.pending=true;
   entry.page.evaluate(()=>window.__nativeWorkObservation?.()).then(sample=>{if(!active||!sample)return;entry.row.nativeWorkSamples??=[];entry.row.nativeWorkSamples.push(sample);if(entry.row.nativeWorkSamples.length>60)entry.row.nativeWorkSamples.shift();}).catch(e=>{if(active&&!entry.page.isClosed()&&!/Execution context was destroyed|Cannot find context/.test(e.message))entry.row.nativeObservationError=e.message;}).finally(()=>entry.pending=false);
  }
  flush().catch(e=>report.nativeJournal.writeError=e.message);
 },2000);timer.unref();
 const deadline=setTimeout(async()=>{report.passed=false;report.nativeJournal.deadlineExceededMs=deadlineMs;try{await flush();}finally{process.exit(1);}},deadlineMs);deadline.unref();
 return{
  async install(context){await context.route('**/src/app.js',async route=>{try{const response=await route.fetch({maxRetries:1});await route.fulfill({response,body:(await response.text())+observation});}catch(e){report.nativeJournal.routeError=e.message;await flush();await route.abort().catch(()=>{});}});},
  observe(page,row){entries.push({page,row,pending:false});},
  phase(row,name){row.nativePhase=name;row.nativeStages??=[];row.nativeStages.push({name,at:new Date().toISOString()});},
  async beforeCleanup(){active=false;clearInterval(timer);report.nativeJournal.cleanupStartedAt=new Date().toISOString();await flush();},
  async finish(){clearTimeout(deadline);report.nativeJournal.cleanupComplete=true;report.nativeJournal.finishedAt=new Date().toISOString();await flush();}
 };
}
