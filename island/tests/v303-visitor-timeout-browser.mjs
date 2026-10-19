import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,RECIPES} from '../src/townSimulation.js';

const root=resolve(process.env.HD_QA_APP_ROOT||join(import.meta.dirname,'..')),out=resolve(process.env.HD_QA_OUT||'qa/v303/native-visitor-timeout');await mkdir(out,{recursive:true});
const report={scope:'Owned native SaveClient Worker and actual visitor controller, with real HTTP SaveStore. A declared fixture clock prepares an already-ready12second service and progressed stock/100coins; it does not measure natural gameplay. The first committed finish response is genuinely withheld until the original12000ms fetch aborts. Its one identical replay must reconcile one receipt/payment/material cost without a manual click. Not user data, provider calls, physical devices or human acceptance.',cases:[],passed:false};
const browser=await chromium.launch(browserLaunchOptions());
try{for(const theme of ['pixel','origami']){
 const row={theme,requests:[],errors:[],passed:false};report.cases.push(row);let time=100000;
 const directory=await mkdtemp(join(out,theme+'-')),store=createSaveStore({directory,now:()=>time}),seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.coins=100;for(const recipe of Object.values(RECIPES))seed.inventory[recipe.item]=4;
 await store.open(theme,{legacyState:seed,protect:true});
 const command=async(operation,args={})=>store.action(theme,{kind:'visitor',operation,requestId:randomUUID(),expectedVersion:(await store.current(theme)).version,...args});
 await command('enable',{theme});for(const seconds of [15,5]){const doc=await store.current(theme);time+=seconds*1000;await store.save(theme,{state:structuredClone(doc.state),expectedVersion:doc.version,activeSeconds:seconds,saveId:randomUUID()});}
 const arrival=await command('arrive'),guest=arrival.receipt.accepted[0];assert(guest);time=Math.max(time,(await store.current(theme)).actions.visitor.guests[guest.id].landReadyAt);await command('land',{guestId:guest.id});
 const begin=await command('begin',{guestId:guest.id,stop:guest.stop,buildingId:guest.itinerary[guest.stop]}),ticket=begin.ticket;assert.equal(ticket.duration,12);assert(ticket.quote.item&&ticket.quote.paid>0);time=ticket.readyAt;
 const before=await store.current(theme),bodies=[],held=new Set();let intercepted=false;
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><main>Owned visitor recovery fixture</main>');return;}
  if(url.pathname.startsWith('/api/saves/')){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);const text=Buffer.concat(chunks).toString(),body=text?JSON.parse(text):null,operation=url.pathname.split('/')[4]||'';
   try{
    const result=operation==='open'?await store.open(theme,body):operation==='save'?await store.save(theme,body):operation==='action'?await store.action(theme,body):{document:await store.current(theme)};
    if(operation==='action'&&body.kind==='visitor'&&body.operation==='finish'&&body.requestId===ticket.requestId){
     bodies.push(text);row.requests.push({at:Date.now(),requestId:body.requestId,replayed:!!result.replayed});
     if(!intercepted){intercepted=true;row.committedBeforeTimeout=true;held.add(res);res.once('close',()=>{held.delete(res);row.firstConnectionClosedAt=Date.now();});return;}
    }
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
   }catch(error){res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}return;
  }
  const file=resolve(root,'.'+url.pathname);assert(url.pathname.startsWith('/src/')&&file.startsWith(root+sep)&&extname(file)==='.js');res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
 }catch(error){res.statusCode=500;res.end(error.message);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,context=await browser.newContext(),page=await context.newPage();page.on('pageerror',error=>row.errors.push(error.message));
 try{
  await page.goto(base);row.result=await page.evaluate(async({theme,ticket})=>{
   const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js'),{createServerVisitor}=await import('/src/serverVisitorUI.js');
   const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Actual Worker journal required');}});await saves.load(theme);
   const visitor=createServerVisitor({saves,theme:()=>theme,persist(){},applyState(){},restore(){},toast(){}}),result=await visitor.finish(ticket);
   return{replayed:!!result.replayed,pending:!!saves.pendingAction(theme),status:saves.status(theme).status,locked:visitor.inspect().locked,coins:result.state.coins};
  },{theme,ticket});
  assert.equal(row.requests.length,2);assert.equal(new Set(bodies).size,1);assert.equal(row.requests[0].replayed,false);assert.equal(row.requests[1].replayed,true);assert(row.requests[1].at-row.requests[0].at>=11500,'The real original twelve-second timeout must expire');
  assert.equal(row.result.pending,false);assert.equal(row.result.locked,false);assert.equal(row.result.replayed,true);
  const current=await store.current(theme);assert.equal(current.state.coins,before.state.coins+ticket.quote.net);assert.equal(current.state.inventory[ticket.quote.item],before.state.inventory[ticket.quote.item]-1);assert.equal(current.actions.receipts.filter(r=>r.ticket.requestId===ticket.requestId).length,1);assert.equal(current.state.economy.ledger.filter(r=>r.id==='visitor:'+ticket.epoch+':'+guest.id+':0').length,1);assert(!current.actions.visitor.leases[ticket.requestId]);assert(!current.state.resourceLedger.reservations[ticket.owner]);
  await context.close();const empty=await browser.newContext(),again=await empty.newPage();await again.goto(base);row.reopened=await again.evaluate(async theme=>{const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js'),saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){}}),state=await saves.load(theme);return{coins:state.coins,pending:!!saves.pendingAction(theme)};},theme);await empty.close();assert.equal(row.reopened.coins,current.state.coins);assert.equal(row.reopened.pending,false);
  const restarted=createSaveStore({directory,now:()=>time}),replay=await restarted.action(theme,{...JSON.parse(bodies[0]),expectedVersion:'stale'});assert(replay.replayed);assert.equal(replay.document.state.coins,current.state.coins);assert.equal(replay.document.actions.receipts.filter(r=>r.ticket.requestId===ticket.requestId).length,1);
  assert.deepEqual(row.errors,[]);row.originalFetchTimeoutMs=12000;row.identicalDurableBytes=true;row.exactlyOneReceiptPaymentAndMaterial=true;row.emptyBrowserAndDiskReplayPassed=true;row.passed=true;
 }catch(error){row.failure=error.stack;process.exitCode=1;}
 finally{await context.close().catch(()=>{});for(const response of held)response.destroy();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
}report.passed=report.cases.every(row=>row.passed);
}finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(row=>({theme:row.theme,passed:row.passed,failure:row.failure}))}));}
