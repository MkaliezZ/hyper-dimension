import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {HOTSPOTS} from '../src/world.js';

const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.env.HD_QA_OUT||'qa/v281/native-player-action');
await mkdir(out,{recursive:true});
const observerDelayMs=Number(process.env.HD_QA_ACTION_OBSERVER_DELAY_MS||0);assert([0,3000].includes(observerDelayMs),'Only the declared3second observer-latency fixture is supported');
const report={observerDelayMs,scope:'Owned native game in both styles. A fictional fresh island starts at the forest entrance; NPC decisions are suspended. Actual gather and unrelated resident leases use the real server. One accepted resident response is withheld below its original network timeout; no animation time, completed action, inventory or receipt is injected. Provider calls and user data are excluded. Not physical Mac, full-day scheduling or human acceptance.',cases:[],passed:false};
const portFor=async()=>{const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;};
let browser;
async function run(theme){
 const row={theme,errors:[],requests:[],timings:[],network:[]};report.cases.push(row);
 const directory=await mkdtemp(path.join(out,theme+'-')),saveDir=path.join(directory,'saves'),store=createSaveStore({directory:saveDir}),state=hydrateTown(createZeroState());
 state.freshStartPending=false;state.player={...HOTSPOTS.find(h=>h.type==='forest').entry};await store.open(theme,{legacyState:state,protect:true});
 const port=await portFor(),base='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'server.mjs'),'--theme='+theme,'--port='+port],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:saveDir,HD_RUN_LEDGER_DIR:path.join(directory,'runs'),HD_ENVIRONMENT_DIR:path.join(directory,'environment')}});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 let release,held=false;const gate=new Promise(r=>release=r);
 try{
  page.on('pageerror',e=>row.errors.push(e.message));
  const mark=phase=>row.timings.push({phase,at:Date.now()});
  context.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/saves/'))row.network.push({phase:'request',at:Date.now(),method:request.method(),path:url.pathname});});
  context.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/api/saves/'))row.network.push({phase:'response',at:Date.now(),status:response.status(),path:url.pathname});});
  context.on('requestfailed',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/saves/'))row.network.push({phase:'failed',at:Date.now(),path:url.pathname,error:request.failure()?.errorText});});

  await context.route('**/api/npc/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated model-free test"}'}));
  await context.route('**/api/hermes/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated model-free test"}'}));
  await context.route('**/api/saves/**/action',async route=>{
   const input=route.request().postDataJSON();row.requests.push({kind:input.kind||'gather',operation:input.operation,requestId:input.requestId});
   if(input.kind==='resident'&&input.operation==='begin'&&input.intent?.operationId?.startsWith('qa-v281-player-')){
    const response=await route.fetch();assert.equal(response.status(),200);held=true;await gate;return route.fulfill({response});
   }
   return route.continue();
  });
  await context.route('**/src/app.js',async route=>{
   const response=await route.fetch();let source=await response.text();
   source+=`
window.__playerActionQA={
 async prepare(){for(const n of npcs){runtime.releaseActor(n);n.manualUntil=1e9;}await saves.idle(theme);this.armed=true;},
 async hold(){this.foreign=await serverResident.begin({npcId:15},{goal:"plaza",action:"rest",source:"local",operationId:"qa-v281-player-"+crypto.randomUUID()});},
 async clear(){if(this.foreign)await serverResident.cancel(this.foreign);},
 inspect(){const r=saves.status(theme);return {save:{status:r.status,dirty:r.dirty,capturing:!!r.capturing,reconciling:!!r.reconciling,commandSending:!!r.commandSending,inflight:!!r.inflight,generation:r.generation,cacheError:!!r.cacheError},action:actor.action?{type:actor.action.type,t:actor.action.t,duration:actor.action.duration,acceptedLease:actor.action.acceptedLease}:null,gatherSettling:serverGather.settling(),resident:serverResident.inspect(),pending:saves.pendingAction(theme)?.body?.kind||null,holdError:this.holdError||null,active:saves.status(theme).actions?.active?.requestId||null,wax:state.inventory.wax||0};}
};
// Queue the real unrelated command in the same turn as the actual granted
// animation. External browser-observer round trips must not create the overlap.
const nativeStartAction=startAction;
startAction=(...args)=>{const result=nativeStartAction(...args),q=window.__playerActionQA,ticket=args[5];
 if(q.armed&&ticket&&actor.action?.acceptedLease?.requestId===ticket.requestId&&(ticket.kind||"gather")==="gather"){
  q.armed=false;q.initial=q.inspect();q.hold().catch(error=>q.holdError=error.message);
 }
 return result;
};`;
   await route.fulfill({response,body:source});
  });
  for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  await page.goto(base+'/?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverCommerce.ready&&!window.islandInspect().startup.busy,null,{timeout:60000});
  if(await page.locator('#closeModal').isVisible())await page.locator('#closeModal').click();
  mark('prepare-start');await page.evaluate(()=>window.__playerActionQA.prepare());mark('prepare-complete');const actionSetupDeadline=Date.now()+15000;mark('gather-button-start');await page.locator('#gatherBtn').click();mark('gather-button-complete');await page.locator('[data-gather="wax"]').click();mark('item-click-complete');
  await page.waitForFunction(()=>!!window.__playerActionQA.initial,null,{timeout:Math.max(1,actionSetupDeadline-Date.now())});
  if(observerDelayMs)await page.waitForTimeout(observerDelayMs);
  mark('grant-observed');const initial=await page.evaluate(()=>window.__playerActionQA.initial);assert.equal(initial.wax,0);assert(initial.active);assert.equal(initial.action.acceptedLease.requestId,initial.active);row.lease=initial.active;
  row.realForeignCommandQueuedAtGrantedAnimation=true;
  // Keep the original setup, network and completion budgets. Only the real
  // fixture command's trigger moves from observer latency to the grant event.
  while(!held&&Date.now()<actionSetupDeadline)await page.waitForTimeout(40);assert(held,'the real unrelated response must be withheld');
  await page.waitForFunction(()=>{const q=window.__playerActionQA.inspect();return q.action===null&&q.gatherSettling&&q.resident.inflight>0;},null,{timeout:5000});
  const waiting=await page.evaluate(()=>window.__playerActionQA.inspect()),before=await store.current(theme);
  assert.equal(waiting.wax,0);assert.equal(before.state.inventory.wax,0);assert.equal(before.actions.active.requestId,initial.active);assert.equal(before.actions.receipts.filter(r=>r.ticket.requestId===initial.active).length,0);
  mark('pose-finished');row.poseFinishedBeforeForeignReceipt=true;row.inventoryAndReceiptWaitForAuthority=true;
  release();await page.waitForFunction(()=>window.__playerActionQA.inspect().wax===2&&!window.islandInspect().actor.action,null,{timeout:30000});
  await page.evaluate(()=>window.__playerActionQA.clear());const after=await store.current(theme),receipts=after.actions.receipts.filter(r=>r.ticket.requestId===initial.active);
  assert.equal(receipts.length,1);assert.equal(receipts[0].outcome,'finished');assert.equal(row.requests.filter(r=>r.kind==='gather'&&r.operation==='finish'&&r.requestId===initial.active).length,1);
  mark('authority-finish-confirmed');row.exactlyOneFinish=true;await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverCommerce.ready&&!window.islandInspect().startup.busy,null,{timeout:60000});assert.equal(await page.evaluate(()=>window.islandInspect().inventory.wax),2);row.reloadUnique=true;
  assert.deepEqual(row.errors,[]);await page.screenshot({path:path.join(out,theme+'-confirmed.png')});row.passed=true;
 }catch(error){row.failure=error.stack;row.last=await page.evaluate(()=>window.__playerActionQA?.inspect()).catch(()=>null);await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});throw error;}
 finally{release();await context.close();if(server.exitCode===null){const ended=new Promise(r=>server.once('close',r));server.kill();await ended;}await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
}
try{browser=await chromium.launch(browserLaunchOptions());for(const theme of ['pixel','origami'])await run(theme);report.passed=true;}
catch(error){report.failure=error.stack;process.exitCode=1;}
finally{await browser?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
