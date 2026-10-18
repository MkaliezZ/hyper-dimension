import {playLegacy,fixtureWonders} from './v199-legacy-input.mjs';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {PERMANENT_HOMES} from '../src/islandGeography.js';
import {residenceGeometry} from '../src/buildingGeometry.js';
import {RESIDENCE_LAYOUTS} from '../src/residenceLayouts.js';
const homeId=Number(process.env.HD_HOME_ID||14);assert([14,15].includes(homeId));
const out=resolve(process.env.HD_QA_OUT||'qa/v199/native-home-lan-'+homeId);await mkdir(out,{recursive:true});
process.env.DEEPSEEK_API_KEY='';
const directory=await mkdtemp(join(out,'fixture-')),server=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-HOME-TEST'}),base='http://127.0.0.1:'+server.port;
const report={passed:false,homeId,scope:'Actual LAN home /play entry and personal journal action, shared-style record after reload; curator real award provenance and steward exchange entry. One fictional local user at an ephemeral port; no live user data, browser or external model requests. Not physical multi-device testing.',errors:[],stage:'setup'};let browser,page;
try{
 const user=await server.identities.register({login:'home_fixture',password:'isolated-home-password',name:'住所验证岛主',islandName:'住所验证岛',avatar:'female_1',theme:'origami'}),tenant=await server.tenants.get(user.token),state=fixtureWonders(hydrateTown(createZeroState()));state.freshStartPending=false;state.day=9;state.player={...PERMANENT_HOMES[homeId].entry};await tenant.saves.open('origami',{legacyState:state,protect:true});
 browser=await chromium.launch(browserLaunchOptions());const context=await browser.newContext({viewport:{width:1440,height:1000}}),login=await context.request.post(base+'/api/lan/login',{data:{login:'home_fixture',password:'isolated-home-password'}});assert.equal(login.status(),200);
 await context.route('**/api/**',r=>/\/api\/(npc|hermes)\//.test(r.request().url())?r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated home check, provider disabled"}'}):r.continue());
 await context.addInitScript(()=>{window.homeJournalTrace={clicks:[],samples:[]};document.addEventListener('click',e=>{const z=e.target.closest?.('[data-home-zone]');window.homeJournalTrace.clicks.push({at:performance.now(),trusted:e.isTrusted,tag:e.target.tagName,zone:z?.dataset.homeZone||null});if(window.homeJournalTrace.clicks.length>32)window.homeJournalTrace.clicks.shift();},true);setInterval(()=>{const s=window.islandInspect?.(),i=s?.residences?.interior;if(!i)return;window.homeJournalTrace.samples.push({at:performance.now(),hidden:document.hidden,startup:s.startup,interior:i});if(window.homeJournalTrace.samples.length>32)window.homeJournalTrace.samples.shift();},1000);});
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const diagnostic=()=>page.evaluate(()=>{const s=window.islandInspect?.();return{trace:window.homeJournalTrace,startup:s?.startup,interior:s?.residences?.interior,personal:s?.serverPersonal,saveStatus:document.querySelector('#saveStatus')?.dataset.status,boot:!!document.querySelector('#islandBootNotice'),recovery:document.querySelector('#actionRecoveryDock')?.innerText,markers:[...document.querySelectorAll('.home-room [data-home-zone]')].map(b=>({zone:b.dataset.homeZone,inert:b.inert||!!b.closest('[inert]'),disabled:b.disabled,rect:(()=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})()}))};});
 const inspect=()=>page.evaluate(()=>window.islandInspect());
 const ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!window.islandInspect().startup.busy&&!document.getElementById('islandBootNotice'),null,{timeout:60000});
 const enter=async()=>{for(let i=0;i<6;i++)await page.locator('#zoomOut').click();const s=await page.evaluate(()=>window.islandInspect()),r=await page.locator('#game').boundingBox(),b=residenceGeometry(PERMANENT_HOMES[homeId],s.theme),sc=Math.max(r.width/s.worldExtent.width,r.height/s.worldExtent.height)*s.zoom;await page.mouse.click(r.x+r.width/2+(b.x+b.w/2-s.camera.x)*sc,r.y+r.height/2+(b.y+b.h*.23-s.camera.y)*sc);await page.waitForFunction(()=>window.islandInspect().residences.interior?.loaded,null,{timeout:30000});};
 const activity=RESIDENCE_LAYOUTS[homeId].zones.find(z=>z.kind==='activity').id,record=RESIDENCE_LAYOUTS[homeId].zones.find(z=>z.kind==='record').id;
 report.stage='startup';await page.goto(base+'/play?qa=1');await ready();report.stage='enter-home';await enter();report.stage='activate-activity';report.beforeActivity=await diagnostic();await page.locator('.home-room [data-home-zone="'+activity+'"]').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.game,null,{timeout:45000});
 report.activityOpened=await diagnostic();report.stage='play';
 const g=await page.evaluate(()=>window.islandInspect().residences.interior.game);

 await playLegacy(page,inspect,homeId);
 report.stage='save';await page.locator('.home-game-save').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.game?.saved,null,{timeout:30000});
 report.record=(await tenant.saves.current('origami')).state.homeActivities[homeId];assert.equal(report.record.completedDays,1);
 report.stage='theme-switch';await page.locator('#closeModal').click();await page.locator('#themePixel').click();await page.waitForFunction(()=>window.islandInspect()?.theme==='pixel'&&!window.islandInspect().startup.busy,null,{timeout:60000});await ready();
 report.stage='reload';await page.reload();await ready();assert.equal(await page.evaluate(()=>window.islandInspect().theme),'pixel');await enter();report.stage='open-record';await page.locator('.home-room [data-home-zone="'+record+'"]').click();await page.waitForFunction(id=>window.islandInspect().residences.interior?.zone===id,record,{timeout:45000});
 assert((await page.locator('.home-keepsake').innerText()).includes('1 天'));assert.equal((await tenant.saves.current('pixel')).state.homeActivities[homeId].completedDays,1);report.sharedStyleRecord=true;if(homeId===15){await page.locator('.home-room [data-home-zone="exchange"]').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.zone==='exchange',null,{timeout:45000});await page.locator('[data-home-exchange]').click();await page.waitForFunction(()=>document.getElementById('personalExchangeTab')?.getAttribute('aria-selected')==='true',null,{timeout:30000});report.exchangeEntry=true;await page.locator('#personalStewardClose').click();}
 await page.screenshot({path:join(out,'pixel-record-after-switch.png')});report.finalDiagnostic=await diagnostic();await page.locator('#closeModal').click();assert.equal(await page.locator('.home-visit').count(),0);assert.deepEqual(report.errors,[]);report.passed=true;report.stage='complete';await context.close();
}catch(error){report.failure=error.stack;report.diagnostic=await page?.evaluate(()=>{const s=window.islandInspect?.();return{trace:window.homeJournalTrace,startup:s?.startup,interior:s?.residences?.interior,personal:s?.serverPersonal,saveStatus:document.querySelector('#saveStatus')?.dataset.status,boot:!!document.querySelector('#islandBootNotice'),recovery:document.querySelector('#actionRecoveryDock')?.innerText};}).catch(()=>null);await page?.screenshot({path:join(out,'failure.png'),timeout:10000}).catch(()=>{});process.exitCode=1;}
finally{await browser?.close();await server.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure}));}
