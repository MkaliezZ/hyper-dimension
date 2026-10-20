import assert from 'node:assert/strict';
import {nativeGate} from './nativeGate.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {worldWalkableForTheme} from '../src/world.js';
const out=resolve(process.env.HD_QA_OUT||'qa/v151/native-navigation');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(out,'private-'));process.env.DEEPSEEK_API_KEY='';
const service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-NAVIGATION'}),base='http://127.0.0.1:'+service.port;
// Drop actual committed HTTP replies, without a second route.fetch request.
// Browser interception errors must not replace the movement assertions or
// terminate Node before it can retain the original failure report.
const requestsInFlight=new AsyncLocalStorage(),listeners=service.server.listeners('request');let dropWindow=null;
service.server.removeAllListeners('request');
service.server.on('request',(request,response)=>requestsInFlight.run({request,response},()=>{for(const listener of listeners)listener.call(service.server,request,response);}));
const originalAction=service.identities.action;
service.identities.action=async function(token,input){
 const result=await originalAction.call(this,token,input),window=dropWindow;
 if(window&&input.operation==='room_move'){
  assert.equal(token,window.token);window.requests.push(structuredClone(input));window.receipts.push({requestId:input.requestId,replayed:result.replayed});
  if(window.dropped<3){
   const owned=requestsInFlight.getStore();assert(owned&&new URL(owned.request.url,'http://owned').pathname==='/api/lan/action');window.dropped++;
   owned.response.end=function(chunk,encoding){assert.equal(this.statusCode,200);const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==='string'?encoding:undefined);assert(bytes.length>32);window.committedResponseLosses++;this.write(bytes.subarray(0,16));this.flushHeaders();setTimeout(()=>this.destroy(),25);return this;};
  }
 }
 return result;
};
const report={scope:'Actual native browser clicks and loopback room operations; fictional accounts, deliberately delayed polling and dropped move responses. No user saves or model calls.',checks:[],errors:[],passed:false};let browser,page;const releases=new Set();
async function stage(theme,name){report.stage={theme,name,at:new Date().toISOString()};await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
try{browser=await chromium.launch(browserLaunchOptions());for(const theme of ['pixel','origami']){
 const account=await service.identities.register({login:'navigation_'+theme,password:'fictional-password',name:'海风岛主',islandName:'同行'+theme+'岛',avatar:'female_1',theme});
 const context=await browser.newContext({viewport:{width:1920,height:1080}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
 const created=await context.request.post(base+'/api/lan/action',{data:{operation:'room_create',requestId:crypto.randomUUID(),title:'海风同行',maxPlayers:4}});assert(created.ok());
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/?qa=1');await page.waitForFunction(()=>window.lanInspect?.().map?.loaded);
 await page.evaluate(()=>{window.navigationQA={flashes:0};const check=()=>{if(document.querySelector('#lanRetry'))window.navigationQA.flashes++;};new MutationObserver(check).observe(document.getElementById('lanRoot'),{childList:true,subtree:true});});
 let releasePoll,heldPoll;const pollHeld=new Promise(r=>heldPoll=r),pollRelease=new Promise(r=>releasePoll=r);let hold=true;releases.add(releasePoll);
 await context.route('**/api/lan/view',async route=>{if(!hold)return route.continue();hold=false;const response=await route.fetch();heldPoll();await pollRelease;await route.fulfill({response});});
 await stage(theme,'await-held-poll');await nativeGate(pollHeld,'held lobby view');
 let releaseMove,heldMove;const moveHeld=new Promise(r=>heldMove=r),moveRelease=new Promise(r=>releaseMove=r);releases.add(releaseMove);
 await context.route('**/api/lan/action',async route=>{if(route.request().postDataJSON().operation!=='room_move')return route.continue();heldMove();await moveRelease;await route.continue();});
 async function destination(){return page.evaluate(theme=>{const q=window.lanInspect(),me=q.view.room.members.find(m=>m.id===q.view.me.id);return{map:q.map,position:me.position};},theme);}
 async function clickRoad(){const state=await destination(),points=[{x:1032,y:624},{x:1008,y:576},{x:984,y:552},{x:780,y:470},{x:744,y:552}],target=points.find(p=>worldWalkableForTheme(theme,p.x,p.y)&&Math.hypot(p.x-state.position.x,p.y-state.position.y)>30);assert(target);const box=await page.locator('#lanMapCanvas').boundingBox(),m=state.map;await page.mouse.click(box.x+m.cssW/2+(target.x-m.camera.x)*m.scale,box.y+m.cssH/2+(target.y-m.camera.y)*m.scale);return target;}
 const mapBefore=await page.locator('#lanMapStage').boundingBox();await clickRoad();await stage(theme,'await-held-move');await nativeGate(moveHeld,'held room movement');releasePoll();await page.waitForTimeout(850);assert.equal(await page.locator('#lanRetry').count(),0);assert.equal(await page.evaluate(()=>window.navigationQA.flashes),0);const mapDuring=await page.locator('#lanMapStage').boundingBox();assert.equal(mapDuring.y,mapBefore.y);releaseMove();await page.waitForFunction(()=>!window.lanInspect().flight&&!window.lanInspect().pending);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.navigationQA.flashes),0);
 await context.unroute('**/api/lan/action');await context.unroute('**/api/lan/view');dropWindow={token:account.token,dropped:0,committedResponseLosses:0,requests:[],receipts:[]};
 await clickRoad();await page.waitForSelector('#lanRetry');assert.equal(await page.evaluate(()=>window.lanInspect().flight),0);await page.locator('#lanRetry').click();await page.waitForFunction(()=>!window.lanInspect().flight&&!window.lanInspect().pending);assert.equal(dropWindow.requests.length,4);assert(dropWindow.requests.every(input=>JSON.stringify(input)===JSON.stringify(dropWindow.requests[0])));assert.equal(dropWindow.dropped,3);assert.equal(dropWindow.committedResponseLosses,3);assert.deepEqual(dropWindow.receipts.map(r=>r.replayed),[false,true,true,true]);assert.equal(await page.locator('#lanRetry').count(),0);
 await page.screenshot({path:join(out,theme+'-recovered.png')});report.checks.push({theme,stalePollDuringMoveIgnored:true,noTransientRecoveryCard:true,mapLayoutStable:true,automaticRetriesExhausted:3,lostResponseRecoveryAvailable:true,sameRequestReplay:true,actualCommittedHttpRepliesLost:dropWindow.committedResponseLosses,noBrowserFetchAbort:true});dropWindow=null;await context.close();
}assert.deepEqual(report.errors,[]);report.passed=true;}catch(e){for(const release of releases)release();report.failure=e.stack;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));if(dropWindow)report.lossObservation={dropped:dropWindow.dropped,committedResponseLosses:dropWindow.committedResponseLosses,requests:dropWindow.requests,receipts:dropWindow.receipts};console.error(e);process.exitCode=1;}finally{await browser?.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
