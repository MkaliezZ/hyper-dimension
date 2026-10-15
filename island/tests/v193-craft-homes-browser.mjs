import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {PERMANENT_HOMES} from '../src/islandGeography.js';
import {residenceGeometry} from '../src/buildingGeometry.js';
import {botanicalChallenge,solveBotanical,riggingChallenge} from '../src/homeCraftActivities.js';
import {RESIDENCE_LAYOUTS} from '../src/residenceLayouts.js';
import {nurseryChallenge,solveNursery,joineryChallenge} from '../src/homeActivities.js';
import {gatheringChallenge,solveGathering,starChartChallenge} from '../src/homeSocialActivities.js';

const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.env.HD_QA_OUT||'qa/v193/native-homes');await mkdir(out,{recursive:true});
const report={version:193,scope:'Florist and shipwright independently laid out residences, each in pixel and origami. Native room navigation and game input, real personal-action persistence and reload, small-screen close. Fictional isolated saves at fresh ports, provider APIs disabled; no access to the user browser or live saves. Not all 16 residences or human acceptance.',cases:[]};
const portFor=async()=>{const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;};
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of (process.env.HD_HOME_THEMES||'pixel,origami').split(','))for(const id of (process.env.HD_HOME_IDS||'4,5').split(',').map(Number)){
  const row={theme,id,errors:[],badAssets:[],stage:'setup'};report.cases.push(row);
  const directory=await mkdtemp(path.join(out,theme+'-'+id+'-')),store=createSaveStore({directory:path.join(directory,'saves')}),state=hydrateTown(createZeroState());state.freshStartPending=false;state.player={...PERMANENT_HOMES[id].entry};await store.open(theme,{legacyState:state,protect:true});
  const port=await portFor(),server=spawn(process.execPath,[path.join(root,'server.mjs'),'--theme='+theme,'--port='+port],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(directory,'saves'),HD_RUN_LEDGER_DIR:path.join(directory,'runs'),HD_ENVIRONMENT_DIR:path.join(directory,'environment')}}),context=await browser.newContext({viewport:{width:1600,height:1100}}),page=await context.newPage(),base='http://127.0.0.1:'+port;
  page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(new URL(r.url()).pathname);});
  await context.route('**/api/**',r=>/\/api\/(saves\/|status$|world\/session|environment)/.test(r.request().url())?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated home verification, providers disabled"}'}));
  const inspect=()=>page.evaluate(()=>window.islandInspect());
  const ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!window.islandInspect().startup.busy&&!document.getElementById('islandBootNotice'),null,{timeout:60000});
  async function enter(){
   for(let i=0;i<6;i++)await page.locator('#zoomOut').click();
   const s=await inspect(),r=await page.locator('#game').boundingBox(),b=residenceGeometry(PERMANENT_HOMES[id],theme),sc=Math.max(r.width/s.worldExtent.width,r.height/s.worldExtent.height)*s.zoom;
   await page.mouse.click(r.x+r.width/2+(b.x+b.w/2-s.camera.x)*sc,r.y+r.height/2+(b.y+b.h*.23-s.camera.y)*sc);
   await page.locator('.home-room').waitFor({timeout:30000});await page.waitForFunction(()=>window.islandInspect().residences.interior?.loaded,null,{timeout:30000});
  }
  async function zone(name){await page.locator('.home-room [data-home-zone="'+name+'"]').click();await page.waitForFunction(name=>window.islandInspect().residences.interior?.zone===name,name,{timeout:15000});}
  try{
   for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
   await page.goto(base+'/?qa=1');await ready();row.stage='enter';await enter();row.room=(await inspect()).residences.interior;
   await page.screenshot({path:path.join(out,theme+'-'+id+'-room.png')});
   row.stage='furniture-paths';for(const z of RESIDENCE_LAYOUTS[id].zones){await zone(z.id);const p=(await inspect()).residences.interior.player;assert(Math.hypot(p.x-z.entry.x,p.y-z.entry.y)<12,z.name);}
   row.stage='native-game';await zone(RESIDENCE_LAYOUTS[id].zones.find(z=>z.kind==='activity').id);
   const g=(await inspect()).residences.interior.game;
   if(id===0){const c=nurseryChallenge(g.day,g.season),solution=solveNursery(c);for(let i=0;i<16;i++)if(c.givens[i]===null){await page.locator('[data-home-seed="'+solution[i]+'"]').click();await page.locator('[data-home-cell="'+i+'"]').click();}}
   else if(id===1){const c=joineryChallenge(g.day);for(const tile of [...c.scramble].reverse()){await page.locator('[data-home-wood="'+tile+'"]').click();}}
   else if(id===2){const c=gatheringChallenge(g.day),solution=solveGathering(c);for(let seat=0;seat<4;seat++){await page.locator('[data-home-guest="'+solution[seat]+'"]').click();await page.locator('[data-home-seat="'+seat+'"]').click();}assert.equal(await page.locator('.home-seat-rules .satisfied').count(),3);}
   else if(id===3){const c=starChartChallenge(g.day),wrong=c.stars.find(s=>s.id!==c.targets[0].starId);await page.locator('[data-home-star="'+wrong.id+'"]').click();assert.equal((await inspect()).residences.interior.game.values.length,0);assert((await page.locator('.home-game-feedback').innerText()).includes('不符合'));for(const target of c.targets)await page.locator('[data-home-star="'+target.starId+'"]').click();assert.equal(await page.locator('.home-observation-log .charted').count(),6);}
   if(id===4){const c=botanicalChallenge(g.day),solution=solveBotanical(c);assert(await page.locator('.home-game-save').isDisabled());for(let i=0;i<7;i++){await page.locator('[data-home-specimen="'+solution[i]+'"]').click();await page.locator('[data-home-specimen-slot="'+i+'"]').click();}assert.equal(await page.locator('.home-botanical-rules .satisfied').count(),4);}
   else if(id===5){const c=riggingChallenge(g.day);assert(await page.locator('.home-game-save').isDisabled());await page.locator('[data-home-rope-check]').click();assert.equal(await page.locator('.rope-break').count(),1);assert(await page.locator('.home-game-save').isDisabled());for(let i=0;i<16;i++)if(!c.fixed.includes(i)){const turns=(c.solution[i]-g.values[i]+4)%4;for(let n=0;n<turns;n++)await page.locator('[data-home-rope="'+i+'"]').click();}}
   assert((await inspect()).residences.interior.game.solved);
   await page.locator('.home-game-board').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));});
   await page.screenshot({path:path.join(out,theme+'-'+id+'-solved.png')});
   row.stage='save';await page.locator('.home-game-save').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.game?.saved,null,{timeout:30000});
   const saved=await store.current(theme);assert.equal(saved.state.homeActivities[id].completedDays,1);assert.equal(saved.state.coins,0);assert.equal(Object.values(saved.state.inventory).reduce((a,b)=>a+b,0),0);row.persistedRecord=saved.state.homeActivities[id];
   row.stage='reload';await page.reload();await ready();await enter();await zone(RESIDENCE_LAYOUTS[id].zones.find(z=>z.kind==='record').id);assert((await page.locator('.home-keepsake').innerText()).includes('1 天'));row.reloaded=true;
   row.stage='mobile';await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.home-marker-name:visible').count(),0);await page.screenshot({path:path.join(out,theme+'-'+id+'-mobile.png')});
   await page.locator('.modal').evaluate(el=>el.scrollTo(0,el.scrollHeight));const close=await page.locator('#closeModal').boundingBox();assert(close&&close.y>=0&&close.y+close.height<=844);await page.locator('#closeModal').click();await page.waitForFunction(()=>window.islandInspect().residences.interior===null);assert.equal(await page.locator('.home-visit').count(),0);row.cleanup=true;
   assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;row.stage='complete';
  }catch(error){row.failure=error.stack;row.diagnostic=await inspect().then(s=>({startup:s.startup,actor:s.actor,interior:s.residences.interior,personal:s.serverPersonal})).catch(()=>null);await page.screenshot({path:path.join(out,theme+'-'+id+'-failure.png')}).catch(()=>{});}
  finally{await context.close();if(server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill();await closed;}await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({theme,id,passed:row.passed,stage:row.stage,failure:row.failure}));}
 }
 report.passed=report.cases.every(c=>c.passed);if(!report.passed)process.exitCode=1;
}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
