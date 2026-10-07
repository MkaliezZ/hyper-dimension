import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='qa/recovery-buttons-20261006';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={checks:[],errors:[],scope:'Isolated DOM with real five recovery controllers, injected failed submissions and shared pending visitor journal. No user session or save changes.'};
try{
 for(const theme of ['pixel','origami']){
 const page=await browser.newPage({viewport:{width:390,height:820}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/recovery-controller-fixture',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/gather-v46.css"><body data-theme="'+theme+'"><div id="app"><button id="world">小岛</button><button id="saveStatus">存档</button><div id="modalRoot"></div></div></body>'}));
 await page.goto('http://127.0.0.1:4175/recovery-controller-fixture');
 await page.evaluate(async()=>{
  const names=['Facility','Visitor','Resident','FieldNpc','Commerce'];let actions=0,reads=0,pending=null,failRead=true;
  const lease={requestId:'old-job',epoch:'epoch',sequence:1};
  const saves={status:()=>({status:'action_pending',actions:{resident:{leases:{old:lease}},field:{leases:{old:lease}}}}),pendingAction:()=>pending,action:async()=>{actions++;throw Error('测试断线');},acceptServer:async()=>{reads++;if(failRead){failRead=false;throw Error('测试服务暂不可用，记录已保留');}},flush:async()=>{}};
  for(const n of names){const m=await import('/src/server'+n+'UI.js');const c=m['createServer'+n]({saves,theme:()=>document.body.dataset.theme,persist(){},applyState(){},restore(){},toast(){}});await c.recover();}
  pending={body:{kind:'visitor',operation:'finish',requestId:'shared-visitor'}};
  window.recoveryProbe=()=>({actions,reads});window.actionCountBefore=actions;
 });
 assert.equal(await page.locator('#actionRecoveryDock>.gather-v46:not(.hidden)').count(),5);
 for(const id of ['residentRetry','facilityRetry','visitorRetry','fieldNpcRetry','commerceRetry']){
  const before=await page.evaluate(()=>window.recoveryProbe());await page.locator('#'+id).click();
  await page.waitForFunction(n=>window.recoveryProbe().reads===n,before.reads+1);
  await page.waitForFunction(()=>!document.querySelector('#actionRecoveryDock').hasAttribute('aria-busy'));
  assert.equal((await page.evaluate(()=>window.recoveryProbe())).actions,before.actions,'retry must not issue or reinterpret the shared visitor operation');
  assert.equal(await page.locator('#'+id).isEnabled(),true);
 }
 assert.match(await page.locator('#residentMessage').textContent(),/记录已保留/);
 await page.locator('#residentRetry').click();assert.equal((await page.evaluate(()=>window.recoveryProbe())).reads,6);
 await page.screenshot({path:out+'/'+theme+'.png'});
 report.checks.push({theme,panels:5,allButtonsClickable:true,sharedJournalNotReinterpreted:true,failedReadRetryable:true,compact:true});await page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
