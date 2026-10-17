import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {DEFAULT_CLOCK} from '../src/environmentClock.js';
const out=resolve(process.env.HD_QA_OUT||'qa/v187/native-seasons');await mkdir(out,{recursive:true});process.env.DEEPSEEK_API_KEY='';
let fixture={...DEFAULT_CLOCK,clockId:'native-season-fixture',epochMs:Date.now(),phaseAtEpoch:.5,source:'central'};
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'private-')),port:0,enrollmentKey:'SEASON-QA',environmentClockProvider:async()=>({clock:fixture})}),base='http://127.0.0.1:'+service.port;
const report={scope:'Isolated actual home and meeting-room renderers, both themes and four seasons; no model calls or user saves. Not a whole-product or physical Mac acceptance.',cases:[],errors:[],passed:false};let browser,page;
try{await service.environmentService.refresh();browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const auth=await service.identities.register({login:'seasons_'+theme,password:'fictional-password',name:'四季试岛',islandName:'时令测试岛',avatar:'female_1',theme});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:auth.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/api/npc/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated visual fixture"}'}));
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',message=>{const text=message.text();if(text.startsWith('HD_SEASON_PROBE ')){try{report.lastProbe=JSON.parse(text.slice(16));console.log(text);}catch{}}});
  for(const surface of ['home','meeting']){
   if(surface==='meeting'){const response=await context.request.post(base+'/api/lan/action',{data:{operation:'room_create',requestId:crypto.randomUUID(),title:'四季会客',maxPlayers:4}});assert(response.ok(),await response.text());}
   report.activeStep={theme,surface,stage:'page-ready'};
   await page.goto(base+(surface==='home'?'/play?qa=1':'/?qa=1'));
   await page.waitForFunction(surface=>surface==='home'?window.islandInspect?.().serverCommerce?.ready:window.lanInspect?.().map?.loaded,surface,{timeout:60000});
   if(surface==='home'&&await page.locator('#startFirstDay').count())await page.locator('#startFirstDay').click();
   await page.evaluate(async()=>{const {terrainTileStatus}=await import('/src/mapTiles.js');window.__seasonTerrainStatus=terrainTileStatus;});
   for(const [index,season] of ['spring','summer','autumn','winter'].entries()){
    report.activeStep={theme,surface,season,stage:'season-ready'};
    fixture={...fixture,revision:fixture.revision+1,epochMs:Date.now(),seasonOffset:index*30,phaseAtEpoch:.5};await service.environmentService.synchronize(fixture);
    await page.evaluate(async()=>{const {worldEnvironment}=await import('/src/environmentClient.js');await worldEnvironment().refresh();});
    await page.waitForFunction(season=>{const s=__seasonTerrainStatus(),now=performance.now();if(!window.__seasonProbeAt||now-window.__seasonProbeAt>=5000){window.__seasonProbeAt=now;console.log('HD_SEASON_PROBE '+JSON.stringify({expected:season,season:s.season,target:s.targetSeason,from:s.fromSeason,pending:s.pending,bytes:s.bytes,limitBytes:s.limitBytes,backend:s.backend,loads:s.loads,failures:s.failures,retries:s.retries,evictions:s.evictions,visible:s.visible.length,missing:s.visible.filter(id=>!s.ready.includes(id)),failed:s.failed}));}return s.season===season&&s.targetSeason===season&&s.fromSeason===null&&s.pending===0&&s.failed.length===0&&s.visible.length>0&&s.visible.every(id=>s.ready.includes(id));},season,{timeout:60000});
    const state=await page.evaluate(surface=>({terrain:__seasonTerrainStatus(),game:surface==='home'?islandInspect():lanInspect()}),surface);
    assert.equal(state.terrain.theme,theme);assert(state.terrain.bytes<=state.terrain.limitBytes);assert.equal((surface==='home'?state.game.environment:state.game.map.environment).art.seasonalArtwork.coverage,'whole-island');
    if(surface==='home'){assert.equal(state.game.slots.length,25);assert.equal(state.game.npcs.length,16);}
    await page.screenshot({path:join(out,`${theme}-${surface}-${season}.png`)});
    const row={theme,surface,season,visibleRegions:state.terrain.visible.length,decodedBytes:state.terrain.bytes,passed:true};report.cases.push(row);console.log(JSON.stringify(row));
   }
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=report.cases.length===16;
}catch(error){report.failure=error.stack;process.exitCode=1;await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});console.error(error);}finally{await browser?.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,errors:report.errors}));}
