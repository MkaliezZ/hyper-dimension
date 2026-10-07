import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {hydrateJourney,trackJourney} from '../src/journey.js';
import {recordPlayerGoods} from '../src/economy.js';
import {solvePacking} from './v18-play-helpers.mjs';
import {CATALOG_ITEMS} from '../src/contentCatalog.js';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report=[];await mkdir('qa/v21',{recursive:true});
async function pageFor(port,s=hydrateTown(createState()),route=null){
 const p=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/**',async r=>route&&r.request().url().endsWith('/api/hermes/command')?route(r):r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated QA"}'}));
 await p.addInitScript(s=>{const k='hyper-dimension-'+(location.port==='4173'?'pixel':'origami')+'-v3';if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify(s));},s);
 await p.goto('http://127.0.0.1:'+port+'/?qa=1');return {p,errors};
}
const inspect=p=>p.evaluate(()=>window.islandInspect());
const overflow=p=>p.evaluate(()=>[...document.querySelectorAll('.modal,.steward-thread,.steward-message-text,.steward-composer,.journal-layout')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>e.className));
async function clickScene(p,point){
 const pos=await p.evaluate(point=>{const s=window.islandInspect(),b=document.querySelector('#game').getBoundingClientRect(),scale=Math.max(b.width/1000,b.height/660)*s.zoom;return {x:b.x+b.width/2+(point.x-s.camera.x)*scale,y:b.y+b.height/2+(point.y-s.camera.y)*scale}},point);
 await p.mouse.click(pos.x,pos.y);
}
try{
for(const port of [4173,4174]){
 const theme=port===4173?'pixel':'origami';
 {
 const requests=[];let n=0;
 const {p,errors}=await pageFor(port,undefined,async r=>{
  const body=r.request().postDataJSON();requests.push(body);n++;
  if(n===3)return r.fulfill({status:503,contentType:'application/json',body:'{"error":"测试断线"}'});
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer:n===1?'先从一盏灯开始。已请岩岩去采木材，完成后才会入库。':'记得，你刚才想准备一盏灯。<img src=x onerror=alert(1)> 会作为普通文字保存。',source:'hermes',commands:n===1?[{id:'qa-wood',npcId:11,goal:'forest',resource:'wood',intent:'采集夜集需要的木材',source:'hermes'}]:[]})});
 });
 await p.waitForTimeout(450);
 const right=await p.evaluate(()=>['.business-panel','.game-toolbar','.theme-switch'].map(x=>document.querySelector(x).getBoundingClientRect().right));
 assert(Math.max(...right)-Math.min(...right)<2);
 await p.locator('#journeyNext').click();assert((await inspect(p)).journey.stats.met);
 assert.equal(requests.length,0,'opening the steward never spends a model call');
 await p.locator('[data-steward-prompt]').first().click();assert.equal(requests.length,0,'suggestion fills draft only');
 await p.locator('#hermesInput').fill('帮我准备一盏灯，请安排采木材。');await p.locator('#hermesSend').click();
 await p.locator('.steward-message.assistant.done').waitFor();assert.equal(requests[0].history.length,0);assert.equal(requests[0].journey.step,'种下第一片希望');
 await p.locator('#hermesInput').fill('然后呢？');await p.locator('#hermesInput').press('Enter');
 await p.waitForFunction(()=>window.islandInspect().chat.messages.filter(m=>m.role==='assistant'&&m.status==='done').length===2);
 assert.equal(requests[1].history.length,2);assert.equal(requests[1].history[0].content,'帮我准备一盏灯，请安排采木材。');
 assert.equal(await p.locator('.steward-message-text img').count(),0);
 await p.screenshot({path:'qa/v21/'+theme+'-conversation.png'});
 await p.locator('#closeModal').click();await p.locator('#stewardBtn').click();assert.equal(await p.locator('.steward-message.user').count(),2);
 await p.locator('#hermesInput').fill('任务完成了吗？');await p.locator('#hermesSend').click();await p.locator('.steward-message.error').waitFor();
 await p.locator('[data-retry]').last().click();await p.waitForFunction(()=>window.islandInspect().chat.messages.filter(m=>m.role==='assistant'&&m.status==='done').length===3);
 assert.equal(await p.locator('.steward-message.user').count(),3,'retry does not duplicate the user turn');assert.equal(requests[3].retryModel,true);
 await p.reload();await p.locator('#stewardBtn').click();assert.equal(await p.locator('.steward-message.user').count(),3,'history survives reload');
 assert((await inspect(p)).agentTaskLedger.some(x=>x.status==='interrupted'),'unfinished jobs are not falsely marked complete after reload');
 await p.setViewportSize({width:390,height:780});await p.screenshot({path:'qa/v21/'+theme+'-conversation-mobile.png'});assert.deepEqual(await overflow(p),[]);
 const send=await p.locator('#hermesSend').boundingBox();assert(send.y+send.height<780);
 await p.locator('#closeModal').click();await p.locator('#mobileJournal').click();await p.screenshot({path:'qa/v21/'+theme+'-journal-mobile.png'});assert.deepEqual(await overflow(p),[]);
 await p.locator('.modal-body').evaluate(el=>el.scrollTop=el.scrollHeight);const close=await p.locator('#closeModal').boundingBox();assert(close.y>=0&&close.y+close.height<780);
 assert.deepEqual(errors,[]);report.push({theme,flow:'conversation',history:true,retry:true,escapedText:true,resume:true,aligned:true,mobile:true,errors});await p.close();
 }
 {
 const s=hydrateTown(createState());hydrateJourney(s);
 for(const i of CATALOG_ITEMS)s.inventory[i.id]=99;
 trackJourney(s,'meet');trackJourney(s,'water');trackJourney(s,'gather',{item:'wood',amount:4});trackJourney(s,'gather',{item:'ore',amount:2});
 const {p,errors}=await pageFor(port,s);
 // A real workshop completion, player animation and stock commit unlock the first ceremony.
 await p.locator('#journeyNext').click();await p.locator('#itemCraft').click();await p.locator('.room-game').waitFor({timeout:20000});
 await solvePacking(p,()=>p.evaluate(()=>window.islandInspect().roomGame));
 await p.getByRole('button',{name:'领取制作成果',exact:true}).click();
 await p.waitForFunction(()=>window.islandInspect().journey?.ready.light,{timeout:8000});
 assert.equal((await inspect(p)).journey.stats.crafted.lantern,1);
 await p.locator('#closeModal').click();await p.locator('#journeyNext').click();await p.locator('#momentOverlay').waitFor();
 const seed=(await inspect(p)).inventory.seed;await p.waitForTimeout(3300);await p.screenshot({path:'qa/v21/'+theme+'-first-light.png'});
 await p.evaluate(()=>window.oldMomentClaim=document.querySelector('#momentClaim'));await p.locator('#momentClaim').click();await p.evaluate(()=>window.oldMomentClaim.click());
 assert.equal((await inspect(p)).inventory.seed,seed+2);assert((await inspect(p)).journey.claimed.light);
 await p.locator('#journalOpen').click();await p.screenshot({path:'qa/v21/'+theme+'-journal.png'});
 assert.equal(await p.locator('[data-moment="light"]').count(),0);await p.locator('#closeModal').click();
 await p.locator('#playerBtn').click();assert.match(await p.locator('.journey-medals').textContent(),/首盏星灯/);
 assert.deepEqual(errors,[]);report.push({theme,flow:'first-real-craft',momentOnce:true,profileMedal:true,errors});await p.close();
 }
 {
 const s=hydrateTown(createState());hydrateJourney(s);s.plots[0]={stage:4,growth:180,crop:'wheat',playerTended:true};s.inventory.lantern=4;
 recordPlayerGoods(s,'wood',3);
 const {p,errors}=await pageFor(port,s);
 // Claiming a real order triggers the second milestone.
 await p.locator('#businessBtn').click();await p.locator('[data-town-order="0"]').click();
 assert((await inspect(p)).journey.ready.trade);await p.locator('#closeModal').click();
 // Invite through actual resident cards and complete all party rounds.
 await p.locator('#residentsBtn').click();
 // Harvest through the world-coordinate canvas, then invite with the earned wheat.
 await p.locator('[data-go="farm"]').click();await p.waitForFunction(()=>window.islandInspect().scene==='farm',{timeout:20000});
 const q=(await inspect(p)).farmPlots[0],point={x:q.corners.reduce((a,v)=>a+v.x,0)/4,y:q.corners.reduce((a,v)=>a+v.y,0)/4};
 await clickScene(p,point);await p.waitForFunction(()=>window.islandInspect().journey?.stats.harvested>0,{timeout:20000});
 assert((await inspect(p)).journey.completed.harvest);
 await p.locator('#residentsBtn').click();if(!await p.locator('[data-npc="0"]').isVisible())await p.locator('#residentsBtn').click();
 for(const id of [0,2]){await p.locator('[data-npc="'+id+'"]').click();await p.locator('#inviteNpc').click()}
 await p.locator('#partyBtn').click();await p.locator('#hostParty').click();
 for(let i=0;i<4;i++)await p.locator('#launchLantern').click();
 await p.waitForFunction(()=>window.islandInspect().journey?.ready.festival,{timeout:8000});
 await p.locator('#helpBtn').click();await p.locator('[data-moment="festival"]').click();await p.waitForTimeout(4000);
 await p.screenshot({path:'qa/v21/'+theme+'-festival.png'});await p.locator('#momentLater').click();
 assert(!(await inspect(p)).journey.claimed.festival);await p.reload();await p.locator('#helpBtn').click();await p.locator('[data-moment="festival"]').click();
 await p.setViewportSize({width:390,height:780});await p.screenshot({path:'qa/v21/'+theme+'-festival-mobile.png'});await p.locator('#momentClaim').click();
 assert((await inspect(p)).journey.claimed.festival);assert.deepEqual(errors,[]);
 report.push({theme,flow:'harvest-order-party',realOrder:true,realHarvest:true,realParty:true,pendingSurvivesReload:true,errors});await p.close();
 }
}
await writeFile('qa/v21/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close()}

