import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
const out=path.resolve(process.env.HD_QA_OUT||'qa/v110/classic-results');await mkdir(out,{recursive:true});
const directory=await mkdtemp(path.join(out,'save-')),socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const server=spawn(process.execPath,['server.mjs','--port='+port],{windowsHide:true,env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:directory},stdio:'ignore'}),base='http://127.0.0.1:'+port;
let browser;const report={scope:'Isolated result lifecycle fixtures in the actual classic renderer for all four buildings and both styles. Not gameplay achievements or reward verification.',cases:[],errors:[]};
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/src/classicGames.js')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch(browserLaunchOptions());const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/classic-result-fixture*',r=>r.fulfill({contentType:'text/html',body:'<head><link rel="stylesheet" href="/src/style.css"></head><body><main id="fixture"></main></body>'}));
 for(const theme of ['pixel','origami'])for(const id of [3,7,9,11]){
  await page.goto(base+'/classic-result-fixture?theme='+theme+'&id='+id);
  await page.evaluate(async({theme,id})=>{
   const {mountClassicGame}=await import('/src/classicGames.js'),{ACTIVITY_GAMES}=await import('/src/activityGames.js');document.body.dataset.theme=theme;window.calls=0;window.restarts=0;
   window.game=mountClassicGame(document.querySelector('#fixture'),id,()=>{
    calls++;if(calls===1)return false;if(calls===2)throw Error('isolated failed submission');if(calls===3)return new Promise(resolve=>{window.resolveClaim=resolve});return true;
   },{theme,seed:1234,difficulty:1,onRestart:()=>{restarts++},resumeGame:{result:{passed:true,quality:90}}},ACTIVITY_GAMES[id]);
   game.setTransportPaused(true);
  },{theme,id});
  const claim=page.locator('.activity-finish');await claim.waitFor();await page.waitForTimeout(220);assert(await claim.isDisabled());
  await page.evaluate(()=>game.setTransportPaused(false));await page.waitForFunction(()=>game.inspect().performance.ready);assert(await claim.isEnabled());
  for(let count=1;count<=2;count++){
   await claim.click();await page.waitForFunction(n=>calls===n&&!game.inspect().claiming,count);assert(await claim.isEnabled());assert(await page.evaluate(()=>game.inspect().alive));
   assert.match(await page.locator('.activity-status').innerText(),count===1?/核对/:/结果已保留/);
  }
  await claim.click();await page.waitForFunction(()=>calls===3&&game.inspect().claiming);assert(await claim.isDisabled());
  await page.evaluate(()=>{document.querySelector('.activity-finish').click();document.querySelector('[data-difficulty="3"]').click();document.querySelector('.activity-session-controls button').click();game.setTransportPaused(true);game.setTransportPaused(false)});
  assert.equal(await page.evaluate(()=>calls),3);assert.equal(await page.evaluate(()=>restarts),0);assert(await claim.isDisabled());
  await page.evaluate(()=>{game.setTransportPaused(true);resolveClaim(false)});await page.waitForFunction(()=>!game.inspect().claiming);assert(await claim.isDisabled());
  await page.evaluate(()=>game.setTransportPaused(false));assert(await claim.isEnabled());assert(await page.evaluate(()=>game.inspect().alive));
  await claim.click();await page.waitForFunction(()=>calls===4&&!game.inspect().alive);assert(await claim.isDisabled());
  assert.equal(await page.locator('.performance-canvas').count(),0);
  report.cases.push({theme,id,refusalRetains:true,exceptionRetains:true,pendingCannotDoubleSubmitOrRestart:true,transportPauseRespected:true,successDisposes:true});
 }
 // A late callback from a closed room must not mutate its replacement.
 await page.evaluate(async()=>{
  const {mountClassicGame}=await import('/src/classicGames.js'),{ACTIVITY_GAMES}=await import('/src/activityGames.js');
  window.game=mountClassicGame(document.querySelector('#fixture'),7,()=>new Promise((_,reject)=>window.rejectClosed=reject),{resumeGame:{result:{passed:true,quality:85}}},ACTIVITY_GAMES[7]);
 });await page.locator('.activity-finish:enabled').waitFor();await page.locator('.activity-finish').click();await page.waitForFunction(()=>!!window.rejectClosed);
 await page.evaluate(()=>{game.destroy();document.querySelector('#fixture').textContent='replacement room';rejectClosed(Error('late response'))});await page.waitForTimeout(100);assert.equal(await page.locator('#fixture').innerText(),'replacement room');
 report.closedRoomLateResponseIgnored=true;assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1}finally{await browser?.close();server.kill();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
