import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {hydrateJourney,trackJourney} from '../src/journey.js';
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const report=[];
try{
 for(const port of [4173,4174]){
 const theme=port===4173?'pixel':'origami',p=await b.newPage({viewport:{width:1440,height:950}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/**',r=>r.fulfill(r.request().url().endsWith('/api/hermes/command')?{status:200,contentType:'application/json',body:JSON.stringify({source:'hermes',answer:'已请岩岩去采木材，到场并完成后会回报。',commands:[{id:'actual-path-wood',npcId:11,goal:'forest',resource:'wood',intent:'采集一份夜集木材',source:'hermes'}]})}:{status:503,contentType:'application/json',body:'{"error":"isolated QA"}'}));
 await p.clock.install();await p.goto('http://127.0.0.1:'+port+'/?qa=1');await p.locator('#stewardBtn').click();await p.locator('#hermesInput').fill('安排岩岩采木材');await p.locator('#hermesSend').click();await p.locator('.steward-message.done').waitFor();
 assert.equal(await p.evaluate(()=>window.islandInspect().agentTaskLedger[0].status),'queued');
 await p.clock.runFor(38000);
 const v=await p.evaluate(()=>window.islandInspect());assert.equal(v.agentTaskLedger[0].status,'done');assert.match(v.agentTaskLedger[0].result,/木材/);assert.equal(v.journey.stats.gathered.wood,undefined,'NPC work never counts as player gathering');
 assert.match(await p.locator('#stewardTasks').textContent(),/已完成/);
 await p.screenshot({path:'qa/v21/'+theme+'-task-completed.png'});assert.deepEqual(errors,[]);
 report.push({theme,realNPCPathAndAction:true,completedReceipt:true,personalCreditUnaffected:true,errors});await p.close();
 // Inspect the remaining two ceremonies, using legitimate achieved-condition fixtures.
 const q=await b.newPage({viewport:{width:1280,height:900}});
 await q.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated QA"}'}));
 const s=hydrateTown(createState());hydrateJourney(s);trackJourney(s,'order');trackJourney(s,'party');for(let id=0;id<5;id++)trackJourney(s,'craft',{item:'recipe-product-'+id,building:id});s.economy.arrivals=12;
 for(let id=0;id<3;id++){s.facilities[id].quality=60;s.facilities[id].upgrades=1;s.facilities[id].condition=100}
 await q.addInitScript(s=>localStorage.setItem('hyper-dimension-'+(location.port==='4173'?'pixel':'origami')+'-v3',JSON.stringify(s)),s);
 await q.goto('http://127.0.0.1:'+port+'/?qa=1');
 for(const id of ['trade','signature']){
  await q.locator('#helpBtn').click();await q.locator('[data-moment="'+id+'"]').click();await q.waitForTimeout(3600);await q.screenshot({path:'qa/v21/'+theme+'-'+id+'.png'});
  assert.equal(await q.locator('.game-toolbar').isVisible(),false,'HUD clears for the performance');await q.locator('#momentClaim').click();
  assert(await q.evaluate(id=>!!window.islandInspect().journey.claimed[id],id));
 }
 await q.close();
 }
 await writeFile('qa/v21/task-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close()}

