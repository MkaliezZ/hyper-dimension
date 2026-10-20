import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {rasterTransform} from '../src/rasterQuality.js';
import {worldWalkable,setWorldTheme,HOTSPOTS} from '../src/world.js';

const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.env.HD_QA_OUT||'qa/v203/native-scene-return');
await mkdir(out,{recursive:true});
const report={scope:'Actual isolated server and native scene-return flow with current controller source. An official20second NPC mine lease deterministically occupies a vein. A QA bridge calls the actual player controller after canonical refresh to exercise the real409 rejection without a stale-version failure. The lease is then officially cancelled; original native pointer mining/reward,forest gathering,hoeing,return points and reload assertions/budgets remain. No completed work,clock,resources,rewards,models,user browser or human acceptance injected.',cases:[],passed:false};
const portFor=async()=>{const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;};
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami']){
  const row={theme,stage:'setup',errors:[],badAssets:[]};report.cases.push(row);
  const directory=await mkdtemp(path.join(out,theme+'-')),store=createSaveStore({directory:path.join(directory,'saves')}),state=hydrateTown(createZeroState());
  state.freshStartPending=false;state.player={x:500,y:240};await store.open(theme,{legacyState:state,protect:true});
  const port=await portFor(),base='http://127.0.0.1:'+port;
  const server=spawn(process.execPath,[path.join(root,'server.mjs'),'--theme='+theme,'--port='+port],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(directory,'saves'),HD_RUN_LEDGER_DIR:path.join(directory,'runs'),HD_ENVIRONMENT_DIR:path.join(directory,'environment')}});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await context.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return p.startsWith('/api/npc/')||p.startsWith('/api/hermes/')||p.endsWith('/suggest')?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled for scene navigation regression"}'}):r.continue();});
  page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(new URL(r.url()).pathname);});
  // Owned bridge invokes the real controller for the declared occupied-vein case; all work remains authoritative.
  await context.route('**/src/app.js',async route=>{const response=await route.fetch();const source=await response.text();await route.fulfill({response,body:source+'\nwindow.__mineRejectBridge={begin:input=>serverField.begin(input),refresh:()=>saves.refresh(theme),inspect:()=>({controller:serverField.inspect(),pending:saves.pendingAction(theme),saveStatus:saves.status(theme).status,worldInert:document.querySelector(\"#game\").inert})};\nwindow.__sceneReturnObservation=()=>{const s=saves.status(theme);return {scene,at:performance.now(),hidden:document.hidden,frameLoop:frameLoop.inspect(),recoveryBoot,changingTheme,blocked:saves.blocked(theme),save:{status:s.status,capturing:!!s.capturing,reconciling:!!s.reconciling,commandSending:!!s.commandSending},player:{x:actor.x,y:actor.y,path:actor.path.length,action:actor.action?{type:actor.action.type,t:actor.action.t,duration:actor.action.duration,awaitingReceipt:!!actor.action.awaitingReceipt,acceptedLease:actor.action.acceptedLease||null}:null},gather:{busy:serverGather.busy(),settling:serverGather.settling()},resident:serverResident.inspect(),active:s.actions?.active?{kind:s.actions.active.kind||"gather",requestId:s.actions.active.requestId}:null};};'});});
  const inspect=()=>page.evaluate(()=>window.islandInspect());
  const ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!window.islandInspect().startup.busy&&!document.getElementById('islandBootNotice'),null,{timeout:60000});
  const close=async()=>{if(await page.locator('#closeModal').isVisible())await page.locator('#closeModal').click();};
  async function clickScene(p){const s=await inspect(),b=await page.locator('#game').boundingBox(),t=rasterTransform(s.camera.width,s.camera.height,1000,660,s.zoom,s.camera,...s.rendering.density);await page.mouse.click(b.x+t.ox+p.x*t.scale,b.y+t.oy+p.y*t.scale);}
  async function gather(id){await close();const old=(await inspect()).journey.stats.gathered[id]||0;await page.locator('#gatherBtn').click();await page.locator('[data-gather="'+id+'"]').click();await page.waitForFunction(({id,old})=>(window.islandInspect().journey.stats.gathered[id]||0)>old&&!window.islandInspect().actor.action,{id,old},{timeout:60000});assert.equal((await inspect()).scene,'world');}
  try{
   for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
   await page.goto(base+'/?qa=1');await ready();setWorldTheme(theme);const start=(await inspect()).actor;assert(worldWalkable(start.x,start.y));row.recoveredStart={x:start.x,y:start.y};
   row.stage='mine';await page.locator('#gatherBtn').click();await page.locator('[data-source="mine"]').click();await page.locator('[data-gather="ore"]').click();await page.waitForFunction(()=>window.islandInspect().scene==='mine');
   row.stage='official-occupied-mine';
   let occupied;
   for(let attempt=0;attempt<20;attempt++){
    const response=await context.request.get(base+'/api/saves/'+theme);assert(response.ok());const document=(await response.json()).document;
    const leases=Object.values(document.actions.field?.leases||{}),used=new Set(leases.map(t=>t.actorId));const actorId=Array.from({length:16},(_,i)=>15-i).find(i=>!used.has(i));
    const index=document.state.oreNodes.findIndex((n,i)=>n.hp>0&&!leases.some(t=>t.index===i));assert(index>=0&&actorId!==undefined);
    const input={kind:'field',operation:'begin',field:'mine',actor:'npc',actorId,index,itemId:'ore',requestId:crypto.randomUUID(),expectedVersion:document.version,expectedSequence:document.actions.sequence,epoch:document.actions.epoch};
    const r=await context.request.post(base+'/api/saves/'+theme+'/action',{data:input}),body=await r.json();row.occupancyAttempts??=[];row.occupancyAttempts.push({status:r.status(),code:body.code||null,requestId:input.requestId});
    if(r.ok()){assert.equal(body.ticket.duration,20);occupied=body.ticket;break;}
    assert([409,503].includes(r.status())&&['save_conflict','action_sequence','save_busy','save_unavailable'].includes(body.code),JSON.stringify(body));
   }
   assert(occupied);await page.evaluate(()=>window.__mineRejectBridge.refresh());const beforeRejection=await store.current(theme),personalOre=beforeRejection.state.journey.stats.gathered.ore||0;
   const rejectedReply=page.waitForResponse(r=>{try{const b=r.request().postDataJSON();return new URL(r.url()).pathname==='/api/saves/'+theme+'/action'&&b.kind==='field'&&b.operation==='begin'&&b.actor==='player';}catch{return false;}},{timeout:30000});
   await page.evaluate(index=>window.__mineRejectBridge.begin({field:'mine',index,itemId:'ore'}),occupied.index);
   const actualRejectedReply=await rejectedReply,actualRejectedBody=await actualRejectedReply.json();assert.equal(actualRejectedReply.status(),409);assert.equal(actualRejectedBody.code,'field_occupied');
   const rejected=await page.evaluate(()=>window.__mineRejectBridge.inspect()),afterRejection=await store.current(theme);
   assert.equal(rejected.pending,null);assert.equal(rejected.controller.ticket,null);assert.equal(rejected.controller.active,false);assert.equal(rejected.worldInert,false);assert.equal(afterRejection.state.journey.stats.gathered.ore||0,personalOre);
   assert.equal(afterRejection.actions.field.leases[occupied.requestId].requestId,occupied.requestId);assert.equal(afterRejection.actions.active,null);
   row.confirmedRejectedBegin={httpStatus:409,code:actualRejectedBody.code,noTicket:true,noPending:true,selectionUnlocked:true};
   let cancelledBody;
   for(let attempt=0;attempt<20;attempt++){
    const latest=await context.request.get(base+'/api/saves/'+theme);assert(latest.ok());const document=(await latest.json()).document;
    const response=await context.request.post(base+'/api/saves/'+theme+'/action',{data:{kind:'field',operation:'cancel',requestId:occupied.requestId,epoch:occupied.epoch,sequence:occupied.sequence,expectedVersion:document.version}}),body=await response.json();
    row.cancelAttempts??=[];row.cancelAttempts.push({status:response.status(),code:body.code||null,requestId:occupied.requestId});
    if(response.ok()){cancelledBody=body;break;}assert([409,503].includes(response.status())&&['save_conflict','save_busy','save_unavailable'].includes(body.code),JSON.stringify(body));
   }
   assert(cancelledBody);assert.equal(cancelledBody.receipt.outcome,'cancelled');await page.evaluate(()=>window.__mineRejectBridge.refresh());
   row.realRejectedBegin={requestId:occupied.requestId,index:occupied.index,actorId:occupied.actorId,unchangedPlayerOre:true,noPlayerTicket:true,noPendingEnvelope:true,selectionUnlocked:true,npcLeasePreservedUntilOfficialCancel:true};row.stage='mine';
   const old=(await inspect()).journey.stats.gathered.ore||0;
   for(let tries=0;((await inspect()).journey.stats.gathered.ore||0)<=old;tries++){
    assert(tries<12,'targeted mining must finish');const s=await inspect(),index=s.oreNodes.findIndex((n,i)=>n.hp>0&&!s.serverFieldNpc.jobs.some(j=>j.index===i));assert(index>=0);
    let observeRejected;const rejection=new Promise(resolve=>observeRejected=resolve);
    const rejectedResponse=async response=>{try{const input=response.request().postDataJSON();if(response.status()===409&&new URL(response.url()).pathname==='/api/saves/'+theme+'/action'&&input.kind==='field'&&input.operation==='begin'&&input.actor==='player'&&input.index===index){const body=await response.json();if(body.code==='field_occupied')observeRejected({requestId:input.requestId,index,code:body.code});}}catch{}};
    page.on('response',rejectedResponse);let outcome;
    try{await clickScene(s.mineRocks[index]);outcome=await Promise.race([page.locator('#mineStrike').waitFor({timeout:12000}).then(()=>null),rejection]);}
    catch(e){const next=await inspect();if(next.serverFieldNpc.jobs.some(j=>j.index===index)&&!next.serverField.active)continue;throw e;}
    finally{page.off('response',rejectedResponse);}
    if(outcome){await page.waitForFunction(()=>{const x=window.__mineRejectBridge.inspect();return!x.controller.active&&!x.pending&&!x.worldInert;},null,{timeout:12000});(row.legitimateRetargets??=[]).push(outcome);continue;}
    await page.waitForFunction(()=>{const g=window.islandInspect().roomGame;return g?.engine==='mine'&&Math.abs(g.value-.5)<.025;},null,{timeout:12000});await page.locator('#mineStrike').click();await page.waitForFunction(()=>!window.islandInspect().serverField.active&&!window.islandInspect().actor.action,null,{timeout:30000});
   }
   const mined=await store.current(theme);assert.deepEqual(mined.state.player,row.recoveredStart,'mining checkpoints must preserve the outdoor return point');row.mineSavedPlayer=mined.state.player;
   row.stage='mine-to-forest';await gather('wax');row.wax=(await inspect()).journey.stats.gathered.wax;const outside=await store.current(theme);row.farmReturnPoint=outside.state.player;
   row.stage='farm';await page.locator('[data-go="farm"]').click();await page.waitForFunction(()=>window.islandInspect().scene==='farm');const s=await inspect(),plot=s.farmPlots[0],p=plot.corners.reduce((a,c)=>({x:a.x+c.x/4,y:a.y+c.y/4}),{x:0,y:0});await clickScene(p);await page.waitForFunction(()=>window.islandInspect().plots[0].stage===1&&!window.islandInspect().actor.action,null,{timeout:30000});
   const hoed=await store.current(theme),farm=HOTSPOTS.find(h=>h.type==='farm');assert(worldWalkable(hoed.state.player.x,hoed.state.player.y),'farm checkpoints must preserve a walkable outdoor point');assert(Math.hypot(hoed.state.player.x-farm.entry.x,hoed.state.player.y-farm.entry.y)<35,'the farm shortcut walks to the actual outdoor entrance before entering');row.farmSavedPlayer=hoed.state.player;
   row.stage='farm-to-forest';await gather('fiber');row.fiber=(await inspect()).journey.stats.gathered.fiber;
   row.stage='refresh';await page.reload();await ready();const after=(await inspect()).actor;assert(worldWalkable(after.x,after.y));await gather('wood');
   await page.screenshot({path:path.join(out,theme+'-returned.png')});assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;
  }catch(e){row.failure=e.stack;let observationTimer;row.last=await Promise.race([page.evaluate(()=>window.__sceneReturnObservation?.()).catch(()=>null),new Promise(resolve=>{observationTimer=setTimeout(()=>resolve({observationTimedOut:true}),2000);})]).finally(()=>clearTimeout(observationTimer));await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});throw e;}
  finally{await context.close();server.kill();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,stage:c.stage,passed:c.passed,failure:c.failure}))}));}
