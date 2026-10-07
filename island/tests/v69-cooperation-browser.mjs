import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {chromium} from 'playwright-core';import {fixture,complete} from './v69-social-fixture.mjs';import {RECIPE_BY_ID} from '../src/contentCatalog.js';
await mkdir('qa/v69',{recursive:true});let browser,f,clock;
const report={checks:[],errors:[],badAssets:[],scope:'Two isolated owners, real browser controls and resident animation/runtime with real server production; fixture provides recipe ingredients; deterministic social model'};
async function history(page,id){if(!await page.locator('#residentList').isVisible())await page.locator('#residentsBtn').click();await page.locator('#residentList [data-npc="'+id+'"]').click();await page.locator('#residentTravelHistoryOpen').click();await page.locator('#residentTravelHistory .lan-social-event').waitFor();}
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  f=await fixture(theme);report.directory=f.directory;const event=await complete(f),base='http://127.0.0.1:'+f.service.port,contexts=[],pages=[];
  for(const a of f.accounts){const ctx=await browser.newContext({viewport:{width:1360,height:900}});contexts.push(ctx);await ctx.addCookies([{name:'hd_lan_session',value:a.token,url:base,httpOnly:true,sameSite:'Strict'}]);const p=await ctx.newPage();pages.push(p);p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url());});await p.goto(base+'/?qa=1');await p.locator('#lanSocial [data-cooperate="propose"]').waitFor();}
  await pages[0].locator('#lanSocial [data-cooperate="propose"]').click();await pages[0].locator('#lanSocial [data-cooperate="accept"]').click();await pages[1].locator('#lanSocial [data-cooperate="accept"]').click();
  await pages[0].locator('#lanSocial').getByText('已约好，准备返岛制作',{exact:true}).waitFor({timeout:20000});
  await pages[0].locator('#lanSocial').scrollIntoViewIfNeeded();await pages[0].screenshot({path:'qa/v69/'+theme+'-agreement.png'});
  await pages[0].locator('#lanCloseRoom').click();let lastClock=Date.now();clock=setInterval(()=>{const at=Date.now();f.advance(at-lastClock);lastClock=at;},50);
  for(const p of pages)await p.locator('#lanCreateForm').waitFor();
  const e=(await f.service.social.history(f.accounts[0].token,event.people[0].npcId,theme)).events[0];
  for(let n=0;n<2;n++){
   const c=await f.service.tenants.get(f.accounts[n].token),d=await c.saves.current(theme),s=structuredClone(d.state),part=e.cooperation.parts.find(x=>x.ownerAccountId===f.accounts[n].view.me.id),recipe=RECIPE_BY_ID[part.command.recipeId];
   s.freshStartPending=false;for(const [id,amount]of Object.entries(recipe.cost))s.inventory[id]=(s.inventory[id]||0)+amount*20;
   await c.saves.save(theme,{state:s,expectedVersion:d.version});
   const p=pages[n];await p.route('**/api/npc/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated browser verification"}'}));await p.route('**/api/hermes/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated browser verification"}'}));
   await p.goto(base+'/play?qa=1');await p.waitForFunction(()=>window.islandInspect?.().serverFacility?.ready&&!document.getElementById('islandBootNotice'));
   await history(p,part.command.npcId);await p.locator('#residentTravelHistory [data-cooperate="queue"]').click();
   await p.locator('#residentTravelHistory [data-cooperate="queue"]').waitFor({state:'hidden'});
   assert.equal((await f.service.tenants.readIslandForServer(f.accounts[n].view.me.id,theme)).state.agentTaskLedger.filter(t=>t.id===part.command.id).length,1);
   await p.setViewportSize({width:390,height:820});await p.locator('#residentTravelHistory .lan-cooperation').scrollIntoViewIfNeeded();await p.screenshot({path:'qa/v69/'+theme+'-queued-'+n+'.png'});assert.equal(await p.locator('#modalRoot').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
   await p.locator('#closeModal').click();await p.setViewportSize({width:1360,height:900});
  }
  console.log(theme+': both owners queued real resident tasks');
  let done=false;
  for(let n=0;n<180;n++){
   const h=await f.service.social.history(f.accounts[0].token,event.people[0].npcId,theme);if(h.events[0].cooperation.status==='completed'){done=true;break;}
   if(n%30===0)console.log(theme+': waiting for resident production '+JSON.stringify(h.events[0].cooperation.parts.map(p=>({npc:p.name,status:p.taskStatus,proof:!!p.proof}))));
   await new Promise(r=>setTimeout(r,1000));
  }
  assert(done,'both real browser NPCs must finish their recipes');
  await history(pages[0],event.people[0].npcId);await pages[0].locator('#residentTravelHistory').getByText('双方真实成果已核对',{exact:true}).waitFor();
  await pages[0].locator('#residentTravelHistory .lan-cooperation').scrollIntoViewIfNeeded();await pages[0].screenshot({path:'qa/v69/'+theme+'-completed.png'});
  await pages[0].locator('#closeModal').click();await pages[0].locator('#bagBtn').click();await pages[0].locator('#closeModal').click();
  report.checks.push({theme,twoOwnerConsent:true,uiQueuesOnce:true,realNpcProduction:true,serverProofs:true,compactNoOverflow:true,homeGameUsable:true});
  for(const c of contexts)await c.close();clearInterval(clock);clock=null;await f.service.close();f=null;
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badAssets,[]);report.passed=true;
}catch(e){report.failure=e.stack;for(const [i,c]of (browser?.contexts()||[]).entries()){const p=c.pages()[0];if(p){report['page'+i]=(await p.locator('body').innerText()).slice(-9000);await p.screenshot({path:'qa/v69/failure-'+i+'.png'});}}process.exitCode=1;}finally{clearInterval(clock);await browser?.close();await f?.service.close();await writeFile('qa/v69/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
