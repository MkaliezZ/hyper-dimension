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
import {nurseryChallenge,solveNursery} from '../src/homeActivities.js';
const out=resolve(process.env.HD_QA_OUT||'qa/v191/native-home-lan');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(out,'fixture-')),server=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-HOME-TEST'}),base='http://127.0.0.1:'+server.port;
const report={passed:false,scope:'Actual LAN home /play entry and personal journal action, shared-style record after reload. One fictional local user, no external model requests; not physical multi-device testing.',errors:[]};let browser;
try{
 const user=await server.identities.register({login:'home_fixture',password:'isolated-home-password',name:'住所验证岛主',islandName:'住所验证岛',avatar:'female_1',theme:'origami'}),tenant=await server.tenants.get(user.token),state=hydrateTown(createZeroState());state.freshStartPending=false;state.player={...PERMANENT_HOMES[0].entry};await tenant.saves.open('origami',{legacyState:state,protect:true});
 browser=await chromium.launch(browserLaunchOptions());const context=await browser.newContext({viewport:{width:1440,height:1000}}),login=await context.request.post(base+'/api/lan/login',{data:{login:'home_fixture',password:'isolated-home-password'}});assert.equal(login.status(),200);
 await context.route('**/api/**',r=>/\/api\/(npc|hermes)\//.test(r.request().url())?r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated home check, provider disabled"}'}):r.continue());
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!window.islandInspect().startup.busy&&!document.getElementById('islandBootNotice'),null,{timeout:60000});
 const enter=async()=>{for(let i=0;i<6;i++)await page.locator('#zoomOut').click();const s=await page.evaluate(()=>window.islandInspect()),r=await page.locator('#game').boundingBox(),b=residenceGeometry(PERMANENT_HOMES[0],s.theme),sc=Math.max(r.width/s.worldExtent.width,r.height/s.worldExtent.height)*s.zoom;await page.mouse.click(r.x+r.width/2+(b.x+b.w/2-s.camera.x)*sc,r.y+r.height/2+(b.y+b.h*.23-s.camera.y)*sc);await page.waitForFunction(()=>window.islandInspect().residences.interior?.loaded,null,{timeout:30000});};
 await page.goto(base+'/play?qa=1');await ready();await enter();await page.locator('.home-room [data-home-zone="nursery"]').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.game,null,{timeout:15000});
 const g=await page.evaluate(()=>window.islandInspect().residences.interior.game),c=nurseryChallenge(g.day,g.season),solution=solveNursery(c);
 for(let i=0;i<16;i++)if(c.givens[i]===null){await page.locator('[data-home-seed="'+solution[i]+'"]').click();await page.locator('[data-home-cell="'+i+'"]').click();}
 await page.locator('.home-game-save').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.game?.saved,null,{timeout:30000});
 report.record=(await tenant.saves.current('origami')).state.homeActivities[0];assert.equal(report.record.completedDays,1);
 await page.locator('#closeModal').click();await page.locator('#themePixel').click();await page.waitForFunction(()=>window.islandInspect()?.theme==='pixel'&&!window.islandInspect().startup.busy,null,{timeout:60000});await ready();
 await page.reload();await ready();assert.equal(await page.evaluate(()=>window.islandInspect().theme),'pixel');await enter();await page.locator('.home-room [data-home-zone="seeds"]').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.zone==='seeds',null,{timeout:15000});
 assert((await page.locator('.home-keepsake').innerText()).includes('1 天'));assert.equal((await tenant.saves.current('pixel')).state.homeActivities[0].completedDays,1);report.sharedStyleRecord=true;
 await page.screenshot({path:join(out,'pixel-record-after-switch.png')});await page.locator('#closeModal').click();assert.equal(await page.locator('.home-visit').count(),0);assert.deepEqual(report.errors,[]);report.passed=true;await context.close();
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{await browser?.close();await server.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure}));}
