import {readBrowserSaveJournal} from './save-journal-browser-helper.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,RECIPES} from '../src/townSimulation.js';
const root=resolve(process.env.HD_QA_APP_ROOT||join(import.meta.dirname,'..')),out=resolve(process.env.HD_QA_OUT||'qa/v328/native-persisted-completion');await mkdir(out,{recursive:true});
const report={scope:'Owned persisted reload diagnostic: real IndexedDB pending command after two lost finished responses and failed canonical GET,then reload in the same context after authority returns. Same actual request bytes and receipt,one reward,unblocked state required. Tools/stock/clock are declared controlled fixtures,not natural gameplay. Current reviewed runtime source is not modified by this fixture. Owned native SaveClient Worker, actual visitor/NPC resident/NPC mining controllers, real HTTP SaveStore and disk. Declared clock prepares already-ready work and synthetic owned tools/stock/100coins. Both completion replies are actually withheld until the original12000ms aborts; one read-only canonical GET may recover only the existing finished receipt. Missing/cancelled/read-failed cases remain blocked. No new mutation identity,extra reward,model,user browser,real documents,natural-clock gameplay or human/physical-device acceptance.',cases:[],passed:false,wholeGoalComplete:false};
let browser;
async function scenario(theme,kind,mode){
 const row={theme,kind,mode,requests:[],reads:[],errors:[],passed:false};report.cases.push(row);const directory=await mkdtemp(join(out,theme+'-'+kind+'-'+mode+'-'));let time=100000,faultsActive=true;
 const store=createSaveStore({directory,now:()=>time}),seed=hydrateTown(createZeroState());seed.saveSlot='hyper-dimension-'+theme+'-v3';seed.freshStartPending=false;seed.inventory.axe=1;seed.inventory.pickaxe=1;if(kind==='visitor'){seed.coins=100;for(const recipe of Object.values(RECIPES))seed.inventory[recipe.item]=4;}
 await store.open(theme,{legacyState:seed,protect:true});
 const command=async body=>{const doc=await store.current(theme);return store.action(theme,{requestId:randomUUID(),expectedVersion:doc.version,...(body.operation==='begin'?{epoch:doc.actions.epoch,expectedSequence:doc.actions.sequence}:{}),...body});};
 let ticket;if(kind==='visitor'){
  await command({kind,operation:'enable',theme});for(const seconds of [15,5]){const doc=await store.current(theme);time+=seconds*1000;await store.save(theme,{state:doc.state,expectedVersion:doc.version,activeSeconds:seconds,saveId:randomUUID()});}
  const arrived=await command({kind,operation:'arrive'}),guest=arrived.receipt.accepted[0];assert(guest);time=Math.max(time,guest.landReadyAt);await command({kind,operation:'land',guestId:guest.id});ticket=(await command({kind,operation:'begin',guestId:guest.id,stop:0,buildingId:guest.itinerary[0]})).ticket;assert(ticket.quote.item&&ticket.quote.net>0);
 }else if(kind==='resident')ticket=(await command({kind,operation:'begin',actorId:5,intent:{goal:'forest',action:'work',resource:'wood',source:'rule'}})).ticket;
 else ticket=(await command({kind,operation:'begin',field:'mine',actor:'npc',actorId:5,index:0,itemId:'ore'})).ticket;
 time=ticket.readyAt;const before=await store.current(theme),bodies=[],held=new Set();
 const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://owned').pathname;
  if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><main id="game"><button id="continue">继续游玩</button></main>');}
  if(path.startsWith('/api/saves/')){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);const text=Buffer.concat(chunks).toString(),body=text?JSON.parse(text):{},operation=path.split('/')[4]||'';
   if(req.method==='GET'){row.reads.push({at:Date.now(),path});if(faultsActive&&mode==='get-failed'){res.writeHead(503,{'Content-Type':'application/json'});return res.end('{"error":"Owned authority read unavailable","code":"save_unavailable"}');}}
   if(operation==='action'&&body.operation==='finish'&&body.requestId===ticket.requestId){
    bodies.push(text);let result;if(mode!=='uncommitted')result=await store.action(theme,body);
    row.requests.push({at:Date.now(),requestId:body.requestId,replayed:!!result?.replayed,committed:!!result,receiptOutcome:result?.receipt?.outcome});
    if(faultsActive&&bodies.length<=2){held.add(res);res.once('close',()=>held.delete(res));return;}
    assert(!faultsActive,'No third mutation request may be sent automatically');res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
   }
   const result=operation==='open'?await store.open(theme,body):operation==='save'?await store.save(theme,body):{document:await store.current(theme)};res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
  }
  const file=resolve(root,'.'+path);assert(path.startsWith('/src/')&&file.startsWith(root+sep));res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
 }catch(error){res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
 try{
  await page.goto(base);await page.evaluate(async({theme,kind,ticket})=>{
   const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js');const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Native Worker journal required');}});await saves.load(theme);const factory=kind==='visitor'?(await import('/src/serverVisitorUI.js')).createServerVisitor:kind==='resident'?(await import('/src/serverResidentUI.js')).createServerResident:(await import('/src/serverFieldNpcUI.js')).createServerFieldNpc;
   const controller=factory({saves,theme:()=>theme,persist(){},applyState(){},restore(){},toast(){}});window.nativeCompletion={saves,controller,theme,ticket,clicks:0};document.querySelector('#continue').onclick=()=>nativeCompletion.clicks++;
  },{theme,kind,ticket});
  if(mode==='cancelled')await command({kind,operation:'cancel',requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence});
  row.startedAt=Date.now();row.result=await page.evaluate(async()=>{
   const f=nativeCompletion;let result,error;try{result=await f.controller.finish(f.ticket);}catch(e){error={code:e.code,message:e.message};}
   return{replayed:!!result?.replayed,recoveredReceipt:!!result?.recoveredReceipt,error,pending:f.saves.pendingAction(f.theme)?.body||null,status:f.saves.status(f.theme).status,locked:f.controller.inspect().locked,worldInert:document.querySelector('#game').inert,coins:f.saves.status(f.theme).state.coins,inventory:f.saves.status(f.theme).state.inventory};
  });row.finishedAt=Date.now();
  assert.equal(row.requests.length,2);assert.equal(new Set(bodies).size,1);assert(row.requests[1].at-row.requests[0].at>=11500,'Original12second fetch deadline must actually expire');assert(row.finishedAt-row.startedAt>=23500,'Both original fetch attempts must expire');assert.equal(row.reads.length,1);
  const current=await store.current(theme),receipts=current.actions.receipts.filter(r=>r.ticket.requestId===ticket.requestId);
  if(mode==='finished'){
   assert.equal(row.result.error,undefined);assert(row.result.replayed&&row.result.recoveredReceipt);assert.equal(row.result.pending,null);assert.equal(row.result.locked,false);assert.equal(row.result.worldInert,false);assert.equal(receipts.length,1);assert.equal(receipts[0].outcome,'finished');assert.equal(current.actions[kind].leases[ticket.requestId],undefined);assert.equal(current.state.resourceLedger.reservations[ticket.owner],undefined);assert.equal(row.result.coins,current.state.coins);assert.deepEqual(row.result.inventory,current.state.inventory);
   if(kind==='visitor'){assert.equal(current.state.coins,before.state.coins+ticket.quote.net);assert.equal(current.state.inventory[ticket.quote.item],before.state.inventory[ticket.quote.item]-1);}
   else if(kind==='resident')assert.equal(current.state.inventory.wood,before.state.inventory.wood+2);
   else{assert.equal(current.state.inventory.stone,before.state.inventory.stone+1);assert.equal(current.state.oreNodes[0].hp,before.state.oreNodes[0].hp-1);}
   await page.locator('#continue').click();assert.equal(await page.evaluate(()=>nativeCompletion.clicks),1);
   const empty=await browser.newContext(),again=await empty.newPage();try{await again.goto(base);const reopened=await again.evaluate(async theme=>{const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js');const c=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){}}),state=await c.load(theme);return{state,pending:c.pendingAction(theme)};},theme);assert.equal(reopened.pending,null);assert.equal(reopened.state.coins,current.state.coins);assert.deepEqual(reopened.state.inventory,current.state.inventory);}finally{await empty.close();}
   const reopened=await createSaveStore({directory,now:()=>time}).current(theme);assert.equal(reopened.actions.receipts.filter(r=>r.ticket.requestId===ticket.requestId).length,1);assert.deepEqual(reopened.state.inventory,current.state.inventory);assert.equal(reopened.state.coins,current.state.coins);row.oneCanonicalReceiptAndReopen=true;
  }else{
   assert.equal(row.result.error.code,'save_request_timeout');assert.equal(row.result.status,'action_pending');assert(row.result.locked&&row.result.worldInert);assert.deepEqual(row.result.pending,JSON.parse(bodies[0]));assert.equal(row.result.recoveredReceipt,false);assert.equal(row.result.coins,before.state.coins);assert.deepEqual(row.result.inventory,before.state.inventory);
   if(mode==='uncommitted'){assert(current.actions[kind].leases[ticket.requestId]);assert.equal(receipts.length,0);}else{assert.equal(receipts.length,1);assert.equal(receipts[0].outcome,mode==='cancelled'?'cancelled':'finished');}row.originalPendingJournalProtected=true;
  }

  const commandKey='hyper-dimension-'+theme+'-pending-action',journal=await readBrowserSaveJournal(page,commandKey);
  assert(journal&&journal.body.requestId===ticket.requestId,'Actual IndexedDB pending command must exist before reloading');
  assert.deepEqual(journal.body,JSON.parse(bodies[0]));
  row.indexedDbOriginalPendingBeforeReload=true;row.versionBeforeReload=current.version;
  faultsActive=false;await page.reload();
  row.afterReload=await page.evaluate(async theme=>{
   const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js');
   const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Native Worker journal required');}});
   const state=await saves.load(theme);window.reloadedCompletion={saves,theme};
   return{pending:saves.pendingAction(theme),status:saves.status(theme).status,coins:state.coins,inventory:state.inventory,blocked:saves.blocked(theme)};
  },theme);
  assert.equal(row.afterReload.pending,null);assert.equal(row.afterReload.status,'saved');assert.equal(row.afterReload.blocked,false);
  assert.equal(await readBrowserSaveJournal(page,commandKey),null);
  const afterReload=await store.current(theme);assert.equal(afterReload.version,current.version,'Replaying existing result cannot change authority version');
  assert.equal(afterReload.actions.receipts.filter(r=>r.ticket.requestId===ticket.requestId).length,1);
  assert.equal(row.afterReload.coins,current.state.coins);assert.deepEqual(row.afterReload.inventory,current.state.inventory);
  assert.equal(row.requests.length,3);assert.equal(new Set(bodies).size,1,'Reload must keep original durable request bytes');
  assert(row.requests[2].replayed);assert.equal(afterReload.actions[kind].leases[ticket.requestId],undefined);
  row.actualReloadSameIdentityReplayedOnce=true;row.singleCanonicalReward=true;
  assert.deepEqual(row.errors,[]);row.originalFetchTimeoutMs=12000;row.identicalDurableBytes=true;row.noThirdMutationBeforeExplicitReload=true;row.passed=true;
 }catch(error){row.failure=error.stack;process.exitCode=1;}
 finally{await context.close();for(const response of held)response.destroy();await new Promise(r=>server.close(r));}
}
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const[kind,mode]of [['visitor','get-failed'],['resident','get-failed'],['field','get-failed']]){
  const results=await Promise.allSettled(['pixel','origami'].map(theme=>scenario(theme,kind,mode)));for(const result of results)if(result.status==='rejected'){report.setupFailure=result.reason.stack;process.exitCode=1;}
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 }
 report.passed=report.cases.length===6&&report.cases.every(c=>c.passed);
}finally{await browser?.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,kind:c.kind,mode:c.mode,passed:c.passed,failure:c.failure})),setupFailure:report.setupFailure}));}
