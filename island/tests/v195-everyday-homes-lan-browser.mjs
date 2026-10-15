import {bakingChallenge,photographyChallenge,solvePhotoFrame} from '../src/homeEverydayActivities.js';
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
import {gatheringChallenge,solveGathering,starChartChallenge} from '../src/homeSocialActivities.js';
import {botanicalChallenge,solveBotanical,riggingChallenge} from '../src/homeCraftActivities.js';
import {RESIDENCE_LAYOUTS} from '../src/residenceLayouts.js';
const homeId=Number(process.env.HD_HOME_ID||7);assert([6,7].includes(homeId));
const out=resolve(process.env.HD_QA_OUT||'qa/v195/native-home-lan-'+homeId);await mkdir(out,{recursive:true});
process.env.DEEPSEEK_API_KEY='';
const directory=await mkdtemp(join(out,'fixture-')),server=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-HOME-TEST'}),base='http://127.0.0.1:'+server.port;
const report={passed:false,homeId,scope:'Actual LAN home /play entry and personal journal action, shared-style record after reload. One fictional local user at an ephemeral port; no live user data, browser or external model requests. Not physical multi-device testing.',errors:[]};let browser;
try{
 const user=await server.identities.register({login:'home_fixture',password:'isolated-home-password',name:'住所验证岛主',islandName:'住所验证岛',avatar:'female_1',theme:'origami'}),tenant=await server.tenants.get(user.token),state=hydrateTown(createZeroState());state.freshStartPending=false;state.player={...PERMANENT_HOMES[homeId].entry};await tenant.saves.open('origami',{legacyState:state,protect:true});
 browser=await chromium.launch(browserLaunchOptions());const context=await browser.newContext({viewport:{width:1440,height:1000}}),login=await context.request.post(base+'/api/lan/login',{data:{login:'home_fixture',password:'isolated-home-password'}});assert.equal(login.status(),200);
 await context.route('**/api/**',r=>/\/api\/(npc|hermes)\//.test(r.request().url())?r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated home check, provider disabled"}'}):r.continue());
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const inspect=()=>page.evaluate(()=>window.islandInspect());
 const ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!window.islandInspect().startup.busy&&!document.getElementById('islandBootNotice'),null,{timeout:60000});
 const enter=async()=>{for(let i=0;i<6;i++)await page.locator('#zoomOut').click();const s=await page.evaluate(()=>window.islandInspect()),r=await page.locator('#game').boundingBox(),b=residenceGeometry(PERMANENT_HOMES[homeId],s.theme),sc=Math.max(r.width/s.worldExtent.width,r.height/s.worldExtent.height)*s.zoom;await page.mouse.click(r.x+r.width/2+(b.x+b.w/2-s.camera.x)*sc,r.y+r.height/2+(b.y+b.h*.23-s.camera.y)*sc);await page.waitForFunction(()=>window.islandInspect().residences.interior?.loaded,null,{timeout:30000});};
 const activity=RESIDENCE_LAYOUTS[homeId].zones.find(z=>z.kind==='activity').id,record=RESIDENCE_LAYOUTS[homeId].zones.find(z=>z.kind==='record').id;
 await page.goto(base+'/play?qa=1');await ready();await enter();await page.locator('.home-room [data-home-zone="'+activity+'"]').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.game,null,{timeout:45000});
 const g=await page.evaluate(()=>window.islandInspect().residences.interior.game);
   if(homeId===6){const c=bakingChallenge(g.day);assert(await page.locator('.home-game-save').isDisabled());await page.locator('[data-home-bake-slot="1,0"]').click();assert((await page.locator('.home-game-feedback').innerText()).includes('揉面台'));for(const task of c.tasks){await page.locator('[data-home-bake-task="'+task.id+'"]').click();await page.locator('[data-home-bake-slot="'+task.station+','+c.solution[task.id]+'"]').click();}await page.locator('[data-home-bake-play]').click();assert.equal(await page.locator('.home-baking-timeline.preview').count(),1);}
   else if(homeId===7){const c=photographyChallenge(g.day);await page.locator('[data-home-shutter]').click();assert((await page.locator('.home-game-feedback').innerText()).includes('再调整'));for(const shot of c.shots){const answer=solvePhotoFrame(shot),w=650-Math.round((650-answer.w)/20)*20;for(let n=650;n>w;n-=20)await page.locator('[data-home-lens="-20"]').click();const current=(await inspect()).residences.interior.game.frame,target={x:shot.subject[0]-w*shot.gx,y:shot.subject[1]-w*.75*shot.gy};const box=await page.locator('.home-viewfinder').boundingBox();const contentWidth=await page.locator('.home-viewfinder').evaluate(el=>el.clientWidth),x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+(current.x-target.x)*contentWidth/w,y+(current.y-target.y)*contentWidth/w,{steps:6});await page.mouse.up();assert.equal(await page.locator('.home-photo-focus.ready').count(),1);await page.locator('[data-home-shutter]').click();}assert.equal(await page.locator('.home-photo-contact .home-photo-crop').count(),4);}
 await page.locator('.home-game-save').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.game?.saved,null,{timeout:30000});
 report.record=(await tenant.saves.current('origami')).state.homeActivities[homeId];assert.equal(report.record.completedDays,1);
 await page.locator('#closeModal').click();await page.locator('#themePixel').click();await page.waitForFunction(()=>window.islandInspect()?.theme==='pixel'&&!window.islandInspect().startup.busy,null,{timeout:60000});await ready();
 await page.reload();await ready();assert.equal(await page.evaluate(()=>window.islandInspect().theme),'pixel');await enter();await page.locator('.home-room [data-home-zone="'+record+'"]').click();await page.waitForFunction(id=>window.islandInspect().residences.interior?.zone===id,record,{timeout:45000});
 assert((await page.locator('.home-keepsake').innerText()).includes('1 天'));assert.equal((await tenant.saves.current('pixel')).state.homeActivities[homeId].completedDays,1);if(homeId===7)assert.equal(await page.locator('.home-saved-photos .home-photo-crop').count(),4);report.sharedStyleRecord=true;
 await page.screenshot({path:join(out,'pixel-record-after-switch.png')});await page.locator('#closeModal').click();assert.equal(await page.locator('.home-visit').count(),0);assert.deepEqual(report.errors,[]);report.passed=true;await context.close();
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{await browser?.close();await server.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure}));}
