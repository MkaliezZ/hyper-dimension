import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createFishingEvent} from '../src/fishingParty.js';
import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v30',{recursive:true});const directory=await mkdtemp(resolve('qa/v30/links-')),saves=createSaveStore({directory});
const live=JSON.parse(await readFile('qa/v30/live-party-report.json','utf8'));
const liveState=JSON.parse(await readFile(resolve(live.directory,'saves/origami/current.json'),'utf8')).state;
for(const theme of ['pixel','origami']){
 const s=theme==='pixel'?hydrateTown(createState()):structuredClone(liveState);
 if(theme==='pixel'){s.inventory.c16_4=1;s.inventory.c16_2=1;createFishingEvent(s,{name:'从背包出发的邀请',seed:12})}
 await saves.open(theme,{legacyState:s,clientId:'links-fixture'});
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port,'--theme=origami'],{cwd:resolve('.'),windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={directory,checks:[],errors:[]},wait=ms=>new Promise(r=>setTimeout(r,ms));let browser,page;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base+'/api/status')).ok)break}catch{}await wait(100)}
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated interface QA"}'}));
 page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/?qa=1&theme=pixel');
 await page.locator('#bagBtn').click();await page.locator('[data-item="c16_4"]').click();assert.match(await page.locator('.item-purpose').textContent(),/六竿/);
 await page.locator('#itemUse').click();await page.locator('#fishingBoard').waitFor();assert.equal(await page.evaluate(()=>islandInspect().inventory.c16_4),1);report.checks.push('bait main action opens the fishing journal without consuming stock');
 await page.locator('#closeModal').click();await page.locator('#residentsBtn').click();await page.locator('[data-npc="8"]').click();await page.locator('#inviteFishingNpc').click();await page.locator('#fishingInviteGive').click();
 assert.equal(await page.evaluate(()=>islandInspect().inventory.c16_2),0);report.checks.push('normal resident dialogue reaches and completes the versioned fishing invitation');
 await page.goto(base+'/?qa=1&theme=origami');await page.locator('#partyBtn').click();await page.locator('.fishing-cooperation summary').click();
 assert.match(await page.locator('.fishing-cooperation').textContent(),new RegExp(live.run.child.id));
 await page.setViewportSize({width:390,height:800});assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
 await page.locator('.fishing-cooperation').scrollIntoViewIfNeeded();await page.screenshot({path:'qa/v30/cooperation-compact.png'});
 await page.locator('#fishingAwardDisplay').click();await page.locator('#fishingAwardClose').click();await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(700);
 for(let i=0;i<4;i++)await page.locator('#zoomOut').click();await page.waitForTimeout(2300);
 await page.screenshot({path:'qa/v30/museum-world.png'});assert.equal(await page.evaluate(()=>islandInspect().eventWonders.displayed),'seashell_cup');
 await page.locator('#partyBtn').click();await page.locator('#fishingPartyOpen').click();await page.locator('.fishing-history summary').click();await page.locator('[data-fishing-history]').first().click();await page.locator('.fishing-cooperation summary').click();
 assert.match(await page.locator('.fishing-cooperation').textContent(),new RegExp(live.run.parent.id));
 await page.screenshot({path:'qa/v30/cooperation-history.png'});report.checks.push('actual live parent/child delivery records are visible in award and history, at desktop and narrow width; trophy is displayed in world');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;await page?.screenshot({path:'qa/v30/links-failure.png'}).catch(()=>{})}
finally{await browser?.close();server.kill();await writeFile('qa/v30/links-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))}
