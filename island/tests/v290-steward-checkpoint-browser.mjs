import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(process.env.HD_QA_ROOT||'.'),out=resolve(process.env.HD_QA_OUT||'qa/v290/steward-checkpoint');await mkdir(out,{recursive:true});
process.env.DEEPSEEK_API_KEY='';
const load=name=>import(pathToFileURL(join(root,name)));
const {chromium}=createRequire(join(root,'package.json'))('playwright-core');
const {browserLaunchOptions}=await load('tests/browserRuntime.mjs');
const {createLanHttpServer}=await load('server/lanServer.mjs');
const app=await readFile(join(root,'src/app.js'),'utf8'),marker='stewardChat=createStewardChat({';assert.equal(app.split(marker).length,2);
const section=app.slice(app.indexOf(marker)),from=section.indexOf('checkpoint:')+'checkpoint:'.length,to=section.indexOf(',recover:');assert(from>10&&to>from);
const checkpoint=section.slice(from,to);assert(checkpoint.startsWith('async()=>')&&checkpoint.includes('saves.checkpoint(t)'));
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'owned-server-')),port:0,enrollmentKey:'OWNED-QUEUE-PRESSURE'}),base='http://127.0.0.1:'+service.port;
const report={startedAt:new Date().toISOString(),sourceAppSha256:createHash('sha256').update(app).digest('hex'),scope:'Actual production steward component, actual checkpoint callback extracted unchanged from app.js, actual SaveClient/worker and isolated LAN save/backup authority. A continuous chain of real backups, each with declared 80ms server latency, keeps later queue demand alive. Fixture-only manual reply; no model calls, game clock/resources/outcomes or user data edited. This is a queue responsiveness regression, not a full-game or Mac acceptance claim.',cases:[],passed:false};
let browser;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,backendBackupsStarted:0,backendBackupsCommitted:0,externalRequests:0,passed:false};report.cases.push(row);
  const account=await service.identities.register({login:'pressure_'+theme,password:'fictional-queue-password',name:'虚构队列岛主',islandName:'队列验证岛',avatar:'female_1',theme});
  const tenant=await service.tenants.get(account.token);await service.tenants.open(account.token,theme,{});const canonical=(await tenant.saves.current(theme)).state;
  const backup=tenant.saves.backup.bind(tenant.saves);tenant.saves.backup=async(...args)=>{row.backendBackupsStarted++;await new Promise(r=>setTimeout(r,80));const result=await backup(...args);row.backendBackupsCommitted++;row.firstBackupCommittedAt??=Date.now();return result;};
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/owned-checkpoint',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="modalRoot"></div></body></html>'}));
  await context.route('**/api/hermes/command',async route=>{row.externalRequests++;row.lastRequestAt=Date.now();const saved=(await tenant.saves.current(theme)).state;row.chatDurableBeforeExternal=!!saved.stewardChat?.messages.some(m=>m.role==='user'&&m.text==='请确认这条手动消息。')&&!!saved.stewardChat?.messages.some(m=>m.role==='assistant'&&m.status==='pending'&&m.requestId);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'local',answer:'隔离夹具：这条手动消息已经寄出。',commands:[],plans:[],parties:[],operations:[]})});});
  await context.setExtraHTTPHeaders({'X-HD-Island':account.view.me.id});const page=await context.newPage();row.errors=[];page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(base+'/owned-checkpoint');
   await page.evaluate(async({theme,checkpoint,canonical})=>{
    const {createSaveClient}=await import('/src/saveClient.js'),{createStewardChat}=await import('/src/stewardChat.js');
    let state,binding;const saves=createSaveClient({loadLocal:()=>structuredClone(canonical),storeLocal(){},onRemoteState:(_,next)=>{state=next;binding?.replaceState(next);}});
    state=await saves.load(theme);
    binding=new Function('saves','initialState','theme','let state=initialState;const checkpoint='+checkpoint+';return {checkpoint,replaceState(next){state=next}};')(saves,state,theme);
    const pressure={active:false,started:0,completed:0,errors:[],tail:Promise.resolve()};
    function next(){if(!pressure.active)return;pressure.started++;pressure.tail=saves.backup(theme).then(()=>{pressure.completed++;if(pressure.active)next();},e=>{pressure.errors.push(e.message);pressure.active=false;});}
    window.ownedPressure={start(){pressure.active=true;next();},inspect:()=>({active:pressure.active,started:pressure.started,completed:pressure.completed,errors:pressure.errors}),async stop(){pressure.active=false;await pressure.tail;await saves.idle(theme);}};
    const openModal=(title,subtitle,body,footer)=>{document.getElementById('modalRoot').innerHTML='<section class="modal"><h1>'+title+'</h1><p>'+subtitle+'</p>'+body+'<footer class="modal-footer">'+footer+'</footer></section>';};
    window.ownedSteward=createStewardChat({state:()=>state,profile:()=>({name:'虚构管家'}),portrait:()=>'<div>虚构管家 · 组件检查</div>',openModal,persist:()=>saves.enqueue(theme,state),checkpoint:binding.checkpoint,request:async text=>{const response=await fetch('/api/hermes/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});return response.json();},edit(){},appearance(){},guide(){},health:()=>({hermes:'隔离夹具 · 不调用模型'}),projects(){},recruit(){},party(){},workbench(){},manageTask(){}});
    ownedSteward.open();
   },{theme,checkpoint,canonical});
   await page.evaluate(()=>ownedPressure.start());await page.waitForFunction(()=>ownedPressure.inspect().started>=1,null,{polling:50});
   await page.locator('#hermesInput').fill('请确认这条手动消息。');row.clickedAt=Date.now();await page.locator('#hermesSend').click();
   try{await page.waitForFunction(()=>document.querySelector('#stewardMessages')?.textContent.includes('隔离夹具：这条手动消息已经寄出。'),null,{polling:50,timeout:4000});}catch(error){row.observationError=error.message;}
   await page.waitForFunction(()=>ownedPressure.inspect().completed>=3||!ownedPressure.inspect().active,null,{polling:50,timeout:4000});row.beforeStopping=await page.evaluate(()=>({pressure:ownedPressure.inspect(),busy:ownedSteward.busy(),sendDisabled:document.querySelector('#hermesSend').disabled,reply:document.querySelector('#stewardMessages').textContent}));
   row.requestsWhilePressureActive=row.externalRequests;row.elapsedMs=Date.now()-row.clickedAt;
   assert(row.beforeStopping.pressure.active&&row.beforeStopping.pressure.completed>=2,'Actual subsequent backups must keep progressing while the manual request is observed');
   assert.equal(row.requestsWhilePressureActive,1,'The manual request must pass its point-in-time checkpoint without waiting for future backup traffic to cease');
   assert.equal(row.chatDurableBeforeExternal,true,'The actual canonical save must contain both the user message and its pending request before external work');assert(row.firstBackupCommittedAt<=row.lastRequestAt,'The earlier real backup must finish before the manual request');assert.equal(row.beforeStopping.busy,false);assert.equal(row.beforeStopping.sendDisabled,false);assert.deepEqual(row.beforeStopping.pressure.errors,[]);assert.deepEqual(row.errors,[]);
   row.passed=true;
  }catch(error){row.failure=error.stack;}
  finally{await page.evaluate(()=>ownedPressure?.stop()).catch(e=>row.cleanupError=e.message);row.externalRequestsAfterDrain=row.externalRequests;await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.length===2&&report.cases.every(c=>c.passed);if(!report.passed)process.exitCode=1;
}finally{await browser?.close();await service.close();report.finishedAt=new Date().toISOString();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,requestsWhilePressureActive,elapsedMs,failure,beforeStopping})=>({theme,passed,requestsWhilePressureActive,elapsedMs,failure,pressure:beforeStopping?.pressure}))}));}
