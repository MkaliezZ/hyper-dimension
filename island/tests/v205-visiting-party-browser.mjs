import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {hydrateTown} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';

const out=resolve(process.env.HD_QA_OUT||'qa/v205/native-visiting-party');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'VISITING-PARTY'}),base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Native invitations, mixed-theme owners, mandatory personalised Hermes steward plus two consenting AI companions each, host map identities, frozen party, refresh and return to the original save. Fictional accounts, no provider calls, real time, same Windows host; not physical-device acceptance.',cases:[],passed:false};
try{
 for(const hostTheme of ['pixel','origami']){
  const row={hostTheme,errors:[],badAssets:[]};report.cases.push(row);const accounts=[],contexts=[],pages=[],before=[];
  try{
   for(let n=0;n<2;n++){
    const theme=n?(hostTheme==='pixel'?'origami':'pixel'):hostTheme,a=await service.identities.register({login:hostTheme+'_visitor_'+n,password:'fictional-password-only',name:'虚构岛主'+n,islandName:'虚构同游岛'+n,avatar:n?'female_2':'male_1',theme}),store=(await service.tenants.get(a.token)).saves,state=hydrateTown(createZeroState());
    state.saveSlot='hyper-dimension-'+theme+'-v3-restart-'+a.view.me.id;state.freshStartPending=false;state.npcProfiles[15]={name:n?'月桂管家':'松风管家'};state.butlerAvatar=n?'female_3':'male_4';await store.open(theme,{legacyState:state,protect:true});before.push(await store.current(theme));accounts.push(a);
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();contexts.push(context);pages.push(page);await context.addCookies([{name:'hd_lan_session',value:a.token,url:base,httpOnly:true,sameSite:'Strict'}]);
    await context.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return /\/api\/(npc|hermes)\//.test(p)||p==='/api/lan/social/tick'?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Models disabled for visiting-party regression"}'}):r.continue();});
    page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(new URL(r.url()).pathname);});
    await page.goto(base+'/?qa=1');await page.locator('#lanTravelPanel').waitFor();await page.locator('#lanTravelChoices summary').click();
    for(const npcId of [0,1]){await page.locator('[data-travel-npc="'+npcId+'"]').click();await page.waitForFunction(id=>window.lanInspect().view.travel.selected.includes(id),npcId);}
    assert(await page.locator('[data-travel-npc="2"]').isDisabled());
   }
   const[host,guest]=pages;await host.locator('#lanCreateForm button').click();await host.locator('#lanInviteCode').waitFor();await guest.locator('#lanJoinCode').fill(await host.locator('#lanInviteCode').innerText());await guest.locator('#lanJoinForm button').click();
   for(const page of pages)await page.waitForFunction(()=>window.lanInspect?.().map?.loaded&&window.lanInspect().view.room?.members.length===2,null,{timeout:60000});
   const snapshot=await host.evaluate(()=>window.lanInspect()),people=snapshot.view.room.members.flatMap(m=>m.travel.members);assert.equal(people.length,6);assert.equal(new Set(people.map(p=>p.actorId)).size,6);
   for(let n=0;n<2;n++){
    const member=snapshot.view.room.members.find(m=>m.id===accounts[n].view.me.id);assert.equal(member.travel.members[0].kind,'hermes');assert.equal(member.travel.members[0].name,n?'月桂管家':'松风管家');assert.equal(member.travel.members[0].appearance,n?'female_3':'male_4');assert.equal(member.travel.homeWorldKey,before[n].state.saveSlot);for(const p of member.travel.members){assert.equal(p.ownerAccountId,accounts[n].view.me.id);assert(snapshot.map.members.some(x=>x.id===p.actorId),p.actorId+' must render as its original identity');}
   }
   await guest.reload();await guest.waitForFunction(()=>window.lanInspect?.().map?.loaded&&window.lanInspect().view.room?.members.length===2);const refreshed=await guest.evaluate(()=>window.lanInspect().view.room.members.flatMap(m=>m.travel.members.map(p=>p.actorId)));assert.deepEqual(refreshed.sort(),people.map(p=>p.actorId).sort());
   await guest.setViewportSize({width:390,height:844});assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await guest.screenshot({path:join(out,hostTheme+'-guest-390.png')});await host.screenshot({path:join(out,hostTheme+'-host.png')});
   await guest.locator('#lanLeaveRoom').click();await guest.locator('#lanTravelPanel').waitFor();await host.waitForFunction(()=>window.lanInspect().view.room.members.length===1);assert.deepEqual((await guest.evaluate(()=>window.lanInspect().view.travel.selected)).sort(),[0,1]);
   const after=await(await service.tenants.get(accounts[1].token)).saves.current(accounts[1].view.me.profile.theme);assert.equal(after.state.saveSlot,before[1].state.saveSlot);assert.equal(after.state.coins,before[1].state.coins);assert.deepEqual(after.state.inventory,before[1].state.inventory);assert.equal(after.state.npcProfiles[15].name,'月桂管家');assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.personsVerified=6;row.mixedThemeIdentityPreserved=true;row.returnSavePreserved=true;row.passed=true;
  }catch(e){row.failure=e.stack;await pages.at(-1)?.screenshot({path:join(out,hostTheme+'-failure.png')}).catch(()=>{});throw e;}
  finally{for(const c of contexts)await c.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
