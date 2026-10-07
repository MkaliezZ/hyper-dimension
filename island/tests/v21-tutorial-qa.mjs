import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),report=[];
try{
for(const port of [4173,4174]){
 const p=await b.newPage({viewport:{width:1440,height:950}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated QA"}'}));
 await p.goto('http://127.0.0.1:'+port+'/?qa=1');
 await p.locator('#journeyNext').click();await p.locator('#closeModal').click();await p.locator('#journeyNext').click();
 const inspect=()=>p.evaluate(()=>window.islandInspect());
 async function bed(){
  const q=(await inspect()).farmPlots[0],point={x:q.corners.reduce((a,v)=>a+v.x,0)/4,y:q.corners.reduce((a,v)=>a+v.y,0)/4};
  const pos=await p.evaluate(point=>{const s=window.islandInspect(),b=document.querySelector('#game').getBoundingClientRect(),z=Math.max(b.width/1000,b.height/660)*s.zoom;return {x:b.x+b.width/2+(point.x-s.camera.x)*z,y:b.y+b.height/2+(point.y-s.camera.y)*z}},point);await p.mouse.click(pos.x,pos.y);
 }
 await bed();await p.waitForFunction(()=>window.islandInspect().plots[0].stage===1&&!window.islandInspect().actor.action,{timeout:15000});
 await bed();await p.locator('[data-crop="wheat"]').click();await p.waitForFunction(()=>window.islandInspect().plots[0].stage===2&&!window.islandInspect().actor.action);
 await bed();await p.waitForFunction(()=>window.islandInspect().journey.completed.plant&&!window.islandInspect().actor.action);
 assert((await inspect()).plots[0].playerTended);
 await p.locator('#journeyNext').click();await p.waitForFunction(()=>window.islandInspect().journey.stats.gathered.wood===2&&!window.islandInspect().actor.action,{timeout:22000});
 await p.locator('#journeyNext').click();await p.waitForFunction(()=>window.islandInspect().journey.stats.gathered.wood===4&&!window.islandInspect().actor.action,{timeout:22000});
 assert.match(await p.locator('#questList').textContent(),/敲开一条矿脉/);
 await p.reload();assert.match(await p.locator('#questList').textContent(),/敲开一条矿脉/);assert((await inspect()).plots[0].playerTended);
 assert.deepEqual(errors,[]);report.push({port,realHoeSowWater:true,realGatherTwice:true,protectedCrop:true,reloadProgress:true,errors});await p.close();
}
await writeFile('qa/v21/tutorial-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close()}

