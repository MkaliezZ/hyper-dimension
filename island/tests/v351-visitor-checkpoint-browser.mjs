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

const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v351/visitor-checkpoint');await mkdir(out,{recursive:true});
const gate=()=>{let release;return{promise:new Promise(r=>release=r),release:()=>release()};};
const report={scope:'Owned native SaveClient/Worker/IndexedDB, visitor and commerce controllers, actual HTTP SaveStore and disk. Hold one accepted resident response and later background responses. A user checkpoint must acknowledge the actual chat input before those unstarted operations. No real model, clock acceleration, user browser or human acceptance.',cases:[],passed:false};
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami']){
  const row={theme,requests:[],errors:[],passed:false};report.cases.push(row);
  const directory=await mkdtemp(join(out,theme+'-')),store=createSaveStore({directory}),seed=hydrateTown(createZeroState());seed.freshStartPending=false;await store.open(theme,{legacyState:seed,protect:true});
  const active=randomUUID(),background=[randomUUID(),randomUUID(),randomUUID()],entered=gate(),release=gate(),releaseBackground=gate();let holding=true;
  const server=createServer(async(req,res)=>{try{
   const path=new URL(req.url,'http://owned').pathname;
   if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><button id="send">交给管家</button>');}
   if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
   if(path.startsWith('/api/saves/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString()||'{}'),operation=path.split('/')[4];
    const result=operation==='open'?await store.open(theme,body):operation==='save'?await store.save(theme,body):operation==='action'?await store.action(theme,body):{document:await store.current(theme)};
    row.requests.push({operation,kind:body.kind,command:body.operation,requestId:body.requestId});
    if(holding&&body.requestId===active){entered.release();await release.promise;}
    if(holding&&background.includes(body.requestId))await releaseBackground.promise;
    res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
   }
   const file=resolve(root,'.'+path);assert(path.startsWith('/src/')&&file.startsWith(root+sep));res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
  }catch(error){res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.evaluate(async({theme,active,background})=>{
    const{createSaveClient}=await import('/src/saveClient.js'),{createServerVisitor}=await import('/src/serverVisitorUI.js'),{createServerCommerce}=await import('/src/serverCommerceUI.js');let state;
    const saves=createSaveClient({loadLocal:()=>({saveSlot:'hyper-dimension-'+theme+'-v3',workshopBests:{}}),storeLocal(){throw Error('Native worker journal required');},onRemoteState:(_,next)=>state=next});state=await saves.load(theme);
    const props={saves,theme:()=>theme,persist:()=>saves.enqueue(theme,state),applyState:next=>state=next,restore(){},toast(){}};
    const visitor=createServerVisitor(props),commerce=createServerCommerce(props);await visitor.recover();await commerce.recover();
    const f=window.visitorCheckpoint={saves,theme,visitor,commerce,jobs:[],submitted:false,errors:[],state:()=>state};
    const watch=p=>{f.jobs.push(p);p.catch(e=>f.errors.push({code:e.code,message:e.message}));return p;};
    const work=(id,npcId)=>watch(saves.action(theme,{kind:'resident',operation:'begin',requestId:id,actorId:npcId,intent:{goal:'plaza',action:'rest',source:'rule',operationId:'owned-'+id}}));
    work(active,0);for(const[id,index]of background.map((id,index)=>[id,index]))work(id,index+1);
    // The arrival check is autonomous. It must not create a separate user-style
    // ordering barrier ahead of a user checkpoint and all the older NPC work.
    watch(visitor.command('arrive'));
    document.querySelector('#send').onclick=()=>{
     state.stewardChat??={messages:[]};state.stewardChat.messages.push({id:'actual-user-input',role:'user',text:'请登记顺序分工',status:'sent',day:state.day});saves.enqueue(theme,state);
     f.checkpoint=watch(saves.checkpoint(theme,{foreground:true}).then(()=>{f.submitted=true;}));
    };
   },{theme,active,background});
   await entered.promise;await page.locator('#send').click();assert.equal(await page.evaluate(()=>visitorCheckpoint.submitted),false,'An accepted active transaction still blocks the user');
   release.release();await page.waitForFunction(()=>visitorCheckpoint.submitted,null,{timeout:5000});
   const acknowledged=await store.current(theme);assert.equal(acknowledged.state.stewardChat.messages[0].id,'actual-user-input');
   assert(!row.requests.some(r=>r.command==='arrive'),'No arrival can bypass its own current authoritative eligibility');row.inputActuallyAcknowledgedBeforeQueuedBackgroundReplies=true;
   holding=false;releaseBackground.release();await page.evaluate(async()=>{const f=visitorCheckpoint;await Promise.allSettled(f.jobs);await f.saves.idle(f.theme);});
   const result=await page.evaluate(()=>({errors:visitorCheckpoint.errors,visitor:visitorCheckpoint.visitor.inspect(),pending:visitorCheckpoint.saves.pendingAction(visitorCheckpoint.theme)}));
   assert.deepEqual(result.errors.map(e=>e.code),['visitor_early']);assert.equal(result.visitor.locked,false);assert.equal(result.pending,null);
   const final=await createSaveStore({directory}).current(theme);assert.equal(final.state.coins,0);assert(Object.values(final.state.inventory).every(n=>n===0));assert.equal(final.state.stewardChat.messages[0].id,'actual-user-input');assert.deepEqual(row.errors,[]);
   row.earlyArrivalStillRejected=true;row.noUncertainCommandCreated=true;row.noCashOrMaterialsCreated=true;row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{holding=false;release.release();releaseBackground.release();await page.evaluate(async()=>{await Promise.allSettled(window.visitorCheckpoint?.jobs||[]);}).catch(()=>{});await context.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(row=>row.passed);
}finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
