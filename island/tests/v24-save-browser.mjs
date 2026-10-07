import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
await mkdir('qa/v24',{recursive:true});
const dir=await mkdtemp(resolve('qa/v24/browser-storage-')),port=4194,base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['server.mjs','--port='+port,'--theme=origami'],{cwd:resolve('.'),env:{...process.env,HD_SAVE_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const api=async(path,body)=>{const res=await fetch(base+'/api/saves/origami'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const value=await res.json();assert.equal(res.status,200,JSON.stringify(value));return value};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async fn=>{for(let i=0;i<90;i++){if(await fn())return;await wait(150)}throw Error('condition timed out')};
let browser;const errors=[],report={directory:dir,checks:[]};
try{
 await waitFor(async()=>{try{return (await fetch(base+'/api/status')).ok}catch{return false}});
 await api('/restart',{requestId:'browser-day1-test',defer:true});
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const prepare=async context=>{await context.route('**/api/**',route=>route.request().url().includes('/api/saves/')?route.continue():route.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated QA"}'}));context.on('page',p=>p.on('pageerror',e=>errors.push({message:e.message,stack:e.stack,url:p.url()})))};
 const c1=await browser.newContext({viewport:{width:1440,height:950}});await prepare(c1);
 const old=hydrateTown(createState());old.day=48;old.coins=67890;old.inventory.c18_0=4;old.playerProfile.name='旧岛主';old.playerProfile.avatar='female_2';old.craftHistory.recipe_lantern=9;old.facilities[0].quality=90;old.economy.daySeconds=888;
 await c1.addInitScript(s=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('hyper-dimension-origami-v3'))localStorage.setItem('hyper-dimension-origami-v3',JSON.stringify(s))},old);
 const p1=await c1.newPage(),ai=[];p1.on('request',r=>{if(/\/api\/(npc|hermes)\//.test(r.url()))ai.push(r.url())});
 await p1.goto(base+'/?qa=1&rev=saves-v24');await p1.locator('#startFirstDay').waitFor();
 await waitFor(async()=>(await api('')).document?.state.journey!=null);
 const first=(await api('')).document;
 assert.equal(first.state.day,1);assert.equal(first.state.coins,0);assert.equal(first.state.economy.daySeconds,0);assert(Object.values(first.state.inventory).every(v=>v===0));assert.equal(first.state.playerProfile.name,'旧岛主');assert.equal(first.state.playerProfile.avatar,'female_2');assert.deepEqual(ai,[]);
 const backups=(await api('/backups')).backups;assert(backups.some(x=>x.day===48&&x.reason==='before-restart'));
 await p1.screenshot({path:'qa/v24/first-day.png'});report.checks.push('legacy migration + backup + day 1 zero inventory + no simulation while waiting');
 await c1.close();

 const c2=await browser.newContext({viewport:{width:1440,height:950}});await prepare(c2);const p=await c2.newPage();
 await p.goto(base+'/?qa=1');await p.locator('#startFirstDay').waitFor();
 assert.equal(await p.evaluate(()=>window.islandInspect().playerProfile.name),'旧岛主');report.checks.push('empty browser storage reloads primary server save');
 await p.locator('#startFirstDay').click();await p.locator('#playerBtn').click();
 await p.locator('#playerForm input[name=name]').fill('新的一天');await p.locator('#savePlayer').click();await p.locator('#closeModal').click();
 await p.locator('#saveStatus').click();await p.locator('#saveNow').click();
 await waitFor(async()=>(await api('')).document.state.playerProfile.name==='新的一天');
 await p.locator('#backupNow').click();await p.waitForFunction(()=>document.querySelector('#saveHistory')?.textContent.includes('手动备份'));
 const manual=(await api('/backups')).backups.find(x=>x.reason==='manual');
 await p.screenshot({path:'qa/v24/save-manager.png'});
 assert((await fetch(base+'/api/saves/origami/export')).headers.get('content-disposition').includes('attachment'));
 report.checks.push('manual save + file snapshot + export UI');

 // A server write by another client must block this stale window, including after reload.
 let d=(await api('')).document;d.state.playerProfile.name='另一窗口';await api('/save',{state:d.state,expectedVersion:d.version,clientId:'other-window'});
 await p.locator('#closeModal').click();
 await p.waitForFunction(()=>document.querySelector('#saveStatus').dataset.status==='conflict',{},{timeout:16000});
 await p.reload();await p.waitForFunction(()=>document.querySelector('#saveStatus')?.dataset.status==='conflict');
 assert.equal((await api('')).document.state.playerProfile.name,'另一窗口');
 await p.locator('#saveStatus').click();await p.locator('#acceptServerSave').click();
 await p.waitForFunction(()=>window.islandInspect?.().playerProfile.name==='另一窗口',{},{timeout:15000});
 assert.notEqual(await p.locator('#saveStatus').getAttribute('data-status'),'conflict');
 report.checks.push('stale writer blocked + conflict survives reload + explicit server selection');
 await p.locator('#saveStatus').click();
 await p.locator('[data-restore-save="'+manual.id+'"]').click();await p.locator('#confirmRestore').click();
 await p.waitForFunction(()=>window.islandInspect?.().playerProfile.name==='新的一天',{},{timeout:15000});
 report.checks.push('restore through UI preserves checkpoint of replaced progress');
 await wait(300);
 await p.locator('#saveStatus').click();await p.locator('#saveNow').click();await p.locator('#closeModal').click();
 // Disconnect only the save transport, then resume the browser's durable pending progress.
 const outage=route=>route.abort();
 await c2.route('**/api/saves/**',outage);
 await p.locator('#playerBtn').click();await p.locator('#playerForm input[name=name]').fill('断线暂存');await p.locator('#savePlayer').click();await p.locator('#closeModal').click();
 await p.locator('#saveStatus').click();await p.locator('#saveNow').click();
 await p.waitForFunction(()=>document.querySelector('#saveStatus').dataset.status==='offline');
 await c2.unroute('**/api/saves/**',outage);await p.reload();
 await p.waitForFunction(()=>window.islandInspect?.().playerProfile.name==='断线暂存');
 await waitFor(async()=>(await api('')).document.state.playerProfile.name==='断线暂存');
 report.checks.push('offline pending cache resumes to server without losing the edit');
 await p.locator('#themePixel').click();await p.waitForFunction(()=>document.body.dataset.theme==='pixel'&&window.islandInspect().theme==='pixel');
 await p.locator('#themeOrigami').click();await p.waitForFunction(()=>window.islandInspect().theme==='origami');
 assert.equal(await p.evaluate(()=>window.islandInspect().playerProfile.name),'断线暂存');
 report.checks.push('two themes use separate primary slots');
 await c2.close();
 const c3=await browser.newContext({viewport:{width:1280,height:900}});await prepare(c3);
 await c3.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked for QA','SecurityError')}}));
 const p3=await c3.newPage();await p3.goto(base+'/?qa=1');
 await p3.waitForFunction(()=>window.islandInspect?.().playerProfile.name==='断线暂存');
 await p3.locator('#saveStatus').click();await p3.locator('#saveNow').click();
 assert.notEqual(await p3.locator('#saveStatus').getAttribute('data-status'),'offline');
 report.checks.push('browser storage disabled: primary load and manual save still succeed');
 const exported=(await api('')).document;exported.state.playerProfile.name='导入的旅人';
 // Raw pending exports are also supported; an edited full envelope would fail its checksum.
 await p3.locator('#importSaveFile').setInputFiles({name:'recovered-pending.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported.state))});
 await p3.locator('#confirmImport').click();
 await p3.waitForFunction(()=>window.islandInspect?.().playerProfile.name==='导入的旅人');
 assert((await api('/backups')).backups.some(x=>x.reason==='before-import'));
 report.checks.push('import preview + explicit restore of an exported pending save');


 assert.deepEqual(errors,[]);
 report.errors=errors;report.passed=true;
 await writeFile('qa/v24/browser-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{
 await browser?.close();server.kill();
 if(!report.passed){await writeFile('qa/v24/browser-failure.log',logs+'\n'+JSON.stringify(errors));console.error(logs)}
}
