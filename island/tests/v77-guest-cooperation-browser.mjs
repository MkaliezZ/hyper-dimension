import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {fixture,meet} from './v74-travel-fixture.mjs';
await mkdir('qa/v77',{recursive:true});
const report={checks:[],errors:[],badAssets:[],scope:'Isolated accounts, real consent/start controls and server paths/escrow/production; deterministic social/recruitment provider; existing style assets.'};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
let f,contexts=[];
async function canvasBox(page){return page.locator('#lanMapCanvas').boundingBox();}
async function fetchView(page){return page.evaluate(async()=>{const r=await fetch('/api/lan/view');if(!r.ok)throw Error(await r.text());return r.json();});}
try{
 for(const theme of ['pixel','origami']){
  f=await fixture(theme);await f.update(s=>{s.freshStartPending=false;for(const id of ['wood','stone','ore','clay','herb','wheat','seed','fish'])s.inventory[id]=100;},0);
  await f.action(1,'travel_invite',{npcId:16});const room=await f.action(0,'room_create',{title:'客岛的共同工作台',maxPlayers:2});await f.action(1,'room_join',{code:room.view.room.code});
  const event=await meet(f),base='http://127.0.0.1:'+f.service.port,pages=[];
  for(const a of f.accounts){
   const ctx=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(ctx);await ctx.addCookies([{name:'hd_lan_session',value:a.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   await ctx.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return p.startsWith('/api/lan/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated guest-work browser fixture"}'});});
   const page=await ctx.newPage();pages.push(page);page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url());});
   await page.goto(base+'/?qa=1');await page.waitForFunction(()=>window.lanInspect?.().map?.loaded);await page.locator('#lanSocial [data-cooperate="propose"][data-event="'+event.id+'"]').waitFor();
  }
  const pick=(page,op)=>page.locator('#lanSocial [data-cooperate="'+op+'"][data-event="'+event.id+'"]');
  await pick(pages[1],'propose').click();await pick(pages[1],'accept').click();await pick(pages[0],'accept').click();await pick(pages[0],'start').waitFor();
  await pages[0].locator('.lan-guest-work').scrollIntoViewIfNeeded();await pages[0].screenshot({path:'qa/v77/'+theme+'-agreement.png'});
  await pages[0].setViewportSize({width:390,height:820});await pages[0].locator('.lan-guest-work').scrollIntoViewIfNeeded();
  assert.equal(await pages[0].evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await pages[0].screenshot({path:'qa/v77/'+theme+'-agreement-compact.png'});await pages[0].setViewportSize({width:1440,height:1000});
  await pick(pages[0],'start').click();await pages[0].locator('.lan-guest-progress').waitFor();assert.equal(await pick(pages[0],'start').count(),0);
  let working,complete,positions=[];
  for(let n=0;n<300;n++){
   await f.step();const data=await f.service.social.view(f.accounts[0].token),c=data.events.find(e=>e.id===event.id).cooperation;
   if(c.status==='working'){working=c;break;}assert.notEqual(c.status,'cancelled',c.reason);
  }
  assert(working,'workers must reach distinct real workstations before production');
  await pages[0].locator('#lanMapCanvas').scrollIntoViewIfNeeded();
  await pages[0].waitForFunction(()=>window.lanInspect?.().map?.members.filter(m=>m.work?.phase==='working').length===2);
  positions=await pages[0].evaluate(()=>window.lanInspect().map.members.filter(m=>m.work).map(m=>({id:m.id,x:m.x,y:m.y,work:m.work,action:m.action})));
  assert(positions.every(p=>p.action?.type===p.work.action));assert(Math.hypot(positions[0].work.target.x-positions[1].work.target.x,positions[0].work.target.y-positions[1].work.target.y)>=65);
  const stage=await pages[0].evaluate(()=>{const d=window.lanInspect().map,r=document.getElementById('lanMapCanvas').getBoundingClientRect();return{...d,box:{x:r.x,y:r.y,width:r.width,height:r.height}};});
  const first=positions[0];const anchor={x:stage.box.x+stage.cssW/2+(first.x-stage.camera.x)*stage.scale,y:stage.box.y+stage.cssH/2+(first.y-stage.camera.y)*stage.scale};
  await pages[0].mouse.move(anchor.x,anchor.y);for(let n=0;n<5;n++)await pages[0].mouse.wheel(0,-250);
  const zoomed=await pages[0].evaluate(()=>window.lanInspect().map);const box=await canvasBox(pages[0]);await pages[0].mouse.move(box.x+box.width/2,box.y+box.height/2);await pages[0].mouse.down();await pages[0].mouse.move(box.x+box.width/2+(zoomed.camera.x-first.x)*zoomed.scale,box.y+box.height/2+(zoomed.camera.y-first.y)*zoomed.scale,{steps:8});await pages[0].mouse.up();await pages[0].screenshot({path:'qa/v77/'+theme+'-workstation.png'});
  const canvas=pages[0].locator('#lanMapCanvas');await canvas.screenshot({path:'qa/v77/'+theme+'-workstation-canvas.png'});
  const before=await pages[0].evaluate(()=>window.lanInspect().map.members.filter(m=>m.work).map(m=>m.action?.t));await new Promise(r=>setTimeout(r,150));
  const after=await pages[0].evaluate(()=>window.lanInspect().map.members.filter(m=>m.work).map(m=>m.action?.t));assert(after.some((t,i)=>t>before[i]),'tool action must advance between server snapshots');
  for(let n=0;n<100;n++){await f.step();const c=(await f.service.social.view(f.accounts[0].token)).events.find(e=>e.id===event.id).cooperation;if(c.status==='completed'){complete=c;break;}}
  assert(complete);await pages[0].locator('.lan-guest-work').getByText('成品已进入主岛仓库',{exact:true}).waitFor({timeout:15000});
  assert.equal(await pick(pages[0],'start').count(),0);assert.equal(await pick(pages[0],'withdraw').count(),0);
  await pages[0].locator('.lan-guest-work').scrollIntoViewIfNeeded();await pages[0].screenshot({path:'qa/v77/'+theme+'-completed.png'});
  await pages[1].locator('#lanLeaveRoom').click();await pages[1].locator('#lanTravelChoices').waitFor();
  const guest=await f.read();assert.equal(guest.state.recruitment.active.id,f.contract.id);assert.equal(guest.state.recruitment.active.feePaid,null);assert.equal(guest.state.crossIslandTasks,undefined);
  report.checks.push({theme,actualControls:true,compactNoOverflow:true,separateWorkstations:true,workActions:positions.map(p=>p.action.type),animationContinues:true,hostOutputs:complete.parts.map(p=>({item:p.item,proof:p.proof})),originalHirePreserved:true});
  for(const ctx of contexts)await ctx.close();contexts=[];await f.service.close();f=null;
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badAssets,[]);report.passed=true;
}catch(e){report.failure=e.stack;for(const [i,ctx]of contexts.entries()){const p=ctx.pages()[0];if(p){report['page'+i]=(await p.locator('body').innerText()).slice(-9000);await p.screenshot({path:'qa/v77/failure-'+i+'.png'});}}process.exitCode=1;}
finally{for(const ctx of contexts)await ctx.close();await f?.service.close();await browser.close();await writeFile('qa/v77/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
