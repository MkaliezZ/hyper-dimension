import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ROOMS,roomWalkable} from '../src/rooms.js';
import {findPath} from '../src/world.js';
for(const room of ROOMS){const p=findPath({x:500,y:545},room.primary.entry,(x,y)=>roomWalkable(room.id,x,y),20);assert.ok(p.length||Math.hypot(500-room.primary.entry.x,545-room.primary.entry.y)<35,'room station unreachable '+room.id)}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-sandbox']});
const errors=[],assetErrors=[];
for(const theme of ['pixel','origami']){
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)assetErrors.push(r.url())});
 const port=theme==='pixel'?4173:4174;
 await page.goto('http://127.0.0.1:'+port+'/');
 await page.waitForTimeout(900);
 const rect=await page.locator('#game').boundingBox();
 assert.equal(rect.width,1440);assert.equal(rect.height,900);
 for(let i=0;i<10;i++)await page.locator('#zoomOut').click();
 assert.equal(await page.locator('#zoomLabel').textContent(),'100%');
 await page.screenshot({path:'hud-'+theme+'-screen.png'});
 const timing=await page.evaluate(()=>new Promise(resolve=>{const deltas=[];let previous=0;function tick(t){if(previous)deltas.push(t-previous);previous=t;if(deltas.length<90)requestAnimationFrame(tick);else{deltas.sort((a,b)=>a-b);resolve({median:deltas[45],p95:deltas[85]})}}requestAnimationFrame(tick)}));
 console.log(theme+' headless frame timing '+JSON.stringify(timing));
 await page.locator('#zoomIn').click();assert.equal(await page.locator('#zoomLabel').textContent(),'115%');
 await page.mouse.move(880,470);await page.mouse.down();await page.mouse.move(600,580,{steps:25});await page.mouse.up();
 await page.locator('#cameraHome').click();assert.equal(await page.locator('#zoomLabel').textContent(),'100%');
 for(const id of [0,6,12,24]){
  await page.goto('http://127.0.0.1:'+port+'/?room='+id);
  await page.waitForTimeout(550);
  assert.equal(await page.locator('#placeName').textContent(),ROOMS[id].name);
  const f=ROOMS[id].primary,scale=Math.max(1440/1000,900/660);
  await page.mouse.click((f.x+f.w/2)*scale,(f.y+f.h/2)*scale+(900-660*scale)/2);
  await page.locator('.room-game').waitFor({timeout:35000});
  await page.locator('#closeModal').click();
  await page.screenshot({path:'room-'+id+'-'+theme+'-screen.png'});
 }
 await page.close();
}
assert.equal(assetErrors.length,0,assetErrors.join('; '));
assert.equal(errors.length,0,errors.join('; '));
console.log(JSON.stringify({result:'PASS',fullScreen:true,minimumZoom:'100%',reachableRooms:25,visualRooms:[0,6,12,24],themes:2,pageErrors:errors}));
await browser.close();