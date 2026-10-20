import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v331/native-manual-controls');await mkdir(out,{recursive:true});
const load=f=>import(pathToFileURL(join(root,f))),{chromium}=await load('node_modules/playwright-core/index.mjs'),{browserLaunchOptions}=await load('tests/browserRuntime.mjs'),{createSaveStore}=await load('server/saveStore.mjs'),{createZeroState}=await load('src/freshStart.js'),{hydrateTown}=await load('src/townSimulation.js');
const hash=b=>createHash('sha256').update(b).digest('hex'),manifest=JSON.parse(await readFile(join(root,'release-manifest.json'),'utf8'));
for(const name of ['src/app.js','src/residentRuntime.js','src/serverCommerceUI.js'])assert.equal(hash(await readFile(join(root,name))),manifest.files.find(f=>f.path===name).sha256);
const report={scope:'Actual SaveClient/commerce/runtime and actual app project-UI binding expression,strict Worker IndexedDB,HTTP SaveStore/disk and native button. A declared ready one-wood plan and three real personal-avatar transactions isolate queue ordering. Hold already committed replies,do not fabricate success. Test explicit manual claim with actual application binding and automatic/earlier-barrier negatives. Positive local-priority observation has an8sec bound;original application HTTP budgets remain unchanged. Canonical single release and no gain,original request identity and local-only priority checked. No map/providers/user saves,natural growth or hosted recovery claim.',cases:[],passed:false,wholeGoalComplete:false};
const persist=()=>writeFile(join(out,'report.json'),JSON.stringify(report,null,2)),gate=()=>{let release;return{promise:new Promise(r=>release=r),release:()=>release()};};
const browser=await chromium.launch(browserLaunchOptions());
try{for(const theme of ['origami','pixel'])for(const mode of ['manual','automatic','barrier']){
 const row={theme,mode,requests:[],errors:[],passed:false};report.cases.push(row);const directory=await mkdtemp(join(out,theme+'-'+mode+'-')),store=createSaveStore({directory}),seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.saveSlot='hyper-dimension-'+theme+'-v3';seed.inventory.wood=1;await store.open(theme,{legacyState:seed,protect:true});
 const action=async input=>store.action(theme,{requestId:randomUUID(),expectedVersion:(await store.current(theme)).version,day:1,...input});
 for(const input of [{kind:'personal',operation:'enable'},{kind:'commerce',operation:'enable'},{kind:'commerce',operation:'hire_enable'},{kind:'commerce',operation:'plan_enable'}])await action(input);
 const projectId=randomUUID();await action({kind:'commerce',operation:'plan_create',project:{id:projectId,title:'明示就绪木材清单',targets:{wood:1}}});assert.equal((await store.current(theme)).state.workProjects[0].status,'ready');
 const heldFirst=gate(),heldRest=gate(),enteredFirst=gate();let armed=false,avatars=0;
 const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://owned').pathname;if(path==='/favicon.ico'){res.writeHead(204);return res.end();}if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><button id="claim">完成筹备 · 物资入库</button><p id="status"></p>');}
  if(path.startsWith('/api/saves/')){
   const chunks=[];for await(const c of req)chunks.push(c);const body=chunks.length?JSON.parse(Buffer.concat(chunks)):undefined,op=path.split('/')[4]||'read';const e={op,kind:body?.kind,operation:body?.operation,requestId:body?.requestId,at:Date.now(),foregroundInBody:body?Object.hasOwn(body,'foreground'):false};row.requests.push(e);
   const result=op==='open'?await store.open(theme,body):op==='save'?await store.save(theme,body):op==='action'?await store.action(theme,body):{document:await store.current(theme)};
   e.committedAt=Date.now();if(armed&&body?.kind==='personal'&&body.operation==='avatar'){avatars++;if(avatars===1){enteredFirst.release();await heldFirst.promise;}else await heldRest.promise;}
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
  }
  const file=resolve(root,'.'+path);assert(path.startsWith('/src/')&&file.startsWith(root+sep));res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
 }catch(error){row.errors.push({message:error.message,code:error.code});res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push({message:e.message}));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(async({theme,projectId,mode})=>{
   const{createSaveClient}=await import('/src/saveClient.js'),{createServerCommerce}=await import('/src/serverCommerceUI.js'),{createResidentRuntime}=await import('/src/residentRuntime.js'),{createZeroState}=await import('/src/freshStart.js');let state;
   const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Strict native journal required');},onRemoteState:(_,s)=>state=s});state=await saves.load(theme);
   const commerce=createServerCommerce({saves,theme:()=>theme,persist:()=>saves.enqueue(theme,state),applyState:s=>state=s,toast(){}});await commerce.recover();assertReady();
   function assertReady(){if(!commerce.ready())throw Error('Actual commerce not ready');}
   const runtime=createResidentRuntime({npcs:[],getState:()=>state,profile:()=>({}),followPath(){},onChange:()=>saves.enqueue(theme,state),onEvent(){},getEnvironment:()=>null,planningRemote:async(operation,args,options)=>(await commerce.command(operation==='assign'?'plan_assign':'plan_control',{day:state.day,projectId:args.id,control:args.action},options)).receipt.details});
   const app=await(await fetch('/src/app.js')).text(),segment=app.slice(app.lastIndexOf('projectUI=createProjectUI')),binding=segment.match(/manage:(.*?),refresh:/)?.[1];if(!binding)throw Error('Actual app binding absent');
   const manual=Function('runtime','return ('+binding+')')(runtime),fixture=window.controlFixture={saves,commerce,runtime,theme,state:()=>state,background:[]};
   document.querySelector('#claim').onclick=()=>{fixture.claim=(mode==='automatic'?runtime.manageProject(projectId,'finish'):manual(projectId,'finish')).then(r=>{fixture.done=r.ok;document.querySelector('#status').textContent=r.ok?'已入库':'未入库';}).catch(e=>{fixture.error=e.message;});};
   fixture.enqueue=()=>{for(let i=1;i<=3;i++)fixture.background.push(saves.action(theme,{kind:'personal',operation:'avatar',target:'butler',avatarId:'male_'+i,day:1,requestId:crypto.randomUUID()}));if(mode==='barrier')fixture.barrier=saves.checkpoint(theme);};
  },{theme,projectId,mode});armed=true;await page.evaluate(()=>controlFixture.enqueue());await enteredFirst.promise;
  await page.locator('#claim').click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>!!controlFixture.done),false,'Foreground cannot overtake an active accepted transaction');heldFirst.release();
  if(mode==='manual')await page.waitForFunction(()=>controlFixture.done||controlFixture.error,null,{timeout:8000});else await page.waitForTimeout(1000);row.claimBeforeUnstartedBackgroundRelease=await page.evaluate(()=>({done:!!controlFixture.done,error:controlFixture.error||null}));
  assert.equal(row.claimBeforeUnstartedBackgroundRelease.done,mode==='manual','Only explicit manual UI controls may pass unstarted background work;automatic and earlier checkpoints retain order');assert.equal(row.claimBeforeUnstartedBackgroundRelease.error,null);
  heldRest.release();await page.waitForFunction(()=>controlFixture.done||controlFixture.error,null,{timeout:10000});assert.equal(await page.evaluate(()=>controlFixture.error||null),null);await page.evaluate(()=>Promise.all([...controlFixture.background,controlFixture.claim,controlFixture.barrier].filter(Boolean)));await page.evaluate(()=>controlFixture.saves.checkpoint(controlFixture.theme));
  const canonical=await store.current(theme);assert.equal(canonical.state.workProjects[0].status,'completed');assert.equal(canonical.state.inventory.wood,1);assert.equal(canonical.state.coins,0);assert.equal(canonical.state.butlerAvatar,'male_3');
  const controls=row.requests.filter(r=>r.operation==='plan_control');assert.equal(controls.length,1);assert(!controls[0].foregroundInBody);assert.equal(new Set(controls.map(r=>r.requestId)).size,1);assert.deepEqual(row.errors,[]);
  row.order=row.requests.filter(r=>r.op==='action').map(r=>r.operation);row.singleCanonicalRelease=true;row.noResourceOrCashGain=true;row.passed=true;
 }catch(error){row.failure=error.stack;process.exitCode=1;}
 finally{heldFirst.release();heldRest.release();await context.close();await new Promise(r=>server.close(r));await persist();}
}report.passed=report.cases.every(r=>r.passed);
}finally{await browser.close();await persist();console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,mode,passed,failure,claimBeforeUnstartedBackgroundRelease,order})=>({theme,mode,passed,failure,claimBeforeUnstartedBackgroundRelease,order}))},null,2));}
