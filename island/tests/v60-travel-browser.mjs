import {chromium} from 'playwright-core';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import assert from 'node:assert/strict';import {createLanHttpServer} from '../server/lanServer.mjs';
const out='qa/v60/browser';await mkdir(out,{recursive:true});const directory=await mkdtemp(resolve(out+'/fixture-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'TRAVEL-BROWSER-FIXTURE'}),base='http://127.0.0.1:'+service.port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),report={checks:[],errors:[],badAssets:[],fixture:directory,physicalDevices:false};let last;
try{for(const theme of ['pixel','origami']){
const contexts=[],pages=[],tokens=[];
for(let i=0;i<2;i++){const c=await browser.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();contexts.push(c);pages.push(p);last=p;p.on('pageerror',e=>report.errors.push(theme+': '+e.message));p.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url());});await p.goto(base+'/?qa=1');await p.locator('#lanRegisterTab').click();
for(const [id,value]of [['lanLogin','travel_'+theme+'_'+i],['lanPassword','fixture-password'],['lanName','同行岛主'+i],['lanIsland','同行测试岛'+i],['lanEnrollment','TRAVEL-BROWSER-FIXTURE']])await p.locator('#'+id).fill(value);
await p.locator('#lanTheme').selectOption(theme);await p.locator('#lanAuthSubmit').click();await p.waitForSelector('#lanCreateForm');
const token=(await c.cookies()).find(x=>x.name==='hd_lan_session').value;tokens.push(token);await service.tenants.open(token,theme,{});
await p.reload();await p.locator('#lanTravelPanel').waitFor();await p.locator('#lanTravelChoices summary').click();await p.locator('[data-travel-npc="0"]').click();await p.waitForFunction(()=>window.lanInspect().view.travel.selected.length===1);await p.locator('[data-travel-npc="1"]').click();await p.waitForFunction(()=>window.lanInspect().view.travel.selected.length===2);
assert.equal(await p.locator('[data-travel-npc="2"]').isDisabled(),true);
if(i===0)await p.locator('#lanTravelPanel').screenshot({path:out+'/'+theme+'-preparation.png'});
}
const [host,guest]=pages;await host.locator('#lanCreateForm button').click();await host.locator('#lanInviteCode').waitFor();const code=await host.locator('#lanInviteCode').innerText();
await guest.locator('#lanJoinCode').fill(code);await guest.locator('#lanJoinForm button').click();await guest.locator('#lanInviteCode').waitFor();
for(const p of pages)await p.waitForFunction(()=>window.lanInspect()?.map?.loaded&&window.lanInspect().map.members.length===8);
await host.waitForTimeout(1300);const initial=await host.evaluate(()=>window.lanInspect().map.members.map(x=>({id:x.id,x:x.x,y:x.y})));await host.waitForTimeout(1600);const moved=await host.evaluate(()=>window.lanInspect().map.members);assert(moved.some(m=>{const old=initial.find(x=>x.id===m.id);return m.id.includes(':npc:')&&Math.hypot(m.x-old.x,m.y-old.y)>1;}));
assert.equal(await host.locator('.lan-travel-person').count(),6);
await host.screenshot({path:out+'/'+theme+'-room.png'});
await guest.setViewportSize({width:390,height:780});await guest.screenshot({path:out+'/'+theme+'-compact.png',fullPage:true});
assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
await guest.locator('#lanLeaveRoom').click();await guest.locator('#lanTravelPanel').waitFor();assert.equal(await guest.locator('[data-travel-npc="0"]').getAttribute('data-travel-operation'),'travel_remove');
await host.waitForFunction(()=>window.lanInspect().map.members.length===4);
report.checks.push({theme,independentSessions:2,inviteThroughUI:true,capacityDisabled:true,renderedPeople:8,residentCards:6,animatedMovement:true,compactNoOverflow:true,leaveRemovesGuestParty:true});
for(const c of contexts)await c.close();
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.badAssets,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;await last?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await service.close();}
console.log(JSON.stringify(report));
