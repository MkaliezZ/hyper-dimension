import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';

const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v317/native-plan-queue');
await mkdir(out,{recursive:true});
const gate=()=>{let release;const waiting=new Promise(r=>release=r);return{waiting,release};};
const report={scope:'Owned native project UI, commerce controller, SaveClient Worker and HTTP SaveStore. Hold the actual accepted first resident rest reply, queue two unstarted resident jobs, then click the real project-create button. Manual planning must wait for the active reply and pass only unstarted work, preserve ten declared wood, reserve it once and reopen the same disk project. No model, game clock, completed work or reward injected; not zero-start, human or physical-device acceptance.',cases:[],passed:false};
let browser;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],order:[],passed:false};report.cases.push(row);
  const directory=await mkdtemp(join(out,theme+'-')),store=createSaveStore({directory}),seed=hydrateTown(createZeroState());
  seed.freshStartPending=false;seed.inventory.wood=10;
  await store.open(theme,{legacyState:seed,protect:true});
  const activeId=randomUUID(),backgroundIds=[randomUUID(),randomUUID()],firstHeld=gate(),releaseFirst=gate(),releaseBackground=gate();
  let hold=true;
  const server=createServer(async(req,res)=>{try{
   const pathname=new URL(req.url,'http://127.0.0.1').pathname;
   if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>body{font:16px sans-serif}#modalRoot{width:900px;margin:auto}.modal-body{max-height:750px;overflow:auto}.plan-item-art{width:40px;height:40px}input,select,button{font:inherit;padding:8px}</style><main id="app"><div id="modalRoot"></div></main>');return;}
   if(pathname.startsWith('/api/saves/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const encoded=Buffer.concat(chunks).toString(),body=encoded?JSON.parse(encoded):null,operation=pathname.split('/')[4]||'';
    try{
     const result=operation==='open'?await store.open(theme,body):operation==='save'?await store.save(theme,body):operation==='action'?await store.action(theme,body):{document:await store.current(theme)};
     if(operation==='action'){
      row.order.push({id:body.requestId,kind:body.kind,operation:body.operation,acceptedVersion:result.document.version});
      if(hold&&body.requestId===activeId){firstHeld.release();await releaseFirst.waiting;}
      else if(hold&&backgroundIds.includes(body.requestId))await releaseBackground.waiting;
     }
     res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
    }catch(error){res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}
    return;
   }
   const file=pathname.startsWith('/src/')?resolve(root,'.'+pathname):pathname.startsWith('/assets/')?resolve(root,'public','.'+pathname):null;
   assert(file&&file.startsWith(root+sep));
   const contentType={'.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp'}[extname(file)];assert(contentType);
   const target=pathname==='/src/serverCommerceUI.js'&&process.env.HD_QA_COMMERCE_SOURCE?resolve(process.env.HD_QA_COMMERCE_SOURCE):file;
   res.setHeader('Content-Type',contentType);res.end(await readFile(target));
  }catch(error){res.writeHead(500);res.end(error.message);}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port,context=await browser.newContext({viewport:{width:1200,height:1000}}),page=await context.newPage();
  page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(base);
   await page.evaluate(async theme=>{
    const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js'),{createServerCommerce}=await import('/src/serverCommerceUI.js'),{createProjectUI}=await import('/src/projectUI.js');
    let state;const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Actual Worker journal required');},onRemoteState:(_,next)=>state=next});state=await saves.load(theme);
    const persist=()=>saves.enqueue(theme,state),commerce=createServerCommerce({saves,theme:()=>theme,persist,applyState:next=>state=next,toast(){}});await commerce.recover();if(!commerce.ready())throw Error('Fictional commerce setup must complete');
    const ui=createProjectUI({state:()=>state,theme:()=>theme,persist,openModal:(title,subtitle,body,footer)=>document.getElementById('modalRoot').innerHTML='<section class="modal"><h2>'+title+'</h2><div class="modal-body">'+body+'</div><footer>'+footer+'</footer></section>',create:async project=>(await commerce.command('plan_create',{project,day:state.day})).receipt.details,manage:async()=>{throw Error('No management command expected');},refresh(){},toast(){},back(){},craft(){},gather(){}});
    window.projectQueueFixture={saves,commerce,theme,ui,jobs:[],state:()=>state,start(id,npcId){const job=saves.action(theme,{kind:'resident',operation:'begin',requestId:id,actorId:npcId,intent:{goal:'plaza',action:'rest',source:'rule',operationId:'qa-v317-'+id}});this.jobs.push(job);job.catch(error=>this.error=error.message);}};ui.open();
   },theme);
   for(const id of ['lantern','wheat'])await page.locator('[data-remove-target="'+id+'"]').click();
   await page.locator('#planTitle').fill('真实木料筹备');await page.locator('#planItem').selectOption('wood');await page.locator('#planQuantity').fill('10');await page.locator('#planAdd').click();
   await page.evaluate(({activeId,backgroundIds})=>{const f=window.projectQueueFixture;f.start(activeId,0);for(const [i,id]of backgroundIds.entries())f.start(id,i+1);},{activeId,backgroundIds});
   await firstHeld.waiting;await page.locator('#planCreate').click();
   assert(await page.locator('#planCreate').isDisabled());assert.match(await page.locator('#planError').textContent(),/正在登记/);
   assert.equal((await store.current(theme)).state.workProjects.length,0,'No plan may cross the already accepted resident reply');
   releaseFirst.release();
   await page.waitForFunction(()=>window.projectQueueFixture.state().workProjects.length===1||window.projectQueueFixture.error,null,{timeout:8000});
   const relevant=row.order.filter(x=>x.id===activeId||backgroundIds.includes(x.id)||x.operation==='plan_create');
   assert.equal(relevant[0].id,activeId);assert.equal(relevant[1].operation,'plan_create','Manual plan must precede unstarted background jobs');
   const planId=await page.locator('.project-card[data-project]').getAttribute('data-project');row.planId=planId;
   assert.equal(await page.locator('.project-card[data-project]').getAttribute('data-status'),'ready');assert(await page.locator('#planCreate').isEnabled());
   const acknowledged=await store.current(theme);assert.equal(acknowledged.state.workProjects.length,1);assert.equal(acknowledged.state.inventory.wood,10);assert.equal(acknowledged.state.resourceLedger.reservations['project:'+planId].items.wood,10);
   row.activeReceiptDrainedBeforePlan=true;row.manualPlanPrecededUnstartedWork=true;
   releaseBackground.release();hold=false;
   await page.evaluate(async()=>{const f=window.projectQueueFixture;await Promise.all(f.jobs);await f.saves.idle(f.theme);});
   const reopened=await createSaveStore({directory}).current(theme);assert.equal(reopened.state.workProjects.filter(p=>p.id===planId).length,1);assert.equal(reopened.state.inventory.wood,10);assert.equal(reopened.state.coins,0);
   assert.equal(reopened.actions.receipts.filter(r=>r.ticket.kind==='commerce'&&r.ticket.command==='plan_create').length,1);assert.equal(Object.keys(reopened.actions.resident.leases).length,3);
   assert.equal(row.order.filter(r=>backgroundIds.includes(r.id)).length,2);assert.deepEqual(row.errors,[]);
   row.unstartedJobsEventuallyAccepted=true;row.onePlanReservationAndReceiptReopened=true;row.noStockOrCashCreated=true;row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;row.diagnostic=await page.evaluate(()=>({error:window.projectQueueFixture?.error,planError:document.querySelector('#planError')?.textContent,commerce:window.projectQueueFixture?.commerce.inspect(),status:window.projectQueueFixture?.saves.status(window.projectQueueFixture.theme).status})).catch(()=>null);await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{releaseFirst.release();releaseBackground.release();hold=false;await context.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(r=>r.passed);
}finally{await browser?.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(r=>({theme:r.theme,passed:r.passed,failure:r.failure,diagnostic:r.diagnostic}))}));}
