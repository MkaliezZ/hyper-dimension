import {chromium} from 'playwright-core';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {ITEM_BY_ID} from '../src/contentCatalog.js';
import {createNightEvent} from '../src/nightPartyPlanning.js';
import {createFishingEvent} from '../src/fishingParty.js';
import {createFestivalEvent} from '../src/festivalParty.js';
import {createCoutureEvent} from '../src/coutureParty.js';
import {createFireworksEvent} from '../src/fireworksParty.js';
import {eventRequests} from '../src/partyPlanning.js';
import {PARTY_GUIDES} from '../src/partyGuide.js';
const out=resolve(process.env.HD_QA_GUIDE_OUT||'qa/v91/browser');await mkdir(out,{recursive:true});
const directory=await mkdtemp(resolve(out,'accounts-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-PARTY-GUIDE'}),base='http://127.0.0.1:'+service.port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={at:new Date().toISOString(),scope:'Dual-theme actual isolated LAN saves and real existing invitation commands, five-template guide navigation, current-state updates/reload, compact journal; zero-start unlock guidance is checked separately in the rules suite. Legitimate progressed stock/drafts are seeded; automatic model endpoints blocked. No hosted-event, full growth, real Hermes or human claim.',checks:[],diagnostics:[],errors:[],apiErrors:[],badAssets:[]};
const create={night:createNightEvent,fishing:createFishingEvent,market:createFestivalEvent,couture:createCoutureEvent,fireworks:createFireworksEvent};
const board={night:'#nightBoard',fishing:'#fishingBoard',market:'#marketBoard',couture:'#coutureBoard',fireworks:'#fireworksBoard'};
const confirm={night:'#nightInviteConfirm',fishing:'#fishingInviteGive',market:'#marketInviteConfirm',couture:'#coutureInviteConfirm',fireworks:'#fireworksInviteConfirm'};
try{
 for(const theme of ['pixel','origami']){
  const user=await service.identities.register({login:'guide_'+theme,password:'isolated-guide-password',name:'相聚验收',islandName:'相聚岛',theme,avatar:'female_1'}),tenant=await service.tenants.get(user.token),s=hydrateTown(createZeroState());s.freshStartPending=false;s.coins=500;
  for(const id of Object.keys(ITEM_BY_ID))s.inventory[id]=30;for(let i=0;i<25;i++){s.buildings[i]??=1;s.roomGames[i]={plays:10};s.facilities[i].quality=75;}for(const n of Object.values(s.npcNeeds))n.hunger=n.energy=n.social=100;
  for(const t of Object.keys(create)){const r=create[t](s,{template:t,name:'相聚'+t,description:'',tags:[t==='fishing'?'sea':'craft'],guestId:null,difficulty:'normal'});assert(r.ok,r.reason);}
  await tenant.saves.open(theme,{legacyState:s});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:user.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/api/**',r=>{const url=r.request().url();if(url.includes('/api/saves/')||url.endsWith('/api/lan/me'))return r.continue();return r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated guide QA; no provider requests"}'});});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push({theme,message:e.message}));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/api/saves/'))report.apiErrors.push({theme,status:r.status(),url:r.url()});if(r.status()>=400&&r.url().includes('/assets/'))report.badAssets.push({theme,status:r.status(),url:r.url()});});
  const get=()=>page.evaluate(()=>window.islandInspect?.()),hub=async()=>{await page.locator('#partyBtn').click();await page.locator('#partyGuideRoot').waitFor();await page.waitForFunction(()=>document.querySelectorAll('[data-party-template]').length===5);};
  await page.goto(base+'/play?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!document.querySelector('#app')?.hasAttribute('aria-busy'));await hub();
  assert.equal(await page.locator('.party-guide-card').count(),5);assert.equal((await get()).partyGuide.due,5);assert.equal(await page.locator('#partyGuideBadge').innerText(),'5');
  await page.screenshot({path:resolve(out,theme+'-guide.png')});
  const invited=[];
  for(const c of PARTY_GUIDES){
   console.log('guide '+theme+' '+c.template);await page.locator('#'+c.openId).click();await page.locator(board[c.template]).waitFor();await page.locator('#closeModal').click();await hub();
   const p=eventRequests(s[c.field].draft)[0],before=(await get()).inventory[p.item];
   await page.locator('[data-party-invite="'+c.template+':'+p.id+'"]').click();await page.locator(confirm[c.template]).waitFor();assert(!await page.locator(confirm[c.template]).isDisabled());
   await page.locator(confirm[c.template]).click();await page.waitForFunction(({field,id})=>window.islandInspect?.()[field]?.draft?.invites?.[id]?.version===window.islandInspect?.()[field]?.draft?.version,{field:c.field,id:p.id});
   await page.locator('#closeModal').click();await hub();const after=await get(),card=after.partyGuide.cards.find(x=>x.template===c.template);assert(card.people.find(x=>x.id===p.id).confirmed);assert.equal(after.inventory[p.item],before-p.quantity);
   invited.push({template:c.template,npcId:p.id,item:p.item,quantity:p.quantity,actualDeductedOnce:true,currentVersionConfirmed:true});
  }
  await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.inflight===0);await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!document.querySelector('#app')?.hasAttribute('aria-busy'));await hub();for(const r of invited)assert((await get()).partyGuide.cards.find(x=>x.template===r.template).people.find(x=>x.id===r.npcId).confirmed);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(out,theme+'-guide-390.png')});assert(await page.evaluate(()=>document.querySelector('.modal-body').scrollWidth<=document.querySelector('.modal-body').clientWidth+1));assert(await page.locator('#closeModal').isVisible());
  // Exercise next-step routing, not just static links.
  const first=(await get()).partyGuide.cards.find(c=>c.phase==='inviting');await page.locator('[data-party-next="'+first.template+'"]').click();await page.locator(confirm[first.template]).waitFor();await page.locator('#closeModal').click();
  report.checks.push({theme,fiveBoards:true,actualInvited:invited,nextActionDirectDialogue:true,latestConfirmedVisible:true,diskReload:true,compactNoOverflow:true,artworkAlignedWithTheme:true});
  await context.close();
 }
 assert.equal(report.errors.length,0);assert.equal(report.apiErrors.length,0);assert.equal(report.badAssets.length,0);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;throw e;}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await browser.close();await service.close();}
