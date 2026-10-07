import {chromium} from 'playwright-core';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createFireworksEvent} from '../src/fireworksParty.js';
const out=resolve('qa/v91/navigation-race');await mkdir(out,{recursive:true});
const directory=await mkdtemp(resolve(out,'accounts-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-MODAL-RACE'}),base='http://127.0.0.1:'+service.port,browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={at:new Date().toISOString(),scope:'Actual isolated accounts; delayed existing enable/invite responses after real server commit, user closes old view and opens inventory before response. No provider calls or user progress. Verify new view remains while true invite deduction and consent persist.',checks:[],errors:[]};
try{for(const theme of ['pixel','origami']){
 const user=await service.identities.register({login:'race_'+theme,password:'isolated-race-password',name:'响应验收',islandName:'静帆岛',theme,avatar:'female_1'}),tenant=await service.tenants.get(user.token),s=hydrateTown(createZeroState());s.freshStartPending=false;s.inventory.resin=2;assert(createFireworksEvent(s,{name:'静帆烟花',tags:['stars'],difficulty:'normal',guestId:null}).ok);await tenant.saves.open(theme,{legacyState:s});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:user.token,url:base,httpOnly:true,sameSite:'Strict'}]);
 let operation=null,committedResolve,settledResolve,committed,settled;
 function delay(op){operation=op;committed=new Promise(r=>committedResolve=r);settled=new Promise(r=>settledResolve=r);}
 await context.route('**/api/**',async r=>{const url=r.request().url();if(url.includes('/api/saves/')){
  if(url.endsWith('/action')&&r.request().postDataJSON()?.operation===operation){operation=null;const response=await r.fetch();assert(response.ok());committedResolve();await new Promise(r=>setTimeout(r,1600));await r.fulfill({response});settledResolve();return;}return r.continue();
 }if(url.endsWith('/api/lan/me'))return r.continue();return r.fulfill({status:503,contentType:'application/json',body:'{"error":"no provider in modal race QA"}'});});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push({theme,error:e.message}));
 await page.goto(base+'/play?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!document.querySelector('#app')?.hasAttribute('aria-busy'));
 const hub=async()=>{await page.locator('#partyBtn').click();await page.locator('#partyGuideRoot').waitFor();};
 const replaceWithBag=async()=>{await page.locator('#closeModal').click();await page.locator('#bagBtn').click();return page.locator('.modal-head h2').innerText();};
 await hub();delay('fireworks_enable');await page.locator('#fireworksPartyOpen').click();await committed;const firstTitle=await replaceWithBag();await settled;await page.waitForFunction(()=>window.islandInspect?.().fireworksParty&&window.islandInspect?.().serverCommerce?.inflight===0);assert.equal(await page.locator('.modal-head h2').innerText(),firstTitle);assert.equal(await page.locator('#fireworksBoard').count(),0);
 await page.locator('#closeModal').click();await hub();await page.locator('[data-party-invite="fireworks:1"]').click();await page.locator('#fireworksInviteConfirm').waitFor();delay('fireworks_invite');await page.locator('#fireworksInviteConfirm').click();await committed;const nextTitle=await replaceWithBag();await settled;await page.waitForFunction(()=>window.islandInspect?.().fireworksParty?.draft?.invites?.[1]?.version===window.islandInspect?.().fireworksParty?.draft?.version);assert.equal(await page.locator('.modal-head h2').innerText(),nextTitle);assert.equal(await page.locator('#fireworksBoard').count(),0);
 const live=await page.evaluate(()=>({inventory:window.islandInspect().inventory,fireworksParty:window.islandInspect().fireworksParty})),disk=await tenant.saves.current(theme);assert.equal(live.inventory.resin,1);assert.equal(disk.state.inventory.resin,1);assert.equal(disk.state.fireworksParty.draft.invites[1].version,disk.state.fireworksParty.draft.version);
 await page.screenshot({path:resolve(out,theme+'-kept-inventory.png')});report.checks.push({theme,delayMs:1600,lateEnableDoesNotReplaceNewView:true,lateInviteDoesNotReplaceNewView:true,actualGiftDeductedOnce:true,consentOnDisk:true});await context.close();
}assert.equal(report.errors.length,0);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;throw e;}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await browser.close();await service.close();}
