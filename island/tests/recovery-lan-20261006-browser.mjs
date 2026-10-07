import {createLanHttpServer} from '../server/lanServer.mjs';
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
const out='qa/recovery-lan-20261006';await mkdir(out,{recursive:true});const directory=await mkdtemp(resolve(out+'/fixture-')),docs={},accounts={};
const service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-RECOVERY'}),base='http://127.0.0.1:'+service.port;
for(const theme of ['pixel','origami']){const user=await service.identities.register({login:'recovery_'+theme,password:'isolated-password',name:'恢复验证',islandName:'验证岛',theme,avatar:'male_0'});accounts[theme]=user;docs[theme]=(await service.tenants.open(user.token,theme,{})).document;}
let browser;const report={checks:[],errors:[],directory,scope:'Actual LAN /play in isolated authenticated accounts, stale autosave and concurrent recovery controllers; no user save access or model calls.'};
try{

browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
for(const theme of ['pixel','origami']){
const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
await ctx.addCookies([{name:'hd_lan_session',value:accounts[theme].token,url:base,httpOnly:true,sameSite:'Strict'}]);
await ctx.route('**/api/**',r=>(r.request().url().includes('/api/saves/')||r.request().url().endsWith('/api/lan/me'))?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated test"}'}));
await page.addInitScript(({theme,state,accountId})=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');const prefix='hd-lan:'+accountId+':hyper-dimension-'+theme;state.coins=444;localStorage.setItem(prefix+'-pending-server-save',JSON.stringify({state,baseVersion:'stale-v61',clientId:'stale-client'}));localStorage.setItem(prefix+'-pending-clock-save',JSON.stringify({body:{state,expectedVersion:'stale-v61',clientId:'stale-client',saveId:'v61-conflict',activeSeconds:1}}));},{theme,state:docs[theme].state,accountId:accounts[theme].view.me.id});
await page.goto(base+'/play?qa=1&theme='+theme);
await page.waitForSelector('#serverFacility:not(.hidden)');await page.waitForSelector('#serverVisitor:not(.hidden)');
assert.equal(await page.locator('#saveStatus').evaluate(e=>!!e.closest('[inert]')),false);
assert.equal(await page.locator('#facilityRetry').evaluate(e=>!!e.closest('[inert]')),false);
assert.equal(await page.locator('#visitorRetry').evaluate(e=>!!e.closest('[inert]')),false);
await page.locator('#visitorRetry').click({trial:true});await page.locator('#facilityRetry').click({trial:true});
const bounds=await page.locator('#actionRecoveryDock>.gather-v46:not(.hidden)').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}));
for(let i=1;i<bounds.length;i++)assert(bounds[i].top>=bounds[i-1].bottom);
await page.screenshot({path:out+'/'+theme+'-recovery.png'});
await page.locator('#saveStatus').click();await page.waitForSelector('#acceptServerSave');assert.equal(await page.locator('#acceptServerSave').evaluate(e=>!!e.closest('[inert]')),false);
await page.locator('#closeModal').click();await page.locator('#facilityRetry').click({trial:true});await page.locator('#saveStatus').click();
let failed=false;const url=base+'/api/saves/'+theme;
await page.route(url,async r=>{if(r.request().method()==='GET'){failed=true;await r.fulfill({status:503,contentType:'application/json',body:'{"code":"save_unavailable","error":"恢复读取暂不可用"}'});}else await r.continue();});
await page.locator('#acceptServerSave').click();await page.waitForFunction(()=>!document.querySelector('#acceptServerSave')?.disabled);assert(failed);
const prefix='hyper-dimension-'+theme;
assert(await page.evaluate(p=>!!localStorage.getItem(p+'-pending-clock-save')&&!!localStorage.getItem(p+'-pending-server-save')&&!!localStorage.getItem(p+'-pending-server-save-previous'),prefix));
await page.setViewportSize({width:390,height:820});await page.screenshot({path:out+'/'+theme+'-conflict-compact.png'});assert.equal(await page.locator('#modalRoot').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
await page.setViewportSize({width:1440,height:1000});await page.locator('#closeModal').click();await page.locator('#facilityRead').click();await page.waitForFunction(()=>!document.querySelector('#facilityRead').disabled);assert.match(await page.locator('#facilityMessage').textContent(),/恢复读取暂不可用/);await page.locator('#saveStatus').click();await page.unroute(url);await page.locator('#closeModal').click();await page.locator(theme==='pixel'?'#recoveryAll':'#serverFacility [data-recovery-read]').click();
await page.waitForFunction(()=>window.islandInspect?.().serverFacility?.ready&&window.islandInspect?.().serverVisitor?.ready,{},{timeout:45000});
if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
assert.equal(await page.locator('#bagBtn').evaluate(e=>!!e.closest('[inert]')),false);await page.locator('#bagBtn').click();await page.locator('#closeModal').click();
assert.equal(await page.evaluate(p=>localStorage.getItem(p+'-pending-clock-save'),prefix),null);
assert.equal((await (await service.tenants.get(accounts[theme].token)).saves.current(theme)).state.coins,0);
assert(await page.evaluate(p=>JSON.parse(localStorage.getItem(p+'-pending-server-save-previous')).state.coins===444,prefix));
report.checks.push({theme,concurrentPanels:bounds.length,noInertDeadlock:true,noOverlap:true,saveDialogClickable:true,failedReadPreservesEvidence:true,verifiedRecoveryReload:true,serverCoinsPreserved:0,localBackupCoins:444,gameUsable:true});await ctx.close();
}
const c=await browser.newContext(),p=await c.newPage();await p.route('**/recovery-fixture',r=>r.fulfill({contentType:'text/html',body:'<div id="app"><button id="world">world</button><button id="saveStatus">save</button><div id="modalRoot"></div></div><div id="already" inert></div>'}));await p.goto(base+'/recovery-fixture');await p.evaluate(async()=>{const m=await import('/src/actionRecoveryUI.js'),a=document.createElement('section'),b=document.createElement('section');m.lockActionUI(a);m.lockActionUI(b);m.unlockActionUI(a);if(!document.querySelector('#world').closest('[inert]'))throw Error('second lock lost');if(b.closest('[inert]'))throw Error('recovery locked');m.unlockActionUI(b);if(document.querySelector('#world').closest('[inert]'))throw Error('world remains locked');if(!document.querySelector('#already').inert)throw Error('original inert state lost');});await c.close();assert.deepEqual(report.errors,[]);report.lockOwnership=true;report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await service.close();await writeFile(out+'/recovery-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
