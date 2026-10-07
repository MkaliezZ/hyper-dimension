import assert from 'node:assert/strict';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {chromium} from 'playwright-core';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const out=process.argv[4]||'qa/save-stutter-v7',name=process.argv[2]||'current',cpu=Number(process.argv[3]||1),baseline=process.env.HD_SAVE_V7_BASELINE==='1';
await mkdir(out,{recursive:true});
const directory=await mkdtemp(resolve(out+'/metadata-fixture-'));
const service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-METADATA-SAVE'}),base='http://127.0.0.1:'+service.port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const metadataHistory=Array.from({length:768},(_,i)=>({id:i,message:'旧作业回执记录'.repeat(12),details:{building:i%25,items:{wood:2,stone:1},status:'completed',proof:'anonymous-fixture-'+i}}));
const report={scope:'Isolated accounts, real Worker/IndexedDB and five-second automatic saves, near-2MB state, anonymous additional metadata history, 300ms latency. No private progress or model calls.',cpu,baseline,metadataBytes:Buffer.byteLength(JSON.stringify(metadataHistory)),checks:[],errors:[]};
const hook="window.__metadataProfile={\n prepare:async()=>{\n  await startupRecovery;await saves.idle(theme);closeModal();state.freshStartPending=false;\n  for(const n of npcs)n.manualUntil=1e9;\n  state.qaPerformanceHistory=Array.from({length:1000},(_,i)=>({id:i,message:\"保存记录\".repeat(80),values:Array.from({length:12},(_,j)=>({key:j,text:\"回执记录\".repeat(5)}))}));\n  persist();await saves.flush(theme);await saves.idle(theme);\n },\n start:()=>{setTimeout(()=>{\n  const metrics={frames:[],long:[],saves:[],worker:[],replies:[],started:performance.now()},posts=Worker.prototype.postMessage,watched=new WeakSet(),requests=new Map();\n  window.__metadataLive=metrics;let alive=true,last=performance.now(),px=actor.x,previousStatus=false,save=null;\n  Worker.prototype.postMessage=function(m,...rest){\n   const t=performance.now();try{return posts.call(this,m,...rest)}finally{if(alive)metrics.worker.push({operation:m.operation,ms:performance.now()-t});}\n  };\n  const observer=new PerformanceObserver(list=>{if(alive)for(const e of list.getEntries())if(e.startTime>=metrics.started)metrics.long.push({start:e.startTime,ms:e.duration});});observer.observe({type:'longtask',buffered:false});\n  function walk(){actor.path=[{x:actor.x>820?730:930,y:actor.y}];actor.after=walk;}actor.action=null;walk();\n  function sample(t){\n   if(!alive)return;metrics.frames.push(t-last);last=t;const moved=Math.abs(actor.x-px);px=actor.x;\n   const r=saves.status(theme);\n   if(!!r.inflight!==previousStatus){if(r.inflight){save={start:performance.now(),distance:0};metrics.saves.push(save);}else if(save){save.end=performance.now();save.final=r.status;save=null;}previousStatus=!!r.inflight;}\n   if(save)save.distance+=moved;requestAnimationFrame(sample);\n  }requestAnimationFrame(sample);\n  for(let i=0;i<3;i++)setTimeout(()=>{state.qaPerformanceHistory[12].message='增量回执保存-'+i;persist();},i*6000);\n  setTimeout(()=>{alive=false;window.__metadataLive=null;observer.disconnect();Worker.prototype.postMessage=posts;window.__metadataReport={...metrics,maxFrameMs:Math.max(...metrics.frames),frameCount:metrics.frames.length,frames:undefined,finalStatus:saves.status(theme).status};window.__metadataDone=true;},23500);\n },300);}\n};";
try{
 for(const theme of ['pixel','origami']){
  const user=await service.identities.register({login:theme+'_metadata',password:'isolated-password',name:'保存验证',islandName:'验证岛',theme,avatar:'male_0'});
  const store=(await service.tenants.get(user.token)).saves,context=await browser.newContext({viewport:{width:1280,height:850}});
  await context.addCookies([{name:'hd_lan_session',value:user.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  if(baseline)for(const file of ['saveClient.js','saveJournal.js','saveWorker.js'])await context.route('**/src/'+file,r=>readFile('qa/save-stutter-v7/before/src__'+file,'utf8').then(body=>r.fulfill({contentType:'application/javascript',body})));
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=req.url();
   if(url.includes('/api/saves/')){
    if(req.method()==='POST'&&(url.endsWith('/save')||url.endsWith('/action')))await new Promise(r=>setTimeout(r,300));
    const response=await route.fetch(),data=await response.json();
    if(response.ok()&&data.document)data.document.actions={...(data.document.actions||{}),qaMetadataHistory:metadataHistory};
    return route.fulfill({response,contentType:'application/json',body:JSON.stringify(data)});
   }
   if(url.endsWith('/api/lan/me'))return route.continue();
   return route.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated verification"}'});
  });
  await context.addInitScript("(()=>{\n const OriginalWorker=window.Worker;\n window.Worker=class extends OriginalWorker{\n  constructor(...args){\n   super(...args);this.__qaRequests=new Map();\n   this.addEventListener('message',event=>{\n    const metrics=window.__metadataLive,op=this.__qaRequests.get(event.data.id);this.__qaRequests.delete(event.data.id);\n    if(!metrics||op?.operation!=='request'||!op.metadataOnly)return;\n    const d=event.data.result?.data?.document;if(d)metrics.replies.push({delta:!!d.actionsDelta,fullHistory:!!d.actions?.qaMetadataHistory,changes:d.actionsDelta?.changes?.length||0,encodedChangeCharacters:(d.actionsDelta?.changes||[]).reduce((n,c)=>n+(c.encoded?.length||0),0)});\n   });\n  }\n  postMessage(m,...rest){this.__qaRequests.set(m.id,{operation:m.operation,metadataOnly:m.value?.metadataOnly});return super.postMessage(m,...rest);}\n };\n})()");
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/src/app.js',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\n'+hook});});
  await page.goto(base+'/play');await page.waitForFunction(()=>!!window.__metadataProfile);await page.evaluate(()=>__metadataProfile.prepare());
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
  await page.evaluate(()=>__metadataProfile.start());await page.waitForTimeout(24200);
  const metrics=await page.evaluate(()=>__metadataReport);assert(metrics);report.checks.push({theme,metrics});
  const completed=metrics.saves.filter(s=>s.end);assert(completed.length>=3);assert(completed.every(s=>s.distance>1));
  const saved=await store.current(theme);assert.equal(saved.state.qaPerformanceHistory[12].message,'增量回执保存-2');
  metrics.saveBytes=Buffer.byteLength(JSON.stringify(saved.state));metrics.maxWorkerMs=Math.max(...metrics.worker.map(m=>m.ms));delete metrics.worker;
  assert(metrics.replies.length>=3);
  if(!baseline){assert(metrics.replies.every(r=>r.delta&&!r.fullHistory));assert(metrics.replies.every(r=>r.encodedChangeCharacters<50000));}
  else assert(metrics.replies.some(r=>r.fullHistory));
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser.close();await service.close();await writeFile(out+'/'+name+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
