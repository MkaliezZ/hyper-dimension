import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v31',{recursive:true});const directory=await mkdtemp(resolve('qa/v31/hermes-browser-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,saves=createSaveStore({directory});const s=hydrateTown(createZeroState());s.freshStartPending=false;await saves.open('origami',{legacyState:s,clientId:'fixture'});
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port,'--theme=origami'],{cwd:resolve('.'),windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory,HD_HERMES_HOME:resolve(directory,'home'),HD_STEWARD_WORKDIR:resolve(directory,'documents')},stdio:['ignore','pipe','pipe']});
let logs='',browser,page;server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const report={directory,kind:'actual browser sends natural-language request to real Hermes and Flash, registers event and plan, opens party board and reloads disk save',errors:[]},wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000){const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await wait(150)}throw Error('condition timed out after '+ms);}
try{
 await until(async()=>{try{return(await fetch(base+'/api/status')).ok}catch{return false}});
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.route('**/api/**',r=>/\/api\/saves\//.test(r.request().url())||r.request().url().endsWith('/api/hermes/command')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"automatic model calls isolated"}'}));
 page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/?qa=1');await page.locator('#stewardBtn').click();
 await page.locator('#hermesInput').fill('帮我办一场名叫「花园海风小聚」的钓鱼活动，海风和花园主题，轻松难度。请推荐一位适合的嘉宾，并实际建立活动与协作筹备清单。邀请由我亲自完成，不要操作现实文档。');
 await page.locator('#hermesSend').click();await until(async()=>await page.locator('[data-steward-party]').count()>0,245000);
 const state=await page.evaluate(()=>window.islandInspect());assert.equal(state.fishingParty.draft.source,'hermes');assert.equal(state.workProjects.length,1);assert.equal(state.workProjects[0].runId,state.fishingParty.draft.runId);
 const receipt=state.chat.messages.at(-1).partyResults[0];assert(receipt.ok);assert(receipt.projectId);
 await page.screenshot({path:'qa/v31/hermes-registration.png'});
 await page.setViewportSize({width:390,height:820});assert.equal(await page.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:'qa/v31/hermes-registration-compact.png'});await page.setViewportSize({width:1440,height:1000});
 await page.locator('[data-steward-party]').click();assert((await page.locator('#fishingBoard').innerText()).includes(state.fishingParty.draft.name));assert.equal(await page.locator('[data-fishing-invite]').count(),3);
 await page.locator('#closeModal').click();await page.locator('#saveStatus').click();await page.locator('#saveNow').click();await wait(700);await page.reload();await page.locator('#stewardBtn').click();assert(await page.locator('[data-steward-party]').count());await page.locator('[data-steward-party]').click();
 const disk=await saves.current('origami');assert.equal(disk.state.fishingParty.draft.runId,receipt.runId);assert.equal(disk.state.workProjects.length,1);
 report.receipt=receipt;report.event={name:disk.state.fishingParty.draft.name,tags:disk.state.fishingParty.draft.tags,guestId:disk.state.fishingParty.draft.guestId,difficulty:disk.state.fishingParty.draft.difficulty,runId:disk.state.fishingParty.draft.runId};report.answer=state.chat.messages.at(-1).text;assert.equal(report.errors.length,0);report.passed=true;
}catch(e){report.failure=e.stack;report.logs=logs;process.exitCode=1;if(page)await page.screenshot({path:'qa/v31/hermes-browser-failure.png'}).catch(()=>{});}
finally{await browser?.close();server.kill();await writeFile('qa/v31/hermes-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
