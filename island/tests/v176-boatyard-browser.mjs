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
import {productionGeometry} from '../src/buildingGeometry.js';
import {SLOTS,BUILDINGS} from '../src/world.js';
const phase=process.env.HD_QA_PHASE||'after',out=path.resolve(process.env.HD_QA_OUT||'qa/v176/boatyard-native');await mkdir(out,{recursive:true});
const report={scope:'Two actual styles in isolated saves. Native building catalogue focus, map click, walking and indoor entrance. Before/after screenshots; no user saves/model calls.',phase,cases:[]};let browser;
try{browser=await chromium.launch(browserLaunchOptions());for(const theme of ['pixel','origami']){
 const row={theme,buildings:[],errors:[],badAssets:[]};report.cases.push(row);const dir=await mkdtemp(path.join(out,theme+'-')),store=createSaveStore({directory:path.join(dir,'saves')}),state=hydrateTown(createZeroState());state.freshStartPending=false;state.player={...SLOTS[23].entry};await store.open(theme,{legacyState:state,protect:true});
 const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const server=spawn(process.execPath,['server.mjs','--port='+port,'--theme='+theme],{windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(dir,'saves'),HD_RUN_LEDGER_DIR:path.join(dir,'runs'),HD_ENVIRONMENT_DIR:path.join(dir,'environment')}}),context=await browser.newContext({viewport:{width:1600,height:1100}}),page=await context.newPage(),base='http://127.0.0.1:'+port;
 page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(new URL(r.url()).pathname);});await context.route('**/api/**',r=>/\/api\/(saves\/|status$|world\/)/.test(r.request().url())?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated parcel QA; no models"}'}));
 const ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!window.islandInspect().startup.busy&&!document.getElementById('islandBootNotice'),null,{timeout:60000});
 const terrain=()=>page.waitForFunction(()=>{const t=window.islandInspect?.().rendering.terrain;return t?.visible.length>0&&!t.pending&&!t.failed.length&&t.visible.every(id=>t.ready.includes(id));},null,{timeout:60000});
 async function clickWorld(p){const s=await page.evaluate(()=>window.islandInspect()),r=await page.locator('#game').boundingBox(),sc=Math.max(r.width/s.worldExtent.width,r.height/s.worldExtent.height)*s.zoom;await page.mouse.click(r.x+r.width/2+(p.x-s.camera.x)*sc,r.y+r.height/2+(p.y-s.camera.y)*sc);}
 try{for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break;}catch{}await page.waitForTimeout(100);}await page.goto(base+'/?qa=1');await ready();for(let i=0;i<4;i++)await page.locator('#zoomIn').click();
  for(const id of [23,20]){await page.locator('#buildBtn').click();await page.locator('[data-focus="'+id+'"]').click();await terrain();await page.screenshot({path:path.join(out,theme+'-'+id+'-'+phase+'.png')});const geometry=productionGeometry(SLOTS[id],theme),check={id,name:BUILDINGS[id].name,slot:SLOTS[id],geometry};row.buildings.push(check);
   if(phase==='after'){await clickWorld({x:geometry.doorX,y:geometry.foot-geometry.h*.45});await page.locator('#enterSlot').waitFor({timeout:45000});assert((await page.locator('#modalRoot').textContent()).includes(BUILDINGS[id].name));check.arrival=await page.evaluate(()=>window.islandInspect().actor);assert(Math.hypot(check.arrival.x-SLOTS[id].entry.x,check.arrival.y-SLOTS[id].entry.y)<20);await page.locator('#enterSlot').click();await page.waitForFunction(id=>window.islandInspect().scene==='workshop'&&window.islandInspect().sceneBuilding===id,id);check.enteredCorrectRoom=true;await page.screenshot({path:path.join(out,theme+'-'+id+'-interior.png')});await page.locator('#sceneBack').click();await ready();}
  }
  assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;
 }catch(e){row.failure=e.stack;await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});}finally{await context.close();if(server.exitCode===null){const done=new Promise(r=>server.once('close',r));server.kill();await done;}await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({theme,phase,passed:row.passed,failure:row.failure}));}
}report.passed=report.cases.every(r=>r.passed);if(!report.passed)process.exitCode=1;}finally{await browser?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
