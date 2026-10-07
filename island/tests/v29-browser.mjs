// Isolated browser integration: real Hermes engines use a local scripted model.
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createProject} from '../src/projectPlans.js';
import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v29',{recursive:true});
const directory=await mkdtemp(resolve('qa/v29/browser-')),requests=[],report={directory,liveProvider:false,modelEndpoint:'local scripted fixture',checks:[],errors:[]};
const mock=createServer(async(req,res)=>{
 if(req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({data:[{id:'deepseek-flash'}]}));return}
 if(req.url!=='/chat/completions'){res.writeHead(404).end();return}
 let raw='';for await(const c of req)raw+=c;const d=JSON.parse(raw),names=(d.tools||[]).map(t=>t.function.name);
 requests.push({model:d.model,tools:names});
 const parent=names.includes('recruitment_delegate'),observe=parent?'recruitment_observe':'recruitment_observe_child',action=parent?'recruitment_delegate':'recruitment_take_step';
 const results=d.messages.filter(m=>m.role==='tool'),called=d.messages.flatMap(m=>m.tool_calls||[]).map(t=>t.function.name);
 let name,args,content;
 if(!called.includes(observe)){name=observe;args={}}
 else if(!called.includes(action)){const c=JSON.parse(results.at(-1).content),step=c.steps.find(s=>s.item==='wood')||c.steps[0];name=action;args={stepIds:[step.id],...(!parent?{intent:'收集约定木材，真实动作后交付'}:{})}}
 else content='已接受工作，到岛后实际收集。';
 const usage={prompt_tokens:100,completion_tokens:10,total_tokens:110,prompt_cache_hit_tokens:20,prompt_cache_miss_tokens:80},id='call-'+requests.length;
 if(d.stream){
  res.writeHead(200,{'content-type':'text/event-stream'});
  const delta=name?{role:'assistant',tool_calls:[{index:0,id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{role:'assistant',content};
  for(const [part,finish] of [[delta,null],[{},name?'tool_calls':'stop']])res.write('data: '+JSON.stringify({id,object:'chat.completion.chunk',model:'deepseek-flash',choices:[{index:0,delta:part,finish_reason:finish}],...(finish?{usage}:{})})+'\n\n');
  res.end('data: [DONE]\n\n');
 }else res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({id,model:'deepseek-flash',choices:[{index:0,message:name?{role:'assistant',content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{role:'assistant',content},finish_reason:name?'tool_calls':'stop'}],usage}));
});
await new Promise(r=>mock.listen(0,'127.0.0.1',r));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,saves=createSaveStore({directory:resolve(directory,'saves')});
for(const theme of ['pixel','origami']){
 const s=hydrateTown(createState());s.coins=50;for(const id of Object.keys(s.inventory))s.inventory[id]=0;
 // Deliberately use legacy states without saveSlot; both must recruit and survive reload.
 assert(createProject(s,{id:'recruit-browser',title:'给码头准备一批木材',targets:{wood:40}}).ok);
 await saves.open(theme,{legacyState:s,clientId:'fixture'});
}
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port,'--theme=origami'],{cwd:resolve('.'),windowsHide:true,stdio:['ignore','pipe','pipe'],
 env:{...process.env,DEEPSEEK_API_KEY:'fixture-key-not-secret',HD_MODEL_ENDPOINT:'http://127.0.0.1:'+mock.address().port,HD_SAVE_DIR:resolve(directory,'saves'),HD_HERMES_HOME:resolve(directory,'home'),HD_STEWARD_WORKDIR:resolve(directory,'documents')}});
let logs='',browser,page;server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=30000){const start=Date.now();while(Date.now()-start<timeout){const r=await fn();if(r)return r;await wait(200)}throw Error('condition timed out after '+timeout)}
async function api(theme,op){const r=await fetch(base+'/api/recruitment/'+theme+'/'+op);const d=await r.json();assert(r.ok,JSON.stringify(d));return d}
try{
 await until(async()=>{try{return(await fetch(base+'/api/status')).ok}catch{return false}},10000);
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await browser.newContext({viewport:{width:1440,height:950}});
  await context.route('**/api/**',route=>{const url=route.request().url();return ['/api/saves/','/api/recruitment/','/api/status'].some(x=>url.includes(x))?route.continue():route.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated browser QA"}'})});
  page=await context.newPage();page.on('pageerror',e=>report.errors.push({theme,message:e.message,stack:e.stack}));
  await page.goto(base+'/?qa=1&theme='+theme);
  const inspect=()=>page.evaluate(()=>window.islandInspect()),open=async()=>{await page.locator('#stewardBtn').click();await page.locator('#stewardRecruit').click()};
  await open();await page.locator('#recruitHire').waitFor();
  await page.waitForFunction(()=>window.islandInspect().contentArts.loaded.every(x=>x.ready));
  await page.screenshot({path:'qa/v29/'+theme+'-recruit.png'});
  assert.match(await page.locator('.recruit-hero').textContent(),/小麦/);assert.equal(await page.locator('.recruit-portrait .half-portrait').count(),1);
  await page.setViewportSize({width:390,height:780});
  assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  await page.screenshot({path:'qa/v29/'+theme+'-recruit-compact.png'});
  await page.setViewportSize({width:1440,height:950});
  await page.locator('#recruitHire').click();
  const a=await until(async()=>{const s=await inspect();return s.recruitment?.active},45000);assert.equal(a.world,'legacy-'+theme);
  assert.equal((await inspect()).npcs.length,17);
  await page.locator('details[data-history="edit"] summary').click();await page.locator('#recruitEdit-name').fill('小麦同学');await page.locator('#recruitEdit-personality').fill('细致耐心，先做清单中最急的工作');await page.locator('#recruitSaveProfile').click();
  await until(async()=>(await inspect()).recruitment.active.profile.version===2);assert.equal((await api(theme,'status')).active.profileEdits.length,1);
  assert.match(await page.locator('.recruit-editor').textContent(),/小麦 → 小麦同学/);assert.equal((await inspect()).resourceLedger.reservations['hire:'+a.id].items.coins,8);
  report.checks.push({theme,flow:'real parent and child engines accepted a saved project; legacy world bound; one visible recruitment card and held wage',parent:a.parentRunId,child:a.childRunId});
  console.log(theme+': hired '+a.id);
  await page.locator('#closeModal').click();
  await until(async()=>['landing','working'].includes((await inspect()).recruitment?.active?.phase),45000);
  // Persist and reload through the real UI. No direct mutation of application state.
  await page.locator('#saveStatus').click();await page.locator('#saveNow').click();
  await until(async()=>{const d=await saves.current(theme);return d.state.recruitment?.active?.id===a.id});
  await page.reload();await page.waitForFunction(()=>window.islandInspect);
  assert.equal((await inspect()).recruitment.active.id,a.id);assert.equal((await inspect()).recruitment.active.profile.name,'小麦同学');
  const delivered=await until(async()=>{const s=await inspect();const n=s.agentTaskLedger.flatMap(t=>t.evidence||[]).filter(e=>e.contractId===a.id).reduce((n,e)=>n+e.amount,0);return n>0&&n},180000);
  console.log(theme+': actual delivery '+delivered);
  await open();await page.locator('details[data-history="active"] summary').click();await page.screenshot({path:'qa/v29/'+theme+'-working.png'});
  await page.locator('#recruitCancel').click();await page.locator('#closeModal').click();
  const done=await until(async()=>{const d=await api(theme,'status');return d.history?.find(h=>h.id===a.id&&h.phase==='departed')},180000);
  assert(done.delivery.delivered>0);assert.equal(done.delivery.fee,Math.ceil(8*done.delivery.delivered/done.delivery.quantity));assert(done.delivery.hasArrived);
  await until(async()=>!(await inspect()).recruitment.active);
  assert.equal((await inspect()).npcs.length,16);
  const doc=await until(async()=>{const d=await saves.current(theme);return d.state.recruitment?.history?.some(h=>h.id===a.id)&&d});
  assert.equal(doc.state.economy.cashLedger.filter(e=>e.category==='recruitment').length,1);
  await open();await until(async()=>/实际交付/.test(await page.locator('.recruit-history').textContent()));assert.match(await page.locator('.recruit-history').textContent(),/小麦 → 小麦同学/);
  await page.locator('.modal-body').evaluate(el=>el.scrollTop=el.scrollHeight);assert(await page.locator('#closeModal').isVisible());
  report.checks.push({theme,flow:'actual ship/walk/work, server save/reload, partial cancellation, handover, one prorated payment, departure receipt, free seat and saved history',delivery:done.delivery});
  assert.equal((await api(theme,'status')).active,null);await context.close();
 }
 assert.equal(requests.length,12);assert(requests.every(r=>r.model==='deepseek-flash'&&r.tools.length===2));assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;if(page&&!page.isClosed()){await page.screenshot({path:'qa/v29/browser-failure.png'}).catch(()=>{});report.snapshot=await page.evaluate(()=>window.islandInspect?.()).catch(()=>null)}throw e}
finally{
 await browser?.close();server.kill();mock.closeAllConnections();await new Promise(r=>mock.close(r));report.requests=requests;
 await writeFile('qa/v29/browser-report.json',JSON.stringify(report,null,2));if(!report.passed)await writeFile('qa/v29/browser-failure.log',logs);
}
console.log(JSON.stringify({passed:report.passed,checks:report.checks}));
