import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {RAW_MATERIALS} from '../src/contentCatalog.js';
import {environmentAt} from '../src/environmentClock.js';
import {residentSchedule} from '../src/residentSchedule.js';
import {createWorkTimeBudget} from './workTimeBudget.mjs';
import {installVisibleSlowFrames} from './visibleSlowFrames.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v213/native-task-chains');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(out,'fictional-lan-'));
const service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-TASK-CHAIN'}),base='http://127.0.0.1:'+service.port;
const clockFile=join(directory,'environment/environment-clock.json'),clock=JSON.parse(await readFile(clockFile,'utf8'));assert.equal(clock.rate,1);assert.equal(clock.dayLengthMs,900000);
const report={scope:'Native manual-chat queue registration, actual NPC movement/tool actions and authoritative task receipts, mid-chain reload and empty-browser reopen. Fictional accounts, zero initial materials, needs fixture, deterministic model reply; providers blocked, no accelerated clock, no user browser/data. Original first-job120seconds and shared remaining-chain240seconds count fixed working hours; calendar waiting is separate and bounded by two visual days. Not real model decision or human acceptance.',cases:[],slowVisibleFrames:process.env.HD_QA_SLOW_RENDER==='1',passed:false};let browser;
async function frameSnapshot(page,label){return page.evaluate(label=>{const p=window.nativeTaskFrames;if(!p)return null;const seconds=(performance.now()-p.started)/1000;return{label,seconds,frames:p.frames,fps:p.frames/seconds,maxGap:p.maxGap,visible:!document.hidden,policy:window.nativeTaskFramePolicy||null};},label);}
try{
 browser=await chromium.launch(browserLaunchOptions());
 const results=await Promise.allSettled(['pixel','origami'].map(async theme=>{
  const caseStarted=Date.now(),row={theme,errors:[],workingBudgets:[],saveErrors:[],documents:[],progressSamples:[],passed:false};report.cases.push(row);
  const firstBudget=createWorkTimeBudget(120000,'First job'),remainingBudget=createWorkTimeBudget(240000,'Remaining chain');
  const account=await service.identities.register({login:'chain_'+theme,password:'fictional-chain-password',name:'顺序分工岛主',islandName:'队列验证岛',avatar:'female_1',theme});
  const tenant=await service.tenants.get(account.token);await service.tenants.open(account.token,theme,{});
  const original=await tenant.saves.current(theme),state=structuredClone(original.state);for(let i=0;i<16;i++)state.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};await tenant.saves.save(theme,{state,expectedVersion:original.version});
  const shell=RAW_MATERIALS.find(i=>i.source==='shore').id;
  const commands=[{id:'first',npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'先到林地收两份木材'},
   {id:'second',npcId:5,goal:'dock',resource:shell,quantity:1,intent:'再到海边拾取材料',dependsOn:['first']},
   {id:'third',npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'最后回林地补两份木材',dependsOn:['second']}];
  const open=async()=>{
   const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   if(report.slowVisibleFrames)await context.addInitScript(installVisibleSlowFrames);
   await context.addInitScript(()=>{const probe={started:performance.now(),last:null,frames:0,maxGap:0};window.nativeTaskFrames=probe;const frame=at=>{if(probe.last!==null){probe.frames++;probe.maxGap=Math.max(probe.maxGap,at-probe.last);}probe.last=at;requestAnimationFrame(frame);};requestAnimationFrame(frame);});
   await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;
    if(path==='/api/hermes/command')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'hermes',model:'deepseek-flash',answer:'已提出三步顺序分工，等实际动作完成后记录。',runId:'fictional-chain-'+theme,commands,plans:[],parties:[],operations:[]})});
    if(/^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick')return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Isolated queue validation: providers disabled"}'});return r.continue();});
   const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/saves/')&&r.status()>=400)void r.json().then(d=>row.saveErrors.push({status:r.status(),code:d.code,path:new URL(r.url()).pathname})).catch(()=>{});});await page.goto(base+'/play?qa=1');
   await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!islandInspect().startup.busy&&!document.querySelector('#islandBootNotice'),null,{timeout:60000});return{context,page};
  };
  let {context,page}=await open();
  async function waitForTask(id,budget){
   const initialUsed=budget.usedMs;let previous=Date.now(),lastPeriod=null,lastSample=0;
   while(true){
    const now=Date.now(),environment=environmentAt(clock,now),schedule=residentSchedule(5,environment),task=await page.evaluate(id=>islandInspect().agentTaskLedger.find(t=>t.id===id),id);
    budget.charge(now-previous,schedule.working);previous=now;
    assert(now-caseStarted<1800000,'Two visual days elapsed without completing the original queue');
    if(now-lastSample>=5000){lastSample=now;row.progressSamples.push(await page.evaluate(({id,workingMs})=>{const n=islandInspect().npcs[5],t=n.intent?.serverResidentTicket;return {id,workingMs,x:n.x,y:n.y,path:n.path,action:n.action,leaseWallSeconds:t?(Date.now()-t.startedAt)/1000:null,saveStatus:document.querySelector('#saveStatus')?.dataset.status};},{id,workingMs:budget.usedMs}));}
    if(task?.status==='done'){row.workingBudgets.push({id,workingMs:budget.usedMs-initialUsed,sharedUsedMs:budget.usedMs,limitMs:budget.limitMs,calendarMs:now-caseStarted});return;}
    if(schedule.period!==lastPeriod){lastPeriod=schedule.period;row.waiting={id,clock:environment.clockText,period:schedule.period,workingMs:budget.usedMs-initialUsed,sharedUsedMs:budget.usedMs};console.log(JSON.stringify({theme,...row.waiting}));}
    await page.waitForTimeout(500);
   }
  }

  try{
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   await page.locator('#stewardBtn').click();await page.locator('#hermesInput').fill('请让同一位居民先收木材，再去海边，最后回林地；按顺序完成。');await page.locator('#hermesSend').click();
   await page.waitForFunction(()=>islandInspect().agentTaskLedger.filter(t=>['first','second','third'].includes(t.id)).length===3,null,{timeout:30000});
   await page.waitForFunction(()=>islandInspect().chat.messages.some(m=>m.status==='done'&&m.text.includes('三步顺序分工')));assert.equal(await page.locator('#stewardTasks .steward-task-dependency').count(),2);await page.screenshot({path:join(out,theme+'-queued.png')});await page.locator('#closeModal').click();
   const initial=await page.evaluate(()=>({x:islandInspect().npcs[5].x,y:islandInspect().npcs[5].y}));
   await waitForTask('first',firstBudget);
   const beforeReload=(await tenant.saves.current(theme)).state.agentTaskLedger.filter(t=>['first','second','third'].includes(t.id));assert.notEqual(beforeReload[2].status,'done');row.partialProgressBeforeReload=beforeReload.map(t=>({id:t.id,status:t.status,completed:t.completed}));
   row.documents.push(await frameSnapshot(page,'before-mid-chain-reload'));
   await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!islandInspect().startup.busy,null,{timeout:60000});
   await waitForTask('second',remainingBudget);await waitForTask('third',remainingBudget);
   assert(firstBudget.usedMs<=120000);assert(remainingBudget.usedMs<=240000);
   const final=await tenant.saves.current(theme),tasks=commands.map(c=>final.state.agentTaskLedger.find(t=>t.id===c.id));assert(tasks.every((t,i)=>t.status==='done'&&t.completed===commands[i].quantity&&t.evidence.length===1));
   const receipts=final.actions.receipts.filter(r=>r.outcome==='finished'&&commands.some(c=>c.id===r.ticket.assignmentId));assert.equal(receipts.length,3);assert.deepEqual(receipts.map(r=>r.ticket.assignmentId),['first','second','third']);
   const position=await page.evaluate(()=>({x:islandInspect().npcs[5].x,y:islandInspect().npcs[5].y}));assert(receipts.some(r=>r.ticket.intent.goal==='dock'));row.realTaskReceipts=receipts.map(r=>({assignmentId:r.ticket.assignmentId,requestId:r.ticket.requestId,gain:r.gain}));row.initial=initial;row.finalPosition=position;
   row.documents.push(await frameSnapshot(page,'before-empty-browser-reopen'));
   await context.close();({context,page}=await open());const reopened=await page.evaluate(()=>islandInspect().agentTaskLedger);assert(commands.every(c=>reopened.find(t=>t.id===c.id)?.completed===c.quantity));await page.locator('#stewardBtn').click();await page.screenshot({path:join(out,theme+'-completed-reopened.png')});assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(e){row.failure=e.stack;row.diagnostic=await page.evaluate(()=>({startup:window.islandInspect?.().startup,visibility:document.visibilityState,saveStatus:document.querySelector('#saveStatus')?.dataset.status,tasks:window.islandInspect?.().agentTaskLedger,npc:window.islandInspect?.().npcs[5]})).catch(()=>null);await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});throw e;}
  finally{row.budgets={first:{usedMs:firstBudget.usedMs,limitMs:firstBudget.limitMs},remaining:{usedMs:remainingBudget.usedMs,limitMs:remainingBudget.limitMs}};row.nativeFrames=await page.evaluate(()=>{const p=window.nativeTaskFrames;if(!p)return null;const seconds=(performance.now()-p.started)/1000;return{seconds,frames:p.frames,fps:p.frames/seconds,maxGap:p.maxGap,visible:!document.hidden};}).catch(()=>null);await context.close();}
 }));const failures=results.filter(r=>r.status==='rejected');if(failures.length)throw failures[0].reason;report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser?.close();await service.close();report.clockUnchanged=JSON.stringify(JSON.parse(await readFile(clockFile,'utf8')))===JSON.stringify(clock);if(!report.clockUnchanged){report.passed=false;report.failure='The fixture clock was changed during execution';process.exitCode=1;}await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
