import {chromium} from 'playwright-core';import {spawn} from 'node:child_process';import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {browserLaunchOptions} from './browserRuntime.mjs';import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {operatingTrend} from '../src/economyTrend.js';
const out=path.resolve(process.env.HD_QA_OUT||'qa/v143/economy-browser');await mkdir(out,{recursive:true});
const input=JSON.parse(await readFile(process.env.HD_ECON_INPUT||path.join(import.meta.dirname,'../docs/verification/v143/economy-900s.json'),'utf8'));
const report={scope:'Native Edge UI check using preloaded economic-simulation history in isolated saves. Models blocked. Desktop and 390px displays and modal close/reopen. This is not real-player or economic balancing evidence.',cases:[]};
let browser;const servers=[];
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const dir=await mkdtemp(path.join(out,theme+'-')),store=createSaveStore({directory:path.join(dir,'saves')}),state=hydrateTown(createZeroState());
  state.freshStartPending=false;state.day=31;state.economy.townDays=input.reports.find(r=>r.theme===theme&&r.mode==='passive').daily;state.economy.daySeconds=12;
  const expected=operatingTrend(state);await store.open(theme,{legacyState:state,protect:true});
  const sock=createServer();await new Promise(r=>sock.listen(0,'127.0.0.1',r));const port=sock.address().port;await new Promise(r=>sock.close(r));
  const server=spawn(process.execPath,['server.mjs','--port='+port,'--theme='+theme],{windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(dir,'saves'),HD_RUN_LEDGER_DIR:path.join(dir,'runs')}});servers.push(server);
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),row={theme,errors:[],badAssets:[],expected};report.cases.push(row);
  page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(r.url());});
  await context.route('**/api/**',r=>/\/api\/(saves\/|status$|world\/session)/.test(r.request().url())?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated economy UI check"}'}));
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+port+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  await page.goto('http://127.0.0.1:'+port+'/?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready,null,{timeout:45000});
  await page.locator('#businessBtn').click();await page.locator('#operatingTrend').waitFor({state:'visible'});await page.locator('#operatingTrend').scrollIntoViewIfNeeded();
  row.text=await page.locator('#operatingTrend').innerText();assert(row.text.includes('最近 7 个已结算游戏日'));assert(row.text.includes(expected.dailyPassiveNet.toFixed(1)));assert(row.text.includes(expected.dailyActiveNet.toFixed(1)));assert(row.text.includes((expected.passiveCostMargin*100).toFixed(1)+'%'));
  await page.screenshot({path:path.join(out,theme+'-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('#operatingTrend').scrollIntoViewIfNeeded();
  row.mobile=await page.locator('#operatingTrend').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(row.mobile.scroll<=row.mobile.client+2,'trend card must not overflow horizontally');
  await page.screenshot({path:path.join(out,theme+'-mobile.png')});await page.locator('#closeModal').click();assert.equal(await page.locator('#modalRoot').isVisible(),false);await page.locator('#businessBtn').click();assert(await page.locator('#operatingTrend').isVisible());
  await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready,null,{timeout:45000});await page.locator('#businessBtn').click();assert.equal(await page.locator('#operatingTrend').innerText(),row.text);
  assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;await context.close();
 }
 report.passed=true;
}catch(e){report.error=e.stack;throw e;}finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();for(const s of servers)s.kill();console.log(JSON.stringify({passed:report.passed||false,cases:report.cases.length,out}));
}
