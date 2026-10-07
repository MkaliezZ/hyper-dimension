import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),results=[];
try{for(const theme of ['pixel','origami']){
 const p=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/**',async r=>{
  if(r.request().url().endsWith('/api/hermes/command'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'hermes',model:'deepseek-flash',answer:'已修改并回读确认。',commands:[],operations:[{tool:'document_read',path:'F:/办公资料/夜集筹备.docx',status:'done'},{tool:'document_edit',path:'F:/办公资料/夜集筹备.docx',status:'done'},{tool:'document_read',path:'F:/办公资料/夜集筹备.docx',status:'done'}]})});
  return r.fulfill({status:503,contentType:'application/json',body:'{}'});
 });
 await p.goto('http://127.0.0.1:'+(theme==='pixel'?4173:4174)+'/?qa=1');await p.locator('#stewardBtn').click();
 await p.locator('#hermesInput').fill('请修改合成测试文档');await p.locator('#hermesSend').click();
 await p.locator('.steward-host-receipts').waitFor();await p.locator('.steward-host-receipts summary').click();
 assert.equal(await p.locator('.steward-host-receipts b').count(),3);
 await p.waitForTimeout(2500);assert.ok(await p.locator('.steward-host-receipts').evaluate(e=>e.open),'Receipt stays expanded during island updates');
 await p.screenshot({path:'qa/v22/'+theme+'-document-receipts.png'});
 await p.reload();await p.locator('#stewardBtn').click();assert.equal(await p.locator('.steward-host-receipts').count(),1);
 await p.setViewportSize({width:390,height:780});assert.ok(await p.locator('.steward-host-receipts').evaluate(e=>e.open));
 const bounds=await p.locator('#modalRoot .modal').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);
 assert.deepEqual(errors,[]);results.push({theme,receipts:3,persisted:true,mobileBounds:bounds,errors});await p.close();
}}finally{await browser.close()}
await writeFile('qa/v22/document-ui.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));

