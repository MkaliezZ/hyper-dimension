import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v328/native-manual-checkpoint');await mkdir(out,{recursive:true});
const gate=()=>{let release;const waiting=new Promise(r=>release=r);return{waiting,release};};
const report={scope:'Owned foreground chat-checkpoint admission regression:one active acknowledged transaction,two queued background jobs,and a user checkpoint before the deterministic batch. Active acknowledgement and prior barriers stay protected;manual checkpoint must be admitted before releasing an unstarted background job. Actual Worker/HTTP/disk,not model or full flow. Owned native commerce UI, actual SaveClient Worker/queue, actual HTTP SaveStore and disk reopen. Hold one accepted resident rest response, then queue two unstarted jobs and a manual or automatic plan_batch. Deterministic input, no provider/game-clock/reward/actual work completion. Controlled queue regression, not full app, hosted or human acceptance.',cases:[],passed:false,wholeGoalComplete:false};let browser;
try{browser=await chromium.launch(browserLaunchOptions());for(const theme of ['pixel','origami'])for(const mode of ['manual']){
 const row={theme,mode,order:[],errors:[],passed:false};report.cases.push(row);const directory=await mkdtemp(join(out,theme+'-'+mode+'-')),store=createSaveStore({directory}),seed=hydrateTown(createZeroState());seed.freshStartPending=false;await store.open(theme,{legacyState:seed,protect:true});
 const active=randomUUID(),background=[randomUUID(),randomUUID()],started=gate(),release=gate(),backgroundStarted=gate(),releaseBackground=gate();let hold=true;
 const commandId='batch-'+theme+'-'+mode;
 const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://owned').pathname;
  if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><main id="game"><button id="send">登记管家分工</button><p id="status"></p></main>');}
  if(path.startsWith('/api/saves/')){const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString()||'{}'),operation=path.split('/')[4];
   const result=operation==='open'?await store.open(theme,body):operation==='save'?await store.save(theme,body):operation==='action'?await store.action(theme,body):{document:await store.current(theme)};
   if(operation==='action'){row.order.push({id:body.requestId,kind:body.kind,operation:body.operation,foregroundInBody:Object.hasOwn(body,'foreground'),version:result.document.version});
    if(hold&&body.requestId===active){started.release();await release.waiting;if(mode==='uncertain'){res.writeHead(503,{'Content-Type':'application/json'});return res.end('{"error":"Owned lost completion reply","code":"save_unavailable"}');}}
    if(hold&&background.includes(body.requestId)){backgroundStarted.release();await releaseBackground.waiting;}
   }
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
  }
  const file=path.startsWith('/src/')?resolve(root,'.'+path):null;assert(file&&file.startsWith(root+sep));res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
 }catch(error){res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
 try{await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(async({theme,mode,active,background,commandId})=>{
  const{createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js'),{createServerCommerce}=await import('/src/serverCommerceUI.js');
  let state;const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Native Worker journal required');},onRemoteState:(_,next)=>state=next});state=await saves.load(theme);
  const commerce=createServerCommerce({saves,theme:()=>theme,persist:()=>saves.enqueue(theme,state),applyState:next=>state=next,toast(){}});await commerce.recover();if(!commerce.ready())throw Error('Commerce setup failed');
  const f=window.manualBatch={saves,commerce,jobs:[],theme,state:()=>state,errors:[],barrierDone:false};
  const work=(id,npcId)=>{const promise=saves.action(theme,{kind:'resident',operation:'begin',requestId:id,actorId:npcId,intent:{goal:'plaza',action:'rest',source:'rule',operationId:'qa-'+id}});f.jobs.push(promise);promise.catch(e=>f.errors.push({code:e.code,message:e.message}));};
  document.querySelector('#send').onclick=()=>{const batch=()=>commerce.command('plan_batch',{runId:commandId,day:state.day,plans:[],commands:[{id:commandId,npcId:5,goal:'forest',resource:'wood',quantity:1,intent:'队列验证收木材'}]},{foreground:mode!=='automatic'});f.batch=saves.checkpoint(theme,{foreground:true}).then(()=>{f.checkpointReleased=true;return batch();}).then(()=>document.querySelector('#status').textContent='已登记').catch(e=>{f.batchError=e.code;document.querySelector('#status').textContent=e.code;});};
  work(active,0);work(background[0],1);if(mode==='barrier')f.checkpoint=saves.checkpoint(theme).then(()=>f.barrierDone=true);work(background[1],2);
 },{theme,mode,active,background,commandId});
 await started.waiting;await page.locator('#send').click();assert.equal((await store.current(theme)).state.agentTaskLedger.length,0);
 release.release();
 if(mode==='manual'){await page.waitForFunction(()=>manualBatch.checkpointReleased===true,null,{timeout:5000});row.manualCheckpointAdmittedBeforeBackgroundRelease=true;await backgroundStarted.waiting;releaseBackground.release();await page.waitForFunction(()=>window.manualBatch.state().agentTaskLedger.length===1||window.manualBatch.batchError,null,{timeout:5000});const order=row.order.filter(x=>x.id===active||background.includes(x.id)||x.operation==='plan_batch');assert.equal(order[0].id,active);assert(order.some(x=>x.operation==='plan_batch'));}
 else if(mode==='automatic'||mode==='barrier'){await backgroundStarted.waiting;assert.equal((await store.current(theme)).state.agentTaskLedger.length,0);releaseBackground.release();await page.waitForFunction(()=>window.manualBatch.state().agentTaskLedger.length===1,null,{timeout:5000});const order=row.order.filter(x=>x.id===active||background.includes(x.id)||x.operation==='plan_batch');assert.equal(order[0].id,active);assert.equal(order[1].id,background[0]);if(mode==='automatic')assert.equal(order[2].id,background[1]);else assert(await page.evaluate(()=>manualBatch.barrierDone));}
 else{await page.waitForFunction(()=>window.manualBatch.batchError==='action_pending',null,{timeout:10000});assert(row.order.every(x=>x.id===active||!['begin','plan_batch'].includes(x.operation)));const pending=await page.evaluate(()=>manualBatch.saves.pendingAction(manualBatch.theme));assert.equal(pending.body.requestId,active);assert.equal((await store.current(theme)).state.agentTaskLedger.length,0);}
 releaseBackground.release();hold=false;await page.evaluate(async mode=>{const f=manualBatch;await Promise.allSettled([...f.jobs,f.batch,f.checkpoint]);if(mode==='uncertain'){let rejected;try{await f.saves.idle(f.theme);}catch(e){rejected=e.code;}if(rejected!=='action_pending')throw Error('Uncertain idle must remain blocked');}else await f.saves.idle(f.theme);},mode);
 const reopened=await createSaveStore({directory}).current(theme);row.tasks=reopened.state.agentTaskLedger.filter(t=>t.id===commandId).map(t=>({id:t.id,status:t.status,completed:t.completed}));assert.equal(reopened.state.coins,0);assert.equal(reopened.state.inventory.wood,0);
 if(mode!=='uncertain'){assert.equal(row.tasks.length,1);assert.equal(row.tasks[0].status,'queued');assert.equal(row.tasks[0].completed,0);assert.equal(reopened.actions.receipts.filter(r=>r.ticket.kind==='commerce'&&r.ticket.command==='plan_batch').length,1);assert(row.order.every(r=>!r.foregroundInBody));}
 assert.deepEqual(row.errors,[]);row.noResourceOrCashCreated=true;row.passed=true;
 }catch(error){row.failure=error.stack;row.diagnostic=await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,pending:manualBatch.saves.pendingAction(manualBatch.theme)?.body,errors:manualBatch.errors,commerce:manualBatch.commerce.inspect()})).catch(()=>null);process.exitCode=1;}
 finally{release.release();releaseBackground.release();hold=false;await context.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
}report.passed=report.cases.every(r=>r.passed);}finally{await browser?.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(r=>({theme:r.theme,mode:r.mode,passed:r.passed,failure:r.failure}))}));}
