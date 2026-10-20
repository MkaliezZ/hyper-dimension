import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {join,resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v332/native-farm-start');await mkdir(out,{recursive:true});
const load=f=>import(pathToFileURL(join(root,f))),{chromium}=await load('node_modules/playwright-core/index.mjs'),{browserLaunchOptions}=await load('tests/browserRuntime.mjs'),{createSaveStore}=await load('server/saveStore.mjs'),{createZeroState}=await load('src/freshStart.js'),{hydrateTown}=await load('src/townSimulation.js');
const manifest=JSON.parse(await readFile(join(root,'release-manifest.json'),'utf8'));
assert.equal(createHash('sha256').update(await readFile(join(root,'src/saveJournal.js'))).digest('hex'),manifest.files.find(e=>e.path==='src/saveJournal.js').sha256);
const report={scope:'Isolated actual SaveClient Worker IndexedDB,actual serverFarm controller,native recovery button and HTTP SaveStore/disk. A declared one-seed tilled-field preparation fixture. The original12000ms request actually expires. One lost NPC farm begin reply is replayed once with identical durable bytes;two lost replies keep manual recovery and original bytes. Successful work uses its real20sec duration. No clock/resources/results/provider or user data injection after setup;not full hosted task-chain or human acceptance.',cases:[],passed:false,wholeGoalComplete:false};
const save=()=>writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
const browser=await chromium.launch(browserLaunchOptions());
try{for(const theme of ['pixel','origami'])for(const mode of ['single-lost','double-lost']){
 const row={theme,mode,requests:[],errors:[],passed:false};report.cases.push(row);const directory=await mkdtemp(join(out,theme+'-'+mode+'-')),store=createSaveStore({directory}),seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.saveSlot='hyper-dimension-'+theme+'-v3';seed.inventory.seed=1;seed.plots[7]={stage:1,growth:0,crop:'wheat'};await store.open(theme,{legacyState:seed,protect:true});
 let heldCount=0;const held=new Set(),beginBodies=[];
 const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://owned').pathname;if(path==='/favicon.ico'){res.writeHead(204);return res.end();}if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><style>[hidden],.hidden{display:none!important}</style><button id="ordinary">背包操作</button>');}
  if(path.startsWith('/api/saves/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const text=Buffer.concat(chunks).toString(),body=text?JSON.parse(text):null,operation=path.split('/')[4]||'read';
   const result=operation==='open'?await store.open(theme,body):operation==='save'?await store.save(theme,body):operation==='action'?await store.action(theme,body):{document:await store.current(theme)};
   const entry={operation,kind:body?.kind,step:body?.step,action:body?.operation,requestId:body?.requestId,at:Date.now(),replayed:!!result.replayed,ticket:result.ticket?{requestId:result.ticket.requestId,sequence:result.ticket.sequence,readyAt:result.ticket.readyAt}:null};row.requests.push(entry);
   if(body?.kind==='farm'&&body.operation==='begin'){beginBodies.push(text);if(heldCount<(mode==='double-lost'?2:1)){heldCount++;entry.withheld=true;held.add(res);res.once('close',()=>held.delete(res));return;}}
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
  }
  const file=resolve(path.startsWith('/assets/')?join(root,'public'):root,'.'+path);assert((path.startsWith('/src/')||path.startsWith('/assets/'))&&file.startsWith(root+sep));res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch(error){row.errors.push({message:error.message,code:error.code,path:req.url});res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push({message:e.message}));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);row.started=Date.now();row.begin=await page.evaluate(async theme=>{
   const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js'),{createServerFarm}=await import('/src/serverFarmUI.js');let state;
   const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Actual Worker required');},onRemoteState:(_,s)=>state=s});state=await saves.load(theme);
   const farm=createServerFarm({saves,theme:()=>theme,persist(){},applyState:s=>state=s,startAnimation(){throw Error('No player animation expected');},stopAnimation(){},onReceipt(){},onRelease(){},toast(){}});window.farmFixture={saves,farm,theme,state:()=>state,clicks:0};document.getElementById('ordinary').onclick=()=>farmFixture.clicks++;
   try{const ticket=await farm.beginNpc({npcId:1},{farmIndex:7,resource:'wheat',purposeId:'farm-timeout-probe',source:'local'},'sow');farmFixture.ticket=ticket;return{ok:true,ticket,pending:!!saves.pendingAction(theme),locked:farm.inspect().locked,status:saves.status(theme).status};}
   catch(error){return{ok:false,code:error.code,message:error.message,pending:!!saves.pendingAction(theme),locked:farm.inspect().locked,status:saves.status(theme).status};}
  },theme);
  const begins=()=>row.requests.filter(r=>r.action==='begin'&&r.kind==='farm');assert(Date.now()-row.started>=11500,'Actual original fetch must expire');
  const pending=await store.current(theme);assert.equal(Object.keys(pending.actions.farm.leases).length,1);assert.equal(pending.state.inventory.seed,1);assert.equal(pending.state.plots[7].stage,1);assert.equal(pending.actions.receipts.filter(r=>r.ticket.requestId===begins()[0].requestId).length,0);
  if(mode==='single-lost'){
   assert(row.begin.ok);assert.equal(row.begin.pending,false);assert.equal(row.begin.locked,false);assert.equal(begins().length,2);assert(begins()[1].replayed);assert.equal(new Set(beginBodies).size,1);
   await page.waitForTimeout(Math.max(0,row.begin.ticket.readyAt-Date.now()+50));await page.evaluate(()=>farmFixture.farm.finishNpc(farmFixture.ticket));
   const done=await store.current(theme);assert.equal(done.state.inventory.seed,0);assert.equal(done.state.plots[7].stage,2);assert.equal(Object.keys(done.actions.farm.leases).length,0);const receipts=done.actions.receipts.filter(r=>r.ticket.requestId===row.begin.ticket.requestId);assert.equal(receipts.length,1);assert.equal(receipts[0].outcome,'finished');assert(Date.now()-begins()[0].at>=20000);
   row.automaticRecovered=true;row.normal20SecondWorkAndSingleSeedConsumption=true;
  }else{
   assert.equal(row.begin.ok,false);assert(row.begin.pending&&row.begin.locked);assert.equal(row.begin.status,'action_pending');assert.equal(begins().length,2);assert.equal(new Set(beginBodies).size,1);
   await page.locator('#farmRetry').click();await page.waitForFunction(()=>!farmFixture.saves.pendingAction(farmFixture.theme)&&!farmFixture.farm.inspect().locked);
   const done=await store.current(theme);assert.equal(done.state.inventory.seed,1);assert.equal(done.state.plots[7].stage,1);assert.equal(Object.keys(done.actions.farm.leases).length,0);const receipts=done.actions.receipts.filter(r=>r.ticket.requestId===begins()[0].requestId);assert.equal(receipts.length,1);assert.equal(receipts[0].outcome,'cancelled');assert.equal(new Set(beginBodies).size,1);assert.equal(begins().length,3);
   row.explicitNativeRecoveryReturnedReservedSeedOnce=true;row.automaticRecovered=false;
  }
  await page.locator('#ordinary').click();assert.equal(await page.evaluate(()=>farmFixture.clicks),1);const done=await store.current(theme);assert.equal(done.state.coins,0);assert.equal(done.state.inventory.wheat||0,0);assert.deepEqual(row.errors,[]);
  const restarted=createSaveStore({directory}),again=await restarted.action(theme,JSON.parse(beginBodies[0]));assert(again.replayed);assert.equal(again.document.actions.receipts.filter(r=>r.ticket.requestId===begins()[0].requestId).length,1);row.sameDurableBytes=true;row.originalFetchTimeoutMs=12000;row.passed=true;
 }catch(error){row.failure=error.stack;process.exitCode=1;}
 finally{await context.close();for(const res of held)res.destroy();await new Promise(r=>server.close(r));await save();}
}report.passed=report.cases.every(r=>r.passed);
}finally{await browser.close();await save();console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,mode,passed,failure,begin,automaticRecovered})=>({theme,mode,passed,failure,begin,automaticRecovered}))},null,2));}
