import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {DEFAULT_CLOCK} from '../src/environmentClock.js';
import {PERMANENT_HOMES} from '../src/islandGeography.js';

const out=resolve(process.env.HD_QA_OUT||'qa/v216/native-night-planning');await mkdir(out,{recursive:true});
const report={scope:'Fictional LAN accounts; each case starts with an explicit 02:00 clock fixture at rate1 and a900-second visual day. Native client sends no empty resident planning request; actual server returns a schedule skip without a provider or budget reservation. Controlled manual steward reply checks UI availability, not real host work. No user browser/data/key, accelerated time, human or physical-device acceptance.',cases:[],passed:false};
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],automaticNpcRequests:0,manualRequests:0,passed:false};report.cases.push(row);
  const directory=await mkdtemp(join(out,theme+'-fictional-')),clockFile=join(directory,'environment/environment-clock.json'),clock={...DEFAULT_CLOCK,clockId:'night-plan-'+theme,epochMs:Date.now(),phaseAtEpoch:2/24};
  await mkdir(join(directory,'environment'),{recursive:true});await writeFile(clockFile,JSON.stringify(clock));
  const service=await createLanHttpServer({directory,port:0,enrollmentKey:'NIGHT-PLANNING-FIXTURE'}),base='http://127.0.0.1:'+service.port;
  const account=await service.identities.register({login:'night_plan_'+theme,password:'fictional-night-password',name:'夜间测试岛主',islandName:'夜间规划岛',avatar:'female_1',theme});await service.tenants.open(account.token,theme);
  const tenant=await service.tenants.get(account.token),initial=await tenant.saves.current(theme),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/api/**',r=>{
   const path=new URL(r.request().url()).pathname;
   if(path==='/api/npc/tick')row.automaticNpcRequests++;
   if(path==='/api/hermes/command'){row.manualRequests++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'hermes',model:'deepseek-flash',answer:'夜间手动委托入口可用，这是隔离测试回复。',commands:[],plans:[],parties:[],operations:[]})});}
   if(/^\/api\/hermes\/(plan|tick|converse)$/.test(path)||path==='/api/npc/interact'||path==='/api/lan/social/tick')return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Provider calls disabled for the isolated night fixture"}'});
   return r.continue();
  });page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   await page.waitForFunction(async()=>{const {worldEnvironment}=await import('/src/environmentClient.js');const e=worldEnvironment().sample();return e.clockId.startsWith('night-plan-')&&e.hour<4.5;},null,{timeout:30000});
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   await page.waitForFunction(()=>islandInspect().health.deepseek.includes('休息'),null,{timeout:30000});
   await page.locator('#stewardBtn').click();await page.locator('#hermesInput').fill('夜里也请保留我的手动委托入口。');await page.locator('#hermesSend').click();await page.waitForFunction(()=>islandInspect().chat.messages.some(m=>m.status==='done'&&m.text.includes('夜间手动委托入口可用')),null,{timeout:30000});
   await page.waitForTimeout(6000);assert.equal(row.automaticNpcRequests,0);assert.equal(row.manualRequests,1);assert.deepEqual(row.errors,[]);
   const npc=await page.evaluate(()=>islandInspect().npcs);for(const n of npc)assert(n.intent?.action==='sleep'||PERMANENT_HOMES.some(h=>h.ownerId===n.id&&h.id===n.inside),'Night actors must head home or be home');
   await page.screenshot({path:join(out,theme+'-night-manual-entry.png')});
   const response=await fetch(base+'/api/npc/tick',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'hd_lan_session='+account.token,'X-HD-Island':account.view.me.id},body:JSON.stringify({theme,saveSlot:initial.state.saveSlot,residents:[{id:0,name:'虚构夜间居民',schedule:{period:'sleep',hour:2,work:[6,15],wake:5.5,sleep:21.5,home:'测试住所'},options:[]}]})}),data=await response.json();
   assert.equal(response.status,200);assert.equal(data.source,'schedule');assert.equal(data.model,null);assert.equal(data.skipped,true);assert.deepEqual(data.decisions,[]);
   const ledger=await service.agents.work(account.token,'ledger',{});assert.equal(ledger.runs.length,0);assert.equal(ledger.channels.plans.accepted,0);row.actualServerSkippedWithoutBudget=true;
   assert.deepEqual(JSON.parse(await readFile(clockFile,'utf8')),clock);row.clockUnchanged=true;row.sleepingOrGoingHome=npc.length;row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{await context.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
