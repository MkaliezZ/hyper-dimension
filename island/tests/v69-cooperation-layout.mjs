import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {chromium} from 'playwright-core';import {createLanHttpServer} from '../server/lanServer.mjs';
const report={checks:[],errors:[]};let browser,service;
try{browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
for(const theme of ['pixel','origami']){
 const proof=JSON.parse(await readFile('qa/v69/'+theme+'-proof.json','utf8'));
 service=await createLanHttpServer({directory:proof.directory,port:0,enrollmentKey:'SOCIAL-FIXTURE-KEY',agentRuntimeFactory:()=>({async call(){return {hermes:{configured:true}}},async close(){}})});
 const login=await service.identities.login({login:'social_0',password:'fixture-password'}),base='http://127.0.0.1:'+service.port,part=proof.cooperation.parts.find(p=>p.ownerAccountId===login.view.me.id),ctx=await browser.newContext({viewport:{width:1360,height:900}});
 await ctx.addCookies([{name:'hd_lan_session',value:login.token,url:base,httpOnly:true,sameSite:'Strict'}]);const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.route('**/api/npc/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated layout"}'}));await p.route('**/api/hermes/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated layout"}'}));
 await p.goto(base+'/play?qa=1');await p.waitForFunction(()=>window.islandInspect?.().serverFacility?.ready&&!document.getElementById('islandBootNotice'));if(await p.locator('#startFirstDay').isVisible())await p.locator('#startFirstDay').click();
 await p.locator('#residentsBtn').click();await p.locator('#residentList [data-npc="'+part.command.npcId+'"]').click();await p.locator('#residentTravelHistoryOpen').click();await p.locator('.lan-cooperation-earned').waitFor();
 await p.locator('.lan-cooperation').scrollIntoViewIfNeeded();await p.screenshot({path:'qa/v69/'+theme+'-final-desktop.png'});
 assert(await p.locator('.lan-cooperation-icon').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().width===56&&e.getBoundingClientRect().height===56)));
 await p.setViewportSize({width:390,height:820});await p.locator('.lan-cooperation').scrollIntoViewIfNeeded();await p.screenshot({path:'qa/v69/'+theme+'-final-compact.png'});assert.equal(await p.locator('#modalRoot').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 assert.equal(await p.locator('.lan-cooperation-cost').count(),2);await p.locator('#closeModal').click();await p.locator('#bagBtn').click();await p.locator('#closeModal').click();
 report.checks.push({theme,iconSize:56,costsVisible:true,actualRelationshipGain:true,compactNoOverflow:true,fixedCloseClickable:true});await ctx.close();await service.close();service=null;
}assert.deepEqual(report.errors,[]);report.passed=true;}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await service?.close();await writeFile('qa/v69/layout-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
