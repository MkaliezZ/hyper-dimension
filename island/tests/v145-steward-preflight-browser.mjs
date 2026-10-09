import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {browserLaunchOptions} from './browserRuntime.mjs';
const out=resolve(process.env.HD_QA_OUT||'qa/v145/steward-preflight');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(out,'isolated-')),calls=[];
const factory=()=>({documents:join(directory,'documents'),async call(method,args={}){if(method==='status')return{hermes:{configured:true,model:'deepseek-flash'},deepseek:{configured:true,model:'deepseek-flash'}};if(method!=='command')throw Error('Automatic providers disabled for isolated queue QA');calls.push({message:args.message,requestId:args.requestId});return{source:'local',answer:'隔离顺序测试响应（未调用模型）',commands:[],operations:[],artifacts:[]};},async close(){}});
const service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-QUEUE',agentRuntimeFactory:factory}),base='http://127.0.0.1:'+service.port;
const report={scope:'Native dual-theme steward submission while an actual server resident action receipt is deliberately delayed. Isolated zero-resource LAN saves; the command runtime is a clearly labelled fixture, no external model or real documents. Actual save/action endpoints remain authoritative. Not real Hermes acceptance.',cases:[],passed:false};let browser,page,release;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],actionHeld:false};report.cases.push(row);
  const user=await service.identities.register({login:'queue_'+theme,password:'isolated-queue-fixture',name:'顺序验证',islandName:'结算验证岛',avatar:'male_0',theme});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:user.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/api/npc/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Automatic models isolated"}'}));
  await context.route('**/api/hermes/plan',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Automatic models isolated"}'}));
  let armed=false,held=false;const gate=new Promise(r=>release=r);
  await context.route('**/api/saves/*/action',async r=>{const body=r.request().postDataJSON();if(armed&&!held&&body.kind==='resident'){held=true;const response=await r.fetch();assert.equal(response.status(),200);row.actionHeld=true;row.actionOperation=body.operation;await gate;await r.fulfill({response});}else await r.continue();});
  page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!document.querySelector('#app')?.hasAttribute('aria-busy'),null,{timeout:60000});
  if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
  await page.locator('#stewardBtn').click();await page.locator('#hermesInput').fill('queue-check-'+theme);armed=true;
  const until=Date.now()+60000;while(!row.actionHeld&&Date.now()<until)await page.waitForTimeout(100);assert(row.actionHeld,'A real resident receipt must be held');
  await page.locator('#hermesSend').click();await page.waitForTimeout(800);
  row.beforeReceipt={calls:calls.filter(c=>c.message==='queue-check-'+theme).length,status:await page.evaluate(()=>islandInspect().chat.messages.at(-1)?.status)};
  assert.equal(row.beforeReceipt.calls,0,'Agent must wait for the held save receipt');
  assert.equal(row.beforeReceipt.status,'pending','Transient in-flight settlement should wait, not reject the letter');
  release();release=null;await page.waitForFunction(m=>islandInspect().chat.messages.some(x=>x.request===m&&x.status==='done'),'queue-check-'+theme,{timeout:30000});
  row.afterReceipt={calls:calls.filter(c=>c.message==='queue-check-'+theme).length,source:await page.evaluate(()=>islandInspect().chat.messages.at(-1).source)};
  assert.equal(row.afterReceipt.calls,1);assert.equal(row.afterReceipt.source,'local');assert.deepEqual(row.errors,[]);
  await page.screenshot({path:join(out,theme+'-settled.png')});row.passed=true;await context.close();console.log(theme+' native preflight order passed');
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});}finally{release?.();await browser?.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(r=>({theme:r.theme,passed:r.passed,held:r.actionHeld,before:r.beforeReceipt,after:r.afterReceipt})),failure:report.failure}));}
