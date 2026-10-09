import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {worldWalkableForTheme} from '../src/world.js';
const out=resolve(process.env.HD_QA_OUT||'qa/v151/native-navigation');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(out,'private-'));process.env.DEEPSEEK_API_KEY='';
const service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-NAVIGATION'}),base='http://127.0.0.1:'+service.port;
const report={scope:'Actual native browser clicks and loopback room operations; fictional accounts, deliberately delayed polling and dropped move responses. No user saves or model calls.',checks:[],errors:[],passed:false};let browser,page;
try{browser=await chromium.launch(browserLaunchOptions());for(const theme of ['pixel','origami']){
 const account=await service.identities.register({login:'navigation_'+theme,password:'fictional-password',name:'海风岛主',islandName:'同行'+theme+'岛',avatar:'female_1',theme});
 const context=await browser.newContext({viewport:{width:1920,height:1080}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
 const created=await context.request.post(base+'/api/lan/action',{data:{operation:'room_create',requestId:crypto.randomUUID(),title:'海风同行',maxPlayers:4}});assert(created.ok());
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/?qa=1');await page.waitForFunction(()=>window.lanInspect?.().map?.loaded);
 await page.evaluate(()=>{window.navigationQA={flashes:0};const check=()=>{if(document.querySelector('#lanRetry'))window.navigationQA.flashes++;};new MutationObserver(check).observe(document.getElementById('lanRoot'),{childList:true,subtree:true});});
 let releasePoll,heldPoll;const pollHeld=new Promise(r=>heldPoll=r),pollRelease=new Promise(r=>releasePoll=r);let hold=true;
 await context.route('**/api/lan/view',async route=>{if(!hold)return route.continue();hold=false;const response=await route.fetch();heldPoll();await pollRelease;await route.fulfill({response});});
 await pollHeld;
 let releaseMove,heldMove;const moveHeld=new Promise(r=>heldMove=r),moveRelease=new Promise(r=>releaseMove=r);
 await context.route('**/api/lan/action',async route=>{if(route.request().postDataJSON().operation!=='room_move')return route.continue();heldMove();await moveRelease;await route.continue();});
 async function destination(){return page.evaluate(theme=>{const q=window.lanInspect(),me=q.view.room.members.find(m=>m.id===q.view.me.id);return{map:q.map,position:me.position};},theme);}
 async function clickRoad(){const state=await destination(),points=[{x:1032,y:624},{x:1008,y:576},{x:984,y:552},{x:780,y:470},{x:744,y:552}],target=points.find(p=>worldWalkableForTheme(theme,p.x,p.y)&&Math.hypot(p.x-state.position.x,p.y-state.position.y)>30);assert(target);const box=await page.locator('#lanMapCanvas').boundingBox(),m=state.map;await page.mouse.click(box.x+m.cssW/2+(target.x-m.camera.x)*m.scale,box.y+m.cssH/2+(target.y-m.camera.y)*m.scale);return target;}
 const mapBefore=await page.locator('#lanMapStage').boundingBox();await clickRoad();await moveHeld;releasePoll();await page.waitForTimeout(850);assert.equal(await page.locator('#lanRetry').count(),0);assert.equal(await page.evaluate(()=>window.navigationQA.flashes),0);const mapDuring=await page.locator('#lanMapStage').boundingBox();assert.equal(mapDuring.y,mapBefore.y);releaseMove();await page.waitForFunction(()=>!window.lanInspect().flight&&!window.lanInspect().pending);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.navigationQA.flashes),0);
 await context.unroute('**/api/lan/action');await context.unroute('**/api/lan/view');let dropped=0;const requests=[];
 await context.route('**/api/lan/action',async route=>{const body=route.request().postDataJSON();if(body.operation!=='room_move')return route.continue();requests.push(body.requestId);if(!dropped){dropped++;const response=await route.fetch();assert.equal(response.status(),200);return route.abort('failed');}return route.continue();});
 await clickRoad();await page.waitForSelector('#lanRetry');assert.equal(await page.evaluate(()=>window.lanInspect().flight),0);await page.locator('#lanRetry').click();await page.waitForFunction(()=>!window.lanInspect().flight&&!window.lanInspect().pending);assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);assert.equal(await page.locator('#lanRetry').count(),0);
 await page.screenshot({path:join(out,theme+'-recovered.png')});report.checks.push({theme,stalePollDuringMoveIgnored:true,noTransientRecoveryCard:true,mapLayoutStable:true,lostResponseRecoveryAvailable:true,sameRequestReplay:true});await context.close();
}assert.deepEqual(report.errors,[]);report.passed=true;}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;}finally{await browser?.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
