import {chromium} from 'playwright-core';import {spawn} from 'node:child_process';import {createServer} from 'node:http';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {createSaveStore} from '../server/saveStore.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {hydrateJourney} from '../src/journey.js';import {queueTask} from '../src/taskBoard.js';
import {hydratePlacements,decorate,checkDecoration} from '../src/placements.js';import {hydrateFunctionalFacilities,functionalCommand} from '../src/functionalFacilities.js';
const out='qa/v48/npc-feedback';await mkdir(out,{recursive:true});const directory=await mkdtemp(resolve(out+'/browser-')),store=createSaveStore({directory}),unitIds={};
for(const theme of ['pixel','origami']){
 const s=hydrateTown(createZeroState());hydrateJourney(s);s.freshStartPending=false;s.inventory.seed=3;s.inventory.hoe=1;s.inventory.watering_can=1;s.inventory.sickle=1;s.coins=500;
 for(let i=0;i<17;i++)s.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};
 for(let i=1;i<8;i++)s.plots[i]={stage:3,growth:0,crop:'cotton'};s.plots[1]={stage:4,growth:180,crop:'wheat'};s.plots[2]={stage:2,growth:0,crop:'herb'};
 queueTask(s,{id:'browser-farm-task',npcId:0,goal:'farm',intent:'收集小麦',quantity:2},{targetItem:'wheat'});
 hydratePlacements(s,theme);hydrateFunctionalFacilities(s);s.inventory.c14_6=1;s.inventory.c6_5=1;let pos;
 for(let y=624;y<790&&!pos;y+=16)for(let x=344;x<640;x+=16)if(checkDecoration(s,{item:'c14_6',x,y,rotation:0},{theme}).ok){pos={x,y};break}assert(pos);
 const placed=decorate(s,{commandId:'browser-place',action:'place',item:'c14_6',...pos,rotation:0},{theme});assert(placed.ok);unitIds[theme]=placed.id;hydrateFunctionalFacilities(s);
 assert(functionalCommand(s,{commandId:'browser-filter',displayId:placed.id,action:'load',expectedRevision:s.functionalFacilities.revision}).ok);
 assert(functionalCommand(s,{commandId:'browser-connect',displayId:placed.id,action:'configure',targets:[2],enabled:true,expectedRevision:s.functionalFacilities.revision}).ok);
 const d=(await store.open(theme,{legacyState:s})).document;await store.action(theme,{kind:'farm',operation:'enable',requestId:randomUUID(),expectedVersion:d.version});
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={at:new Date().toISOString(),directory,scope:'Actual dual-theme NPC work animation, committed harvest/task delivery and displayed receipt feedback. Isolated fixture seed/tools, one task and one loaded irrigation; no production save writes or model providers. Scripted play is not human skill/economy evidence.',themes:[],errors:[]};let browser;const pages=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/src/app.js')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 await Promise.all(['pixel','origami'].map(async theme=>{
  const context=await browser.newContext({viewport:{width:1440,height:960}});await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated farm QA"}'}));
  const page=await context.newPage();pages.push({theme,page});page.on('pageerror',e=>report.errors.push(theme+': '+e.message));await page.goto(base+'/?qa=1&scene=farm&theme='+theme);await page.waitForFunction(()=>!!window.islandInspect&&!!window.islandInspect().serverFarm);
  await page.waitForFunction(()=>window.islandInspect().agentTaskLedger.find(t=>t.id==='browser-farm-task')?.status==='done',{},{timeout:90000});
  await page.waitForFunction(()=>window.islandInspect().npcs[0].status.includes('收获小麦'),{},{timeout:5000});
  const displayed=(await page.evaluate(()=>window.islandInspect().npcs[0])).status;assert(!displayed.includes('进度已经变化'));
  const doc=await store.current(theme),task=doc.state.agentTaskLedger.find(t=>t.id==='browser-farm-task');assert.equal(task.completed,2);assert.equal(task.evidence.length,1);const paid=doc.actions.receipts.find(r=>r.ticket.actor==='npc'&&r.ticket.index===1&&r.outcome==='finished');assert(paid);
  report.themes.push({theme,displayed,npcActualTaskDelivery:true,npcReceiptFeedback:true,uniqueEvidence:true});
  await page.screenshot({path:out+'/'+theme+'-npc-delivery.png'});
  console.log(theme+' NPC feedback passed');await context.close();
 }));
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;for(const {theme,page}of pages){await page.screenshot({path:out+'/'+theme+'-farm-failure.png'}).catch(()=>{});report[theme]=await page.evaluate(()=>window.islandInspect?.()).catch(()=>null)}}
finally{await browser?.close();server.kill();await writeFile(out+'/npc-feedback-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,themes:report.themes,errors:report.errors,failure:report.failure}));}
