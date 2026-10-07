import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createFishingEvent} from '../src/fishingParty.js';
import {browserLaunchOptions} from './browserRuntime.mjs';
const out=path.resolve(process.env.HD_QA_OUT||'qa/v111/native-cooperation');await mkdir(out,{recursive:true});
const directory=await mkdtemp(path.join(out,'save-')),store=createSaveStore({directory});
for(const theme of ['pixel','origami']){const state=hydrateTown(createZeroState());state.freshStartPending=false;state.inventory.seed=3;createFishingEvent(state,{name:'居民共筹海风钓鱼会'});await store.open(theme,{legacyState:state,protect:true});}
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const server=spawn(process.execPath,['server.mjs','--port='+port],{windowsHide:true,env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:directory,HD_RUN_LEDGER_DIR:path.join(out,'runs')},stdio:'ignore'}),base='http://127.0.0.1:'+port;
const report={at:new Date().toISOString(),scope:'Isolated initial published fishing-event and 3-seed fixture; no conversations, stories, results, positions, plot stages or game-clock injection. Native resident decisions, route following, local conversations and server work receipts at normal speed; model calls blocked. Not a real-provider or human acceptance run.',cases:[]};let browser;
async function run(theme){
 const row={theme,errors:[],actions:[],samples:[]};report.cases.push(row);
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')||r.request().url().endsWith('/api/status')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated resident verification"}'}));
 const page=await context.newPage(),responses=[];page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().endsWith('/action')&&r.request().method()==='POST'){const q=r.request().postDataJSON();if(['farm','resident','field'].includes(q.kind))responses.push(r.json().then(a=>{if(q.storyId||q.intent?.storyId||a.ticket?.storyId||!r.ok())row.actions.push({at:Date.now(),kind:q.kind,operation:q.operation,status:r.status(),code:a.code,storyId:a.ticket?.storyId,actor:a.ticket?.actorId,step:a.ticket?.step,item:a.ticket?.item,operationId:a.ticket?.operationId,receipt:a.receipt&&{outcome:a.receipt.outcome,gain:a.receipt.gain,cost:a.receipt.cost}})}))}});
 try{
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!document.querySelector('#app').hasAttribute('aria-busy'),null,{timeout:30000});
  let complete;
  for(let tick=0;tick<90;tick++){
   await page.waitForTimeout(10000);const s=await page.evaluate(()=>{const s=window.islandInspect();return {time:s.now,stories:s.residentStories.episodes,meetings:s.meetings,conversations:s.npcConversations,plots:s.plots,inventory:s.inventory,npcs:s.npcs.map(n=>({id:n.id,x:n.x,y:n.y,status:n.status,meeting:n.meeting,inside:n.inside,storyId:n.intent?.storyId,action:n.action,path:n.path,next:n.next})),serverFarm:s.serverFarm,serverResident:s.serverResident,serverFieldNpc:s.serverFieldNpc}});row.samples.push(s);await writeFile(path.join(out,theme+'-progress.json'),JSON.stringify(row,null,2));if(await access(path.join(out,'stop')).then(()=>true,()=>false))throw Error('Stopped after a concrete defect was found; candidate will be repaired and rerun');
   if(tick%3===0)console.log(theme+' t='+Math.round(s.time)+' stories='+s.stories.map(e=>e.people.join('/')+':'+e.status+':'+Object.keys(e.contributions).length).join(',')+' meetings='+s.meetings.map(m=>m.ids.join('/')+':'+m.phase).join(','));
   const resolved=s.stories.find(e=>e.demand&&e.status==='resolved'&&new Set(e.people.map(id=>e.plans[id].resource)).size>1);
   const farm=s.stories.find(e=>e.people.some(id=>e.plans?.[id]?.goal==='farm'&&e.contributions[id]));
   if(resolved&&farm){complete={resolved,farm,time:s.time};break}
   if(row.errors.length)throw Error(row.errors.join('\n'));
  }
  await Promise.all(responses);assert(complete,'native residents must actually resolve distinct-item cooperation and complete a crop delivery within normal game time');row.completed=complete;
  const id=complete.resolved.people[0];await page.locator('#residentsBtn').click();await page.locator('[data-npc="'+id+'"]').click();await page.locator('#residentStoriesOpen').click();await page.screenshot({path:path.join(out,theme+'-journal.png')});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);row.mobile=await page.locator('.resident-stories-modal').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,rows:el.querySelectorAll('[data-story-worker]').length,text:el.textContent}));assert(row.mobile.scroll<=row.mobile.width+1);assert(row.mobile.rows>=2);await page.screenshot({path:path.join(out,theme+'-journal-mobile.png')});
  assert.equal(row.errors.length,0);assert(row.actions.some(a=>a.kind==='farm'&&a.operation==='finish'&&a.receipt?.gain?.wheat>0));row.passed=true;console.log(theme+' native cooperation and farm delivery passed');
 }catch(e){row.failure=e.stack;await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});throw e}finally{await context.close();await writeFile(path.join(out,'progress.json'),JSON.stringify(report,null,2))}
}
try{for(let i=0;i<100;i++){try{if((await fetch(base+'/src/residentCooperation.js')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}browser=await chromium.launch(browserLaunchOptions());const results=await Promise.allSettled(['pixel','origami'].map(run));for(const r of results)if(r.status==='rejected')throw r.reason;report.passed=true}catch(e){report.failure=e.stack;process.exitCode=1}finally{await browser?.close();server.kill();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,passed:report.passed,failure:report.failure,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,failure:c.failure}))}))}
