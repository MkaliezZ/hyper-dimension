import assert from 'node:assert/strict';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {chromium} from 'playwright-core';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=process.argv[4]||'qa/save-stutter-v6',name=process.argv[2]||'automatic',cpu=Number(process.argv[3]||1),baseline=process.env.HD_SAVE_BASELINE==='1';
await mkdir(out,{recursive:true});const directory=await mkdtemp(resolve(out+'/auto-fixture-'));
const service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-AUTOSAVE'}),base='http://127.0.0.1:'+service.port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={scope:'Three real five-second automatic saves per theme, near-2MB isolated accounts, 300ms latency, no live user saves or model calls. In-page timer starts/stops measurement without CDP evaluation during the measured period.',baseline,cpu,checks:[],errors:[]};
const hook=`
window.__autoProfile={
 prepare:async()=>{await startupRecovery;await saves.idle(theme);closeModal();state.freshStartPending=false;for(const n of npcs)n.manualUntil=1e9;state.qaPerformanceHistory=Array.from({length:1000},(_,i)=>({id:i,message:"保存记录".repeat(80),values:Array.from({length:12},(_,j)=>({key:j,text:"回执记录".repeat(5)}))}));persist();await saves.flush(theme);await saves.idle(theme);},
 start:()=>{setTimeout(()=>{
 const metrics={frames:[],long:[],saves:[],worker:[],distance:0,started:performance.now()},posts=Worker.prototype.postMessage;
 let alive=true,last=performance.now(),px=actor.x,latestStatus=null,save=null;
 Worker.prototype.postMessage=function(m,...rest){const t=performance.now();try{return posts.call(this,m,...rest)}finally{if(alive)metrics.worker.push({operation:m.operation,ms:performance.now()-t,reset:!!m.value?.reset,changes:m.value?.changes?.length,fullHistory:!!m.value?.qaPerformanceHistory});}};
 const observer=new PerformanceObserver(items=>{if(alive)for(const e of items.getEntries())if(e.startTime>=metrics.started)metrics.long.push({start:e.startTime,ms:e.duration});});observer.observe({type:'longtask',buffered:false});
 function walk(){actor.path=[{x:actor.x>820?730:930,y:actor.y}];actor.after=walk;}
 actor.action=null;walk();
 function sample(t){if(!alive)return;metrics.frames.push(t-last);last=t;const moved=Math.abs(actor.x-px);metrics.distance+=moved;px=actor.x;
 const record=saves.status(theme),status=record.status;if(!!record.inflight!==latestStatus){
  if(record.inflight){save={start:performance.now(),distance:0};metrics.saves.push(save);}
  if(save&&!record.inflight){save.end=performance.now();save.final=status;save=null;}latestStatus=!!record.inflight;
 }if(save)save.distance+=moved;requestAnimationFrame(sample);}
 requestAnimationFrame(sample);
 for(let i=0;i<3;i++)setTimeout(()=>{state.qaPerformanceHistory[12].message='连续保存-'+i;persist();},i*6000);
 setTimeout(()=>{alive=false;observer.disconnect();Worker.prototype.postMessage=posts;
 window.__autoReport={...metrics,maxFrameMs:Math.max(...metrics.frames),frames:metrics.frames.length,finalStatus:saves.status(theme).status};window.__autoDone=true;},23500);
 },300);}
};
`;
try{for(const theme of ['pixel','origami']){
 const user=await service.identities.register({login:theme+'_auto',password:'isolated-password',name:'连续保存验证',islandName:'验证岛',theme,avatar:'male_0'});
 const store=(await service.tenants.get(user.token)).saves,context=await browser.newContext({viewport:{width:1280,height:850}});
 await context.addCookies([{name:'hd_lan_session',value:user.token,url:base,httpOnly:true,sameSite:'Strict'}]);
 if(baseline)for(const file of ['saveClient.js','saveJournal.js','saveWorker.js'])await context.route('**/src/'+file,async r=>r.fulfill({contentType:'application/javascript',body:await readFile('qa/save-stutter-v6/before/src__'+file,'utf8')}));
 await context.route('**/api/**',async r=>{const url=r.request().url();if(url.includes('/api/saves/')||url.endsWith('/api/lan/me')){if(r.request().method()==='POST'&&(url.endsWith('/save')||url.endsWith('/action')))await new Promise(r=>setTimeout(r,300));return r.continue();}return r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated verification"}'});});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/src/app.js',async r=>{const response=await r.fetch(),source=baseline?await readFile('qa/save-stutter-v6/before/src__app.js','utf8'):await response.text();await r.fulfill({response,body:source+'\n'+hook});});
 await page.goto(base+'/play');await page.waitForFunction(()=>!!window.__autoProfile);await page.evaluate(()=>__autoProfile.prepare());
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
 await page.evaluate(()=>__autoProfile.start());await page.waitForTimeout(24000);
 const metrics=await page.evaluate(()=>__autoReport);assert(metrics);report.checks.push({theme,metrics});const completed=metrics.saves.filter(s=>s.end);assert(completed.length>=3);assert(completed.every(s=>s.distance>1));assert(['saved','pending','saving'].includes(metrics.finalStatus));
 const saved=await store.current(theme);assert.equal(saved.state.qaPerformanceHistory[12].message,'连续保存-2');assert.equal(saved.state.qaPerformanceHistory.length,1000);
 if(!baseline){assert(!metrics.worker.some(x=>x.operation==='encode'&&x.fullHistory));assert(metrics.worker.some(x=>x.operation==='snapshot'));assert(!metrics.worker.some(x=>x.operation==='snapshot'&&x.reset));}
 metrics.workerTotalMs=metrics.worker.reduce((v,x)=>v+x.ms,0);metrics.maxWorkerMs=Math.max(...metrics.worker.map(x=>x.ms));metrics.bytes=Buffer.byteLength(JSON.stringify(saved.state));
 await context.close();
}assert.deepEqual(report.errors,[]);report.passed=true;}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await service.close();await writeFile(out+'/'+name+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,checks:report.checks.map(x=>({theme:x.theme,metrics:{...x.metrics,worker:undefined}}))}));}
