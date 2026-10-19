import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url))),out=resolve(process.env.HD_QA_OUT||'qa/v314/manual-save-feedback');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/')return res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end('<!doctype html><body><button id="saveStatus" data-status="pending">New island changes pending</button><main id="modalRoot"></main></body>');
 const file=resolve(root,'.'+pathname);if(!pathname.startsWith('/src/')||!file.startsWith(join(root,'src')+sep))return res.writeHead(404).end();
 res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'}).end(await readFile(file));
}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch(browserLaunchOptions()),base='http://127.0.0.1:'+server.address().port;
const report={scope:'Owned real DOM and actual save UI; controlled checkpoint acknowledgments/rejections only. Verifies pending versus accepted manual saves, rejected retries, navigation ownership and theme isolation. No real save authority, game resources, models, user browser or human acceptance.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami']){
  const context=await browser.newContext(),page=await context.newPage(),row={theme,errors:[],passed:false};report.cases.push(row);page.on('pageerror',error=>row.errors.push(error.message));await page.goto(base);
  await page.evaluate(async theme=>{
   document.body.dataset.theme=theme;const{createSaveUI}=await import('/src/saveUI.js'),{advanceModalNavigation}=await import('/src/modalNavigation.js');
   window.fixture={theme,calls:0,toasts:[],record:{status:'pending',message:'新进度等待保存',version:'original-version',updatedAt:'2026-10-19T00:00:00.000Z'}};
   const f=window.fixture;const openModal=(title,subtitle,body,footer)=>{advanceModalNavigation();document.querySelector('#modalRoot').innerHTML='<h2>'+title+'</h2><div>'+body+'</div><footer>'+footer+'</footer>';};
   const saves={cancelImportPreview(){},status(){return f.record;},backups:async()=>[],checkpoint(){f.calls++;return new Promise((resolve,reject)=>{f.accept=()=>{Object.assign(f.record,{version:'acknowledged-'+f.calls,updatedAt:'2026-10-19T00:00:01.000Z'});resolve();};f.reject=message=>reject(Error(message));});}};
   f.ui=createSaveUI({saves,theme:()=>f.theme,openModal,toast:message=>f.toasts.push(message)});f.navigate=()=>openModal('Another panel','','Still here','');await f.ui.show();
  },theme);
  const feedback=()=>page.locator('[data-manual-save]');
  assert.equal(await feedback().getAttribute('data-manual-save'),'idle');
  await page.locator('#saveNow').click();assert.equal(await feedback().getAttribute('data-manual-save'),'saving');assert.equal(await page.locator('#saveNow').isDisabled(),true);assert.equal(await feedback().getAttribute('data-manual-save-version'),'');assert.equal(await page.evaluate(()=>fixture.calls),1);
  await page.evaluate(()=>fixture.accept());await page.waitForFunction(()=>document.querySelector('[data-manual-save="complete"]'));
  assert.equal(await feedback().getAttribute('data-manual-save-version'),'acknowledged-1');assert.equal(await page.locator('#saveStatus').getAttribute('data-status'),'pending');assert.match(await feedback().innerText(),/本次手动保存已确认/);row.confirmedWhileNewChangesPending=true;
  await page.locator('#saveNow').click();assert.equal(await feedback().getAttribute('data-manual-save'),'saving');assert.equal(await feedback().getAttribute('data-manual-save-version'),'');await page.evaluate(()=>fixture.reject('<unconfirmed>'));
  await page.waitForFunction(()=>document.querySelector('[data-manual-save="failed"]'));assert.equal(await feedback().getAttribute('data-manual-save-version'),'');assert.match(await feedback().innerText(),/本次手动保存未确认：<unconfirmed>/);assert.equal(await page.locator('unconfirmed').count(),0);assert.equal(await page.locator('#saveNow').isEnabled(),true);row.rejectionClearsPriorSuccess=true;
  await page.locator('#saveNow').click();await page.evaluate(()=>fixture.navigate());await page.evaluate(()=>fixture.accept());await page.waitForTimeout(30);assert.equal(await page.locator('#modalRoot h2').innerText(),'Another panel');assert.equal(await feedback().count(),0);await page.evaluate(()=>fixture.ui.show());assert.equal(await feedback().getAttribute('data-manual-save-version'),'acknowledged-3');row.navigationPreserved=true;
  await page.evaluate(()=>{fixture.theme=fixture.theme==='pixel'?'origami':'pixel';return fixture.ui.show();});assert.equal(await feedback().getAttribute('data-manual-save'),'idle');await page.evaluate(()=>{fixture.theme=fixture.theme==='pixel'?'origami':'pixel';return fixture.ui.show();});assert.equal(await feedback().getAttribute('data-manual-save'),'complete');row.otherThemeDoesNotClaimOldConfirmation=true;
  assert.deepEqual(row.errors,[]);row.passed=true;await context.close();
 }
 report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
