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
import {rasterTransform} from '../src/rasterQuality.js';
import {worldWalkable,setWorldTheme,HOTSPOTS} from '../src/world.js';

const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.env.HD_QA_OUT||'qa/v203/native-scene-return');
await mkdir(out,{recursive:true});
const report={scope:'Fictional historical bad-coordinate saves; native mining and hoeing, then forest gathering and refresh in both themes. No provider requests, injected gameplay time, completed action or material grants.',cases:[],passed:false};
const portFor=async()=>{const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;};
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami']){
  const row={theme,stage:'setup',errors:[],badAssets:[]};report.cases.push(row);
  const directory=await mkdtemp(path.join(out,theme+'-')),store=createSaveStore({directory:path.join(directory,'saves')}),state=hydrateTown(createZeroState());
  state.freshStartPending=false;state.player={x:500,y:240};await store.open(theme,{legacyState:state,protect:true});
  const port=await portFor(),base='http://127.0.0.1:'+port;
  const server=spawn(process.execPath,[path.join(root,'server.mjs'),'--theme='+theme,'--port='+port],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(directory,'saves'),HD_RUN_LEDGER_DIR:path.join(directory,'runs'),HD_ENVIRONMENT_DIR:path.join(directory,'environment')}});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await context.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return p.startsWith('/api/npc/')||p.startsWith('/api/hermes/')||p.endsWith('/suggest')?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled for scene navigation regression"}'}):r.continue();});
  page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(new URL(r.url()).pathname);});
  const inspect=()=>page.evaluate(()=>window.islandInspect());
  const ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!window.islandInspect().startup.busy&&!document.getElementById('islandBootNotice'),null,{timeout:60000});
  const close=async()=>{if(await page.locator('#closeModal').isVisible())await page.locator('#closeModal').click();};
  async function clickScene(p){const s=await inspect(),b=await page.locator('#game').boundingBox(),t=rasterTransform(s.camera.width,s.camera.height,1000,660,s.zoom,s.camera,...s.rendering.density);await page.mouse.click(b.x+t.ox+p.x*t.scale,b.y+t.oy+p.y*t.scale);}
  async function gather(id){await close();const old=(await inspect()).journey.stats.gathered[id]||0;await page.locator('#gatherBtn').click();await page.locator('[data-gather="'+id+'"]').click();await page.waitForFunction(({id,old})=>(window.islandInspect().journey.stats.gathered[id]||0)>old&&!window.islandInspect().actor.action,{id,old},{timeout:60000});assert.equal((await inspect()).scene,'world');}
  try{
   for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
   await page.goto(base+'/?qa=1');await ready();setWorldTheme(theme);const start=(await inspect()).actor;assert(worldWalkable(start.x,start.y));row.recoveredStart={x:start.x,y:start.y};
   row.stage='mine';await page.locator('#gatherBtn').click();await page.locator('[data-source="mine"]').click();await page.locator('[data-gather="ore"]').click();await page.waitForFunction(()=>window.islandInspect().scene==='mine');
   const old=(await inspect()).journey.stats.gathered.ore||0;
   for(let tries=0;((await inspect()).journey.stats.gathered.ore||0)<=old;tries++){
    assert(tries<12,'targeted mining must finish');const s=await inspect(),index=s.oreNodes.findIndex((n,i)=>n.hp>0&&!s.serverFieldNpc.jobs.some(j=>j.index===i));assert(index>=0);await clickScene(s.mineRocks[index]);
    try{await page.locator('#mineStrike').waitFor({timeout:12000});}catch(e){const next=await inspect();if(next.serverFieldNpc.jobs.some(j=>j.index===index)&&!next.serverField.active)continue;throw e;}
    await page.waitForFunction(()=>{const g=window.islandInspect().roomGame;return g?.engine==='mine'&&Math.abs(g.value-.5)<.025;},null,{timeout:12000});await page.locator('#mineStrike').click();await page.waitForFunction(()=>!window.islandInspect().serverField.active&&!window.islandInspect().actor.action,null,{timeout:30000});
   }
   const mined=await store.current(theme);assert.deepEqual(mined.state.player,row.recoveredStart,'mining checkpoints must preserve the outdoor return point');row.mineSavedPlayer=mined.state.player;
   row.stage='mine-to-forest';await gather('wax');row.wax=(await inspect()).journey.stats.gathered.wax;const outside=await store.current(theme);row.farmReturnPoint=outside.state.player;
   row.stage='farm';await page.locator('[data-go="farm"]').click();await page.waitForFunction(()=>window.islandInspect().scene==='farm');const s=await inspect(),plot=s.farmPlots[0],p=plot.corners.reduce((a,c)=>({x:a.x+c.x/4,y:a.y+c.y/4}),{x:0,y:0});await clickScene(p);await page.waitForFunction(()=>window.islandInspect().plots[0].stage===1&&!window.islandInspect().actor.action,null,{timeout:30000});
   const hoed=await store.current(theme),farm=HOTSPOTS.find(h=>h.type==='farm');assert(worldWalkable(hoed.state.player.x,hoed.state.player.y),'farm checkpoints must preserve a walkable outdoor point');assert(Math.hypot(hoed.state.player.x-farm.entry.x,hoed.state.player.y-farm.entry.y)<35,'the farm shortcut walks to the actual outdoor entrance before entering');row.farmSavedPlayer=hoed.state.player;
   row.stage='farm-to-forest';await gather('fiber');row.fiber=(await inspect()).journey.stats.gathered.fiber;
   row.stage='refresh';await page.reload();await ready();const after=(await inspect()).actor;assert(worldWalkable(after.x,after.y));await gather('wood');
   await page.screenshot({path:path.join(out,theme+'-returned.png')});assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;
  }catch(e){row.failure=e.stack;await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});throw e;}
  finally{await context.close();server.kill();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,stage:c.stage,passed:c.passed,failure:c.failure}))}));}
