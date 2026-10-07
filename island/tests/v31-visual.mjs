import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createFishingEvent} from '../src/fishingParty.js';
import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v31',{recursive:true});const directory=await mkdtemp(resolve('qa/v31/visual-')),saves=createSaveStore({directory});
for(const t of ['pixel','origami']){const s=hydrateTown(createState());createFishingEvent(s,{name:'花园海风小聚',description:'用花园的颜色记住海边的相聚。',tags:['nature','sea'],guestId:4,guestReason:'莉安会把花园的颜色带到海边，陪大家等潮汐。'});await saves.open(t,{legacyState:s,clientId:'fixture'});}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
let browser;const report={directory,errors:[],checks:[]};
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const ctx=await browser.newContext({viewport:{width:1440,height:1050}});await ctx.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated visual QA"}'}));
  const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(base+'/?qa=1&theme='+theme);await p.locator('#partyBtn').click();await p.locator('#fishingPartyOpen').click();await p.locator('#fishingDesign').click();
  await p.evaluate(async()=>{const urls=[...document.querySelectorAll('#partyPreview image')].map(e=>e.getAttribute('href'));await Promise.all(urls.map(src=>{const im=new Image();im.src=src;return im.decode();}));});await p.waitForTimeout(300);
  assert.equal(await p.locator('.party-preview-portrait svg').count(),6);
  await p.locator('.modal-body').evaluate(e=>e.scrollTop=0);await p.screenshot({path:'qa/v31/'+theme+'-designer-ready.png'});
  await p.setViewportSize({width:390,height:820});await p.locator('#partyPreview').scrollIntoViewIfNeeded();assert.equal(await p.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await p.screenshot({path:'qa/v31/'+theme+'-preview-compact.png'});
  await p.setViewportSize({width:1440,height:1150});
  await p.evaluate(async(theme)=>{const {residentPortraitMarkup}=await import('/src/residentPortraits.js');const {RESIDENTS}=await import('/src/world.js');const host=document.createElement('div');host.id='portraitContact';host.style='position:fixed;inset:0;z-index:100000;background:#ece3cf;padding:15px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;overflow:auto';host.innerHTML=RESIDENTS.map((r,i)=>'<article style="border:1px solid #b5ab8e;text-align:center;background:#f8f1dd">'+residentPortraitMarkup(i,theme,r.name)+'<p style="margin:5px;font-size:16px">'+r.name+'</p></article>').join('');host.querySelectorAll('svg.half-portrait').forEach(e=>{e.style.width='220px';e.style.height='210px';e.style.background='none'});const loaded=[...host.querySelectorAll('image')].map(e=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('portrait SVG image did not load')),10000);e.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});e.addEventListener('error',()=>{clearTimeout(timer);reject(Error('portrait SVG image failed'));},{once:true});}));document.body.append(host);await Promise.all(loaded);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},theme);
  await p.screenshot({path:'qa/v31/'+theme+'-portraits.png'});
  report.checks.push({theme,portraits:16,svgImagesLoaded:true,compactOverflow:false});await ctx.close();
 }
 assert.equal(report.errors.length,0);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1}
finally{await browser?.close();server.kill();await writeFile('qa/v31/visual-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
