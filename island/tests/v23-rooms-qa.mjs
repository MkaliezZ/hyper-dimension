import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),results=[];
try{for(const theme of ['origami','pixel'])for(const scene of ['scene=farm','room=4']){
 const p=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.route('**/api/**',r=>r.fulfill({status:503,body:'{}'}));
 await p.goto('http://127.0.0.1:'+(theme==='origami'?4174:4173)+'/?qa=1&'+scene);
 await p.waitForFunction(()=>{const r=window.islandInspect?.().rendering.raster;return r?.ready>=1&&r.pending===0&&r.storage==='decoded-image'});
 await p.waitForTimeout(400);
 const frames=await p.evaluate(()=>new Promise(resolve=>{let start=0,last=0,samples=[];function step(t){if(!start)start=t;if(last)samples.push(t-last);last=t;if(t-start>2500){samples.sort((a,b)=>a-b);resolve({n:samples.length,avg:(t-start)/samples.length,p95:samples[Math.floor(samples.length*.95)]})}else requestAnimationFrame(step)}requestAnimationFrame(step)}));
 assert.ok(frames.avg<25,'Interior average frame budget: '+JSON.stringify(frames));assert.deepEqual(errors,[]);
 const snapshot=await p.evaluate(()=>({scene:window.islandInspect().scene,raster:window.islandInspect().rendering.raster}));
 assert.equal(snapshot.raster.failures,0);
 await p.screenshot({path:'qa/v23/'+theme+'-'+(scene.includes('farm')?'farm':'tailor')+'.png'});
 results.push({theme,scene,...frames,...snapshot,errors});await p.close();
}}finally{await browser.close()}
await writeFile('qa/v23/rooms.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));

