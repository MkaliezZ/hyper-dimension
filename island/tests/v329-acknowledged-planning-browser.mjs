import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),variant='current-source';
const manifest=JSON.parse(await readFile(join(root,'release-manifest.json'),'utf8'));
const load=f=>import(pathToFileURL(join(root,f))),{chromium}=await load('node_modules/playwright-core/index.mjs'),{browserLaunchOptions}=await load('tests/browserRuntime.mjs'),{createSaveStore}=await load('server/saveStore.mjs'),{createZeroState}=await load('src/freshStart.js'),{hydrateTown}=await load('src/townSimulation.js');
const out=resolve(process.env.HD_QA_OUT||'qa/v329/native-acknowledged-planning');await mkdir(out,{recursive:true});
const report={variant,scope:'Real owned native DOM,actual SaveClient/commerce controller,IndexedDB Worker,authoritative HTTP SaveStore/disk. Explicit pre-provider foreground checkpoint,then one declared local chat draft edit and0.1visible-clock sample. Held subsequent save isolates redundant HTTP snapshot before pure manual plan_batch. Actual queued task/no output or coins,dirty journal,ordinary final save and reload are verified. Automatic/unstamped/active or unknown autosave negative controls retain original saving. No map/providers/userdata or natural-growth/human claim.',cases:[],passed:false,wholeGoalComplete:false};
const persist=()=>writeFile(join(out,'report.json'),JSON.stringify(report,null,2));let browser;
const gate=()=>{let release;return {promise:new Promise(r=>release=r),release:()=>release()};};
try{browser=await chromium.launch(browserLaunchOptions());for(const theme of ['pixel','origami'])for(const mode of variant==='baseline'?['manual-ack']:['manual-ack','unstamped','automatic','active-save','unknown-save','other-day','other-command']){
 const row={theme,mode,requests:[],errors:[],passed:false};report.cases.push(row);const directory=await mkdtemp(join(out,theme+'-'+mode+'-')),store=createSaveStore({directory});const seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.saveSlot='hyper-dimension-'+theme+'-v3';await store.open(theme,{legacyState:seed,protect:true});
 const held=gate(),entered=gate();let arm=false,holds=0;
 const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://owned').pathname;
  if(path==='/favicon.ico'){res.writeHead(204);return res.end();}if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><button id="send">寄出分工</button><p id="status"></p>');}
  if(path.startsWith('/api/saves/')){
   let body={};if(req.method==='POST'){const chunks=[];for await(const c of req)chunks.push(c);body=JSON.parse(Buffer.concat(chunks).toString());}
   const operation=path.split('/')[4]||'read',entry={operation,kind:body.kind,action:body.operation,requestId:body.requestId,saveId:body.saveId,activeSeconds:body.activeSeconds,foregroundInBody:Object.hasOwn(body,'foreground'),armed:arm,at:Date.now()};row.requests.push(entry);
   if(arm&&operation==='save'&&!holds){holds++;entry.held=true;entered.release();await held.promise;if(mode==='unknown-save'){res.writeHead(503,{'Content-Type':'application/json'});return res.end('{"code":"save_unavailable","error":"Owned unknown autosave response"}');}}
   const result=operation==='open'?await store.open(theme,body):operation==='save'?await store.save(theme,body):operation==='action'?await store.action(theme,body):{document:await store.current(theme)};
   entry.acceptedAt=Date.now();res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
  }
  const file=path.startsWith('/src/')?resolve(root,'.'+path):null;assert(file&&file.startsWith(root+sep));
  const actual=file;
  const bytes=await readFile(actual);if(path==='/src/saveClient.js'){row.moduleSHA256=createHash('sha256').update(bytes).digest('hex');assert.equal(row.moduleSHA256,manifest.files.find(f=>f.path==='src/saveClient.js').sha256);}
  res.setHeader('Content-Type','text/javascript');res.end(bytes);
 }catch(error){(row.serverErrors??=[]).push({status:error.status,code:error.code,message:error.message});res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
 async function open(prepare){await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(async({theme,mode,prepare})=>{
  const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js'),{createServerCommerce}=await import('/src/serverCommerceUI.js');let state;
  const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Native Worker journal required');},onRemoteState:(_,next)=>state=next});state=await saves.load(theme);
  const commerce=createServerCommerce({saves,theme:()=>theme,persist:()=>saves.enqueue(theme,state),applyState:next=>state=next,toast(){}});await commerce.recover();if(!commerce.ready())throw Error('Real planning controller not ready');
  const f=window.planningAck={saves,commerce,state:()=>state,theme,mode};
  if(prepare){state.stewardChat={messages:[],draft:'before-checkpoint',sequence:0};saves.enqueue(theme,state);await saves.checkpoint(theme,{foreground:mode!=='unstamped'});}
  document.querySelector('#send').onclick=()=>{state.stewardChat.draft='after-checkpoint';saves.enqueue(theme,state);saves.advanceTime(theme,.1);f.taskId='owned-plan-'+theme+'-'+mode;f.promise=commerce.command(mode==='other-command'?'supply':'plan_batch',{runId:f.taskId,day:mode==='other-day'?state.day+1:state.day,supply:'seeds',plans:[],commands:[{id:f.taskId,npcId:5,goal:'forest',resource:'wood',quantity:1,intent:'协议验证收一份木材'}]},{foreground:mode!=='automatic'}).then(()=>{f.done=true;document.querySelector('#status').textContent='已登记';}).catch(e=>{f.error={code:e.code,message:e.message};document.querySelector('#status').textContent=e.message;});};
 },{theme,mode,prepare});}
 try{
  await open(true);const before=await store.current(theme);row.beforeClock=before.actions.commerce.activeSeconds;arm=true;
  if(['active-save','unknown-save'].includes(mode)){
   await page.evaluate(()=>{const f=planningAck;f.state().stewardChat.draft='active-save-before-command';f.saves.enqueue(f.theme,f.state());f.activeSave=f.saves.flush(f.theme).catch(e=>f.saveError={code:e.code,message:e.message});});await entered.promise;
  }
  const clickedAt=Date.now();await page.locator('#send').click();
  if(mode==='manual-ack'){
   await page.waitForFunction(()=>window.planningAck.done===true,null,{timeout:5000});row.registrationMs=Date.now()-clickedAt;
   const first=row.requests.find(r=>r.armed);assert.equal(first.operation,'action','Manual batch must use the acknowledged base without a redundant save');assert.equal(first.action,'plan_batch');
   const canonical=await store.current(theme);assert.equal(canonical.state.stewardChat.draft,'before-checkpoint');assert.equal(canonical.state.agentTaskLedger.length,1);assert.equal(canonical.state.agentTaskLedger[0].status,'queued');assert.equal(canonical.state.inventory.wood,0);assert.equal(canonical.state.coins,0);
   row.durableDraft=await page.evaluate(async()=>{const f=planningAck,db=await new Promise((resolve,reject)=>{const r=indexedDB.open('hyper-dimension-save-journal',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const tx=db.transaction('entries','readonly'),s=tx.objectStore('entries'),r=s.get('hd-local:'+f.state().saveSlot);r.onsuccess=()=>resolve(JSON.parse(r.result).stewardChat.draft);r.onerror=()=>reject(r.error);});}finally{db.close();}});assert.equal(row.durableDraft,'after-checkpoint');row.noPrematureLocalSnapshotOnAuthority=true;
  }else{
   await entered.promise;await page.waitForTimeout(350);assert.equal((await store.current(theme)).state.agentTaskLedger.length,0,'The protected save must precede registration');assert.equal(row.requests.find(r=>r.armed).operation,'save');assert(!row.requests.some(r=>r.armed&&r.operation==='action'),'No command may overtake its protected save');row.protectedSavePrecededPlanning=true;
  }
  arm=false;held.release();
  if(mode==='unknown-save'){
   await page.waitForFunction(()=>!!window.planningAck.error,null,{timeout:5000});assert.equal((await store.current(theme)).state.agentTaskLedger.length,0);assert(!row.requests.some(r=>r.action==='plan_batch'));
   row.pendingAutosaveRetained=await page.evaluate(async()=>{const f=planningAck;await f.activeSave;const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('hyper-dimension-save-journal',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{const raw=await new Promise((resolve,reject)=>{const r=db.transaction('entries','readonly').objectStore('entries').get('hd-local:hyper-dimension-'+f.theme+'-pending-clock-save');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const pending=raw?JSON.parse(raw):null;return {offline:f.saves.status(f.theme).status==='offline',saveId:pending?.body?.saveId,hasCanonicalBase:!!pending?.baseDocument};}finally{db.close();}});assert(row.pendingAutosaveRetained.offline&&row.pendingAutosaveRetained.hasCanonicalBase);assert.equal(row.pendingAutosaveRetained.saveId,row.requests.find(r=>r.held).saveId);row.noCommandAfterUnknownAutosave=true;
  }else if(['other-day','other-command'].includes(mode)){
   await page.waitForFunction(()=>!!window.planningAck.error,null,{timeout:5000});const expected=mode==='other-day'?'commerce_day':'commerce_funds';assert.equal(await page.evaluate(()=>planningAck.error.code),expected);const canonical=await store.current(theme);assert.equal(canonical.state.agentTaskLedger.length,0);assert.equal(canonical.state.coins,0);assert.equal(canonical.state.inventory.wood,0);row.originalAuthorityRejectedInput=true;
  }else{
   await page.waitForFunction(()=>window.planningAck.done===true,null,{timeout:5000});await page.evaluate(async()=>{const f=planningAck;await f.saves.flush(f.theme);});const after=await store.current(theme);
   assert.equal(after.state.stewardChat.draft,'after-checkpoint');assert.equal(after.state.agentTaskLedger.length,1);assert.equal(after.state.agentTaskLedger[0].status,'queued');assert.equal(after.actions.receipts.filter(r=>r.ticket.kind==='commerce'&&r.ticket.command==='plan_batch').length,1);
   assert(Math.abs(after.actions.commerce.activeSeconds-row.beforeClock-.1)<1e-6,'The declared clock sample is saved exactly once');row.clockPreservedExactlyOnce=true;assert.equal(after.state.inventory.wood,0);assert.equal(after.state.coins,0);
   await page.reload();await page.evaluate(async theme=>{const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js');const client=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Native Worker journal required');}});window.planningReload={client,state:await client.load(theme)};},theme);
   const reopened=await page.evaluate(()=>({draft:planningReload.state.stewardChat.draft,tasks:planningReload.state.agentTaskLedger.length,slot:planningReload.state.saveSlot}));assert.equal(reopened.draft,'after-checkpoint');assert.equal(reopened.tasks,1);assert.equal(reopened.slot,after.state.saveSlot);row.exactTaskAndDraftAfterReload=true;
  }
  assert.deepEqual((row.serverErrors||[]).map(e=>e.code),mode==='other-day'?['commerce_day']:mode==='other-command'?['commerce_funds']:[]);assert(row.requests.every(r=>!r.foregroundInBody));assert.deepEqual(row.errors,[]);row.passed=true;
 }catch(error){row.failure=error.stack;row.last=await page.evaluate(()=>{const f=planningAck;return{slot:f.state().saveSlot,day:f.state().day,marker:f.saves.status(f.theme).planningCheckpointWorld,saveStatus:f.saves.status(f.theme).status,error:f.error,saveError:f.saveError};}).catch(()=>null);process.exitCode=1;}
 finally{arm=false;held.release();await context.close();await new Promise(r=>server.close(r));await persist();}
}report.passed=report.cases.every(r=>r.passed);}finally{await browser?.close();await persist();console.log(JSON.stringify({variant,passed:report.passed,cases:report.cases.map(r=>({theme:r.theme,mode:r.mode,passed:r.passed,registrationMs:r.registrationMs,failure:r.failure})),wholeGoalComplete:false}));}
