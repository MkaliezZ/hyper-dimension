import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
const root=resolve(process.env.HD_QA_APP_ROOT||join(import.meta.dirname,'..')),out=resolve(process.env.HD_QA_OUT||'qa/v321/native-field-finish-timeout');await mkdir(out,{recursive:true});
const report={scope:'Owned minimal browser fixture with actual SaveClient Worker, NPC field and visitor controllers, HTTP SaveStore and disk. One pickaxe is declared initially. Work waits the normal20seconds. The first committed NPC completion response is withheld until the original12000ms fetch expires. Exactly one identical replay must recover its existing receipt, without optimistic stock or duplicate gain, then allow a visitor controller command. No injected clock/result or rendered-world motion claim. Not full hosted market, provider, user-browser or human/physical-device acceptance.',cases:[],passed:false};
let browser;
try{browser=await chromium.launch(browserLaunchOptions());for(const theme of ['pixel','origami']){
 const row={theme,requests:[],errors:[],passed:false};report.cases.push(row);const directory=await mkdtemp(join(out,theme+'-')),store=createSaveStore({directory}),seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.inventory.pickaxe=1;await store.open(theme,{legacyState:seed,protect:true});
 const bodies=[],held=new Set();let withheld=false;
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><main><button id="shelfAction" type="button">保存货架</button></main>');return;}
  if(url.pathname.startsWith('/api/saves/')){const chunks=[];for await(const c of req)chunks.push(c);const text=Buffer.concat(chunks).toString(),body=text?JSON.parse(text):null,operation=url.pathname.split('/')[4]||'';
   try{const result=operation==='open'?await store.open(theme,body):operation==='save'?await store.save(theme,body):operation==='action'?await store.action(theme,body):{document:await store.current(theme)};
    if(operation==='action'&&body.kind==='field'&&body.operation==='finish'){
     bodies.push(text);row.requests.push({at:Date.now(),requestId:body.requestId,replayed:!!result.replayed,sequence:result.ticket.sequence});
     if(!withheld){withheld=true;row.authorityCommittedBeforeReply=true;row.authorityStockBeforeReply=result.document.state.inventory.stone;held.add(res);res.once('close',()=>{held.delete(res);row.firstConnectionClosedAt=Date.now();});return;}
    }
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
   }catch(error){res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}return;
  }
  const file=resolve(root,'.'+url.pathname);assert(url.pathname.startsWith('/src/')&&file.startsWith(root+sep)&&extname(file)==='.js');res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
 }catch(error){res.statusCode=500;res.end(error.message);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
 try{
  await page.goto(base);row.begin=await page.evaluate(async theme=>{
   const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js'),{createServerFieldNpc}=await import('/src/serverFieldNpcUI.js');
   const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Actual Worker journal required');}});await saves.load(theme);const field=createServerFieldNpc({saves,theme:()=>theme,persist(){},applyState(){},toast(){}});
   window.finishFixture={saves,field,theme,clicks:0};document.getElementById('shelfAction').onclick=()=>window.finishFixture.clicks++;
   const ticket=await field.begin({npcId:0},{mineIndex:1,resource:'stone'});window.finishFixture.ticket=ticket;return{ticket,pending:!!saves.pendingAction(theme),locked:field.inspect().locked};
  },theme);assert.equal(row.begin.pending,false);assert.equal(row.begin.locked,false);
  const before=await store.current(theme);assert.equal(Object.keys(before.actions.field.leases).length,1);assert.equal(before.state.inventory.stone||0,0);
  await new Promise(r=>setTimeout(r,Math.max(0,row.begin.ticket.readyAt-Date.now()+50)));
  const finishing=page.evaluate(async()=>{const f=window.finishFixture,r=await f.field.finish(f.ticket);return{gain:r.receipt.gain,pending:!!f.saves.pendingAction(f.theme),locked:f.field.inspect().locked,stone:f.saves.status(f.theme).state.inventory.stone};});finishing.catch(()=>{});
  const deadline=Date.now()+10000;while(!withheld&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));assert(withheld);
  row.waiting=await page.evaluate(()=>{const f=window.finishFixture;return{stone:f.saves.status(f.theme).state.inventory.stone||0,pending:f.saves.pendingAction(f.theme)?.body?.kind,locked:f.field.inspect().locked};});assert.equal(row.waiting.stone,0);assert.equal(row.waiting.pending,'field');assert.equal(row.waiting.locked,false);assert.equal(row.authorityStockBeforeReply,1);
  row.finish=await finishing;assert.deepEqual(row.finish,{gain:{stone:1},pending:false,locked:false,stone:1});
  assert.equal(row.requests.length,2);assert.equal(new Set(bodies).size,1);assert.equal(row.requests[0].replayed,false);assert.equal(row.requests[1].replayed,true);assert(row.requests[1].at-row.requests[0].at>=11500);assert.equal(new Set(row.requests.map(r=>r.sequence)).size,1);
  await page.locator('#shelfAction').click();assert.equal(await page.evaluate(()=>window.finishFixture.clicks),1);
  row.visitor=await page.evaluate(async()=>{const f=window.finishFixture,{createServerVisitor}=await import('/src/serverVisitorUI.js');const visitor=createServerVisitor({saves:f.saves,theme:()=>f.theme,persist(){},applyState(){},restore(){},toast(){}});await visitor.recover();return{ready:visitor.inspect().ready,pending:!!f.saves.pendingAction(f.theme),locked:visitor.inspect().locked};});assert.deepEqual(row.visitor,{ready:true,pending:false,locked:false});
  const done=await store.current(theme);assert.equal(done.state.inventory.stone,1);assert.equal(done.actions.receipts.filter(r=>r.ticket.requestId===row.begin.ticket.requestId).length,1);assert.equal(Object.keys(done.actions.field.leases).length,0);assert.equal(done.state.inventory.pickaxe,before.state.inventory.pickaxe);assert.equal(done.state.oreNodes[1].hp,before.state.oreNodes[1].hp-1);assert(done.actions.visitor);assert.equal(done.actions.visitor.activeSeconds,0);assert(row.requests[0].at>=row.begin.ticket.readyAt);
  const reopened=createSaveStore({directory}),replay=await reopened.action(theme,JSON.parse(bodies[0]));assert(replay.replayed);assert.equal(replay.document.state.inventory.stone,1);assert.equal(replay.document.actions.receipts.filter(r=>r.ticket.requestId===row.begin.ticket.requestId).length,1);assert.deepEqual(row.errors,[]);
  Object.assign(row,{identicalDurableBytes:true,originalFetchTimeoutMs:12000,normalWorkSeconds:row.begin.ticket.duration,noOptimisticStock:true,oneMaterialReceipt:true,oneOreDamage:true,visitorControllerContinues:true,diskReplayPassed:true,passed:true});
 }catch(error){row.failure=error.stack;process.exitCode=1;row.recovery=await page.evaluate(()=>{const f=window.finishFixture;return f?{pending:f.saves.pendingAction(f.theme)?.body,status:f.saves.status(f.theme).status,locked:f.field.inspect().locked}:null;}).catch(()=>null);}
 finally{await context.close().catch(()=>{});for(const res of held)res.destroy();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
}report.passed=report.cases.every(r=>r.passed);
}finally{await browser?.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(r=>({theme:r.theme,passed:r.passed,failure:r.failure,recovery:r.recovery}))}));}
