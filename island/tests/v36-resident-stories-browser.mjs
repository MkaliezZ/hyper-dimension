import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {hydrateTown,commitWork,relationship} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {nextOperationId} from '../src/resourceLedger.js';
import {recordResidentConversation,claimResidentStory,recordResidentStoryWork} from '../src/residentStories.js';
await mkdir('qa/v36',{recursive:true});
const directory=await mkdtemp(resolve('qa/v36/browser-')),saves=createSaveStore({directory});
const report={directory,kind:'Dual-theme actual journal UI, adult portraits, two-sided dialogue choices and disk reload. Conversations/stock are isolated fixtures; AI routes blocked. Not human new-start acceptance.',checks:[],errors:[],badImages:[]};
const fixture=()=>{
 const s=hydrateTown(createZeroState());s.freshStartPending=false;
 const conversation=(people,type)=>{const row={id:nextOperationId(s,'npc-talk'),day:s.day,time:0,participants:people,type,changes:[],summary:type==='dispute'?'阿岚希望先准备材料，露露希望先确认活动安排，两人尚未说清分工。':'阿岚与小麦约定各准备一份木材，再核对真实成果。',source:'local',lines:people.map(speaker=>({speaker,text:'先完成自己的准备，再一起核对。'}))};s.npcConversations.push(row);return recordResidentConversation(s,row).episode;};
 const done=conversation([0,6],'negotiate');s.day=2;
 for(const id of done.people){const op=nextOperationId(s,'story-work');claimResidentStory(s,done.id,id,op,'work');commitWork(id,{...done.plan,action:'work',storyId:done.id,operationId:op},s,0);assert(recordResidentStoryWork(s,done.id,id,op).ok);}
 const conflict=conversation([0,2],'dispute');relationship(s,0,2).tension=16;relationship(s,2,0).tension=15;
 return {s,conflictId:conflict.id};
};
const ids={};for(const theme of ['pixel','origami']){const {s,conflictId}=fixture();ids[theme]=conflictId;await saves.open(theme,{legacyState:s,clientId:'stories-fixture'});}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
let engine;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/status')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready);
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated stories QA"}'}));
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badImages.push(r.url())});
  const get=()=>page.evaluate(()=>window.islandInspect());
  const open=async()=>{await page.locator('#residentsBtn').click();await page.locator('[data-npc="0"]').click();await page.locator('#residentStoriesOpen').click();await page.waitForSelector('.resident-story-card')};
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().residentStories);
  await open();assert.equal(await page.locator('.resident-story-card').count(),2);
  await page.locator('.story-timeline').first().evaluate(e=>e.open=true);
  await page.waitForFunction(()=>[...document.querySelectorAll('.story-partner-art image')].every(e=>{const href=e.getAttribute('href');return [...performance.getEntriesByType('resource')].some(r=>r.name.endsWith(href))}));
  await page.evaluate(async()=>{const urls=[...new Set([...document.querySelectorAll('.story-partner-art image')].map(e=>e.getAttribute('href')))];await Promise.all(urls.map(async url=>{const image=new Image();image.src=url;await image.decode();}));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  const art=await page.locator('.story-partner-art .half-portrait').first().boundingBox();assert(art.width>90&&art.width<180&&art.height>=130);
  await page.screenshot({path:'qa/v36/'+theme+'-stories-desktop.png'});
  const card=page.locator('[data-story-id="'+ids[theme]+'"]');
  await card.locator('[data-choice="listen"]').click();assert.equal((await get()).residentStories.episodes.find(e=>e.id===ids[theme]).mediated,false);
  await page.locator('[data-neighbor="2"]').click();
  await page.locator('[data-story-id="'+ids[theme]+'"] [data-choice="listen"]').click();
  assert.equal((await get()).residentStories.episodes.find(e=>e.id===ids[theme]).mediated,true);
  const trust=(await get()).npcRelations[0][2].trust,history=(await get()).residentStories.episodes.find(e=>e.id===ids[theme]).timeline.length;
  let saved=false;for(let i=0;i<40;i++){const document=await saves.current(theme);if(document?.state.residentStories?.episodes.find(e=>e.id===ids[theme])?.mediated){saved=true;break}await page.waitForTimeout(100);}assert(saved,'dialogue must reach the file save');
  await page.reload();await page.waitForFunction(()=>window.islandInspect?.().residentStories);assert.equal((await get()).residentStories.episodes.find(e=>e.id===ids[theme]).mediated,true);assert.equal((await get()).npcRelations[0][2].trust,trust);
  await open();assert.equal(await page.locator('[data-story-id="'+ids[theme]+'"] [data-choice]').count(),0);assert.equal((await get()).residentStories.episodes.find(e=>e.id===ids[theme]).timeline.length,history);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'qa/v36/'+theme+'-stories-compact.png'});
  await page.evaluate(()=>{for(const e of document.querySelector('.modal').querySelectorAll('*'))if(e.scrollHeight>e.clientHeight+20&&['auto','scroll'].includes(getComputedStyle(e).overflowY))e.scrollTop=e.scrollHeight});
  const close=await page.locator('#closeModal').boundingBox();assert(close&&close.y>=0&&close.y+close.height<=844);
  await page.locator('#closeModal').click();assert.equal(await page.locator('.resident-stories-modal').count(),0);
  report.checks.push({theme,episodes:2,twoSidedMediation:true,persisted:true,reloadNoDuplicate:true,adultPortrait:art,compactNoOverflow:true,closeVisibleWhenScrolled:true});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badImages,[]);report.passed=true;
}finally{await engine?.close();server.kill();await writeFile('qa/v36/browser-report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
