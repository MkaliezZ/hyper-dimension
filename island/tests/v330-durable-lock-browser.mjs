import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),variant='current-source',load=name=>import(pathToFileURL(join(root,name)));
const {chromium}=await load('node_modules/playwright-core/index.mjs'),{browserLaunchOptions}=await load('tests/browserRuntime.mjs'),{createSaveStore}=await load('server/saveStore.mjs'),{createLanActivityStore}=await load('server/lanActivityStore.mjs'),{openExclusiveFile,releaseOwnedLock}=await load('server/atomicJson.mjs'),{createZeroState}=await load('src/freshStart.js'),{hydrateTown}=await load('src/townSimulation.js');
const out=resolve(process.env.HD_QA_OUT||'qa/v330/native-durable-lock');await mkdir(out,{recursive:true});
const source=await readFile(join(root,'src/saveClient.js')),hash=b=>createHash('sha256').update(b).digest('hex'),manifest=JSON.parse(await readFile(join(root,'release-manifest.json'),'utf8'));assert.equal(hash(source),manifest.files.find(e=>e.path==='src/saveClient.js').sha256);
const report={variant,sourceSHA256:hash(source),scope:'Actual SaveClient,strict IndexedDB Worker,HTTP SaveStore and real LanActivityStore exclusive file lock. Fixture deliberately holds its own live-process activities.lock until the existing5sec authority lock deadline returns actual503lan_event_busy. Tests before and after real save commit. Declared0.1second active-clock sample,draft durability,identical saveId/version/request bytes,one actual clock credit,zero extra stock/cash,and empty-browser reopen. No model,user data,clock acceleration or human acceptance.',cases:[],passed:false,wholeGoalComplete:false};
const persist=()=>writeFile(join(out,'report.json'),JSON.stringify(report,null,2));const browser=await chromium.launch(browserLaunchOptions());
try{for(const theme of ['pixel','origami'])for(const mode of ['precommit','postcommit']){
 const row={theme,mode,requests:[],errors:[],passed:false};report.cases.push(row);const directory=await mkdtemp(join(out,theme+'-'+mode+'-')),store=createSaveStore({directory:join(directory,'island')}),activities=createLanActivityStore({directory,identities:{},tenants:{}});await activities.reconcile();
 const seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.saveSlot='hyper-dimension-'+theme+'-v3';await store.open(theme,{legacyState:seed,protect:true});let armed=false,locked=false,failures=0;const token=randomUUID(),lock=join(directory,'_lan/activities.lock');
 const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://owned').pathname;if(path==='/favicon.ico'){res.writeHead(204);return res.end();}if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><button id="save">保存委托草稿</button><p id="status"></p>');}
  if(path.startsWith('/api/saves/')){
   const chunks=[];for await(const c of req)chunks.push(c);const raw=Buffer.concat(chunks),body=raw.length?JSON.parse(raw):{},op=path.split('/')[4]||'read',entry={op,bodyHash:hash(raw),saveId:body.saveId,expectedVersion:body.expectedVersion,activeSeconds:body.activeSeconds,armed,at:Date.now()};row.requests.push(entry);
   try{
    if(armed&&op==='save'&&mode==='precommit')await activities.reconcile();
    const result=op==='open'?await store.open(theme,body):op==='save'?await store.save(theme,body):op==='action'?await store.action(theme,body):{document:await store.current(theme)};
    if(armed&&op==='save'&&mode==='postcommit')await activities.reconcile();entry.status=200;entry.finishedAt=Date.now();res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
   }catch(error){entry.status=error.status||500;entry.code=error.code;entry.finishedAt=Date.now();if(armed&&op==='save'&&error.code==='lan_event_busy'){failures++;if(locked){await releaseOwnedLock(lock,token);locked=false;}}res.writeHead(error.status||500,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:error.message,code:error.code}));}
  }
  const file=resolve(root,'.'+path);assert(path.startsWith('/src/')&&file.startsWith(root+sep));res.setHeader('Content-Type','text/javascript');res.end(path==='/src/saveClient.js'?source:await readFile(file));
 }catch(error){row.errors.push({message:error.message,code:error.code});res.writeHead(500);res.end('Owned fixture error');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push({message:e.message}));
 async function open(target,prepare){await target.goto(base);await target.evaluate(async({theme,prepare})=>{
  const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js'),{createServerCommerce}=await import('/src/serverCommerceUI.js');let state;const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Native journal required');},onRemoteState:(_,next)=>state=next});state=await saves.load(theme);
  const commerce=createServerCommerce({saves,theme:()=>theme,persist:()=>saves.enqueue(theme,state),applyState:next=>state=next,toast(){}});await commerce.recover();if(!commerce.ready())throw Error('Canonical commerce not ready');
  if(prepare){state.stewardChat={messages:[],draft:'before',sequence:0};saves.enqueue(theme,state);await saves.checkpoint(theme,{foreground:true});}
  const f=window.busyFixture={saves,state:()=>state,theme};document.querySelector('#save').onclick=()=>{state.stewardChat.draft='after';saves.enqueue(theme,state);saves.advanceTime(theme,.1);f.promise=saves.flush(theme).then(()=>{f.done=true;document.querySelector('#status').textContent='已保存';}).catch(e=>{f.error={code:e.code,message:e.message};document.querySelector('#status').textContent=e.message;});};
 },{theme,prepare});}
 try{
  await open(page,true);const before=await store.current(theme);row.beforeClock=before.actions.commerce.activeSeconds;const file=await openExclusiveFile(lock);await file.writeFile(JSON.stringify({pid:process.pid,token}));await file.close();locked=true;armed=true;
  const at=Date.now();await page.locator('#save').click();await page.waitForFunction(()=>busyFixture.done||busyFixture.error,null,{timeout:12000});row.elapsedMs=Date.now()-at;row.client=await page.evaluate(()=>({done:!!busyFixture.done,error:busyFixture.error||null,status:busyFixture.saves.status(busyFixture.theme).status}));
  const saves=row.requests.filter(r=>r.armed&&r.op==='save');assert.equal(failures,1);assert.equal(saves[0].status,503);assert.equal(saves[0].code,'lan_event_busy');assert(saves[0].finishedAt-saves[0].at>=5000,'Must exercise the real5second lock gate');
  const canonical=await store.current(theme);row.afterClock=canonical.actions.commerce.activeSeconds;row.saveRequests=saves;
  {
   assert(row.client.done);assert.equal(row.client.error,null);assert.equal(saves.length,2);assert.equal(new Set(saves.map(r=>r.bodyHash)).size,1);assert.equal(new Set(saves.map(r=>r.saveId)).size,1);assert.equal(new Set(saves.map(r=>r.expectedVersion)).size,1);assert.equal(saves[1].status,200);assert.equal(canonical.state.stewardChat.draft,'after');assert(Math.abs(row.afterClock-row.beforeClock-.1)<1e-9);assert.equal(canonical.state.inventory.wood,0);assert.equal(canonical.state.coins,0);
   const empty=await browser.newContext(),again=await empty.newPage();await open(again,false);row.reopened=await again.evaluate(()=>({draft:busyFixture.state().stewardChat.draft,wood:busyFixture.state().inventory.wood,coins:busyFixture.state().coins}));assert.deepEqual(row.reopened,{draft:'after',wood:0,coins:0});await empty.close();
  }
  assert.deepEqual(row.errors,[]);row.passed=true;
 }catch(error){row.failure=error.stack;process.exitCode=1;}finally{if(locked)await releaseOwnedLock(lock,token);await context.close();await new Promise(r=>server.close(r));await persist();}
}report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await persist();console.log(JSON.stringify({variant,passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,mode:c.mode,passed:c.passed,failure:c.failure,elapsedMs:c.elapsedMs}))}));}
