import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{const key='hyper-dimension-pixel-v3';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({inventory:{wood:12,stone:8,seed:8,wheat:0,ore:0,herb:2,fish:0},npcCareers:{0:{phase:1,completed:0,history:[]},6:{phase:1,completed:0,history:[]}},plots:Array.from({length:8},()=>({stage:0,crop:'wheat',growth:0}))}))});
await page.route('**/api/npc/**',r=>r.fulfill({json:{decisions:[]}}));await page.route('**/api/hermes/**',r=>r.fulfill({json:{commands:[]}}));
await page.goto('http://127.0.0.1:4173/?scene=farm&qa=1');await page.waitForFunction(()=>window.islandInspect);
const clickBed=async()=>{const rect=await page.locator('#game').boundingBox(),q=await page.evaluate(()=>window.islandInspect().farmPlots[7]),s=Math.max(rect.width/1000,rect.height/660),x=(q.corners[0].x+q.corners[2].x)/2,y=(q.corners[0].y+q.corners[2].y)/2;await page.mouse.click(rect.x+rect.width/2+(x-500)*s,rect.y+rect.height/2+(y-330)*s)};
const waitStage=stage=>page.waitForFunction(stage=>{const s=window.islandInspect();return s.plots[7].stage===stage&&!s.actor.action},stage,{timeout:15000});
await clickBed();await waitStage(1);await clickBed();await page.locator('[data-crop="wheat"]').click();await waitStage(2);await clickBed();await waitStage(3);
const growing=await page.evaluate(()=>window.islandInspect().plots[7]);assert.equal(growing.crop,'wheat');assert.ok(growing.growth<10,'crop matured too quickly');
// Resume a saved crop one second before maturity; the 180-second boundary is covered by domain tests.
await page.evaluate(()=>{const key='hyper-dimension-pixel-v3',s=JSON.parse(localStorage.getItem(key));s.plots[7].growth=179;s.npcCareers[0].phase=1;s.npcCareers[6].phase=1;localStorage.setItem(key,JSON.stringify(s))});await page.reload();await waitStage(4);
const before=await page.evaluate(()=>window.islandInspect().inventory.wheat);await clickBed();await waitStage(0);const final=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('hyper-dimension-pixel-v3'));return {wheat:s.inventory.wheat,seed:s.inventory.seed,task:s.tasks.farm}});assert.equal(final.wheat,before+2);assert.equal(final.task,true);assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',farmCycle:final,pageErrors:errors}));
}finally{await browser.close()}
