import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';import {browserLaunchOptions} from './browserRuntime.mjs';
import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';
import {RESIDENTS} from '../src/world.js';
const out=resolve(process.env.HD_QA_OUT||'qa/npc-map-identity');await mkdir(out,{recursive:true});const directory=await mkdtemp(join(out,'isolated-'));
for(const[key,sub]of Object.entries({HD_SAVE_DIR:'saves',HD_HERMES_HOME:'hermes',HD_STEWARD_WORKDIR:'documents',HD_RUN_LEDGER_DIR:'runs',HD_ARTIFACT_DIR:'artifacts',HD_ENVIRONMENT_DIR:'environment'}))process.env[key]=join(directory,sub);
const{createLanHttpServer}=await import('../server/lanServer.mjs');const service=await createLanHttpServer({directory:join(directory,'server'),port:0,enrollmentKey:'ISOLATED-MAP-IDENTITY'}),base='http://127.0.0.1:'+service.port;
const report={at:new Date().toISOString(),scope:'Native mouse clicks on actual rendered map bodies and visible nameplates in pixel and origami, 15 residents and steward, stable card/portrait identity. Isolated fictional saves; no production data or model calls. No game-state/time injection.',cases:[],passed:false};let browser,page;
async function hoverTarget(id){await clickTarget(id,'body',true);await page.waitForFunction(id=>window.islandInspect().mapCharacters.some(n=>n.kind==='resident'&&n.npcId===id&&n.label),id,{timeout:3000});}
async function clickTarget(id,part='body',hoverOnly=false){
 for(let attempt=0;attempt<8;attempt++){
  const location=await page.evaluate(async({id,part})=>{
   const s=window.islandInspect();const {rasterTransform}=await import('/src/rasterQuality.js');const c=document.querySelector('canvas'),r=c.getBoundingClientRect();
   const t=rasterTransform(s.camera.width,s.camera.height,s.worldExtent.width,s.worldExtent.height,s.zoom,s.camera,...s.rendering.density);
   const contains=(b,p,pad=0)=>b&&p.x>=b.x-pad&&p.x<=b.x+b.w+pad&&p.y>=b.y-pad&&p.y<=b.y+b.h+pad;
   const pick=p=>[...s.mapCharacters].reverse().find(n=>contains(n.label,p)||contains(n.body,p,2));
   const target=s.mapCharacters.find(n=>n.kind==='resident'&&n.npcId===id&&n[part]);if(!target)return null;const b=target[part];let blocked=null;
   for(const fy of [.5,.3,.7])for(const fx of [.5,.3,.7]){const p={x:b.x+b.w*fx,y:b.y+b.h*fy},hit=pick(p);if(hit?.kind!=='resident'||hit.npcId!==id)continue;
    const x=r.left+(p.x*t.scale+t.ox)*r.width/s.camera.width,y=r.top+(p.y*t.scale+t.oy)*r.height/s.camera.height;
    if(document.elementFromPoint(x,y)===c)return {x,y,hit,world:p,zoom:s.zoom};blocked={x,y,blocked:true};}
   return blocked;
  },{id,part});
  if(!location){await page.waitForTimeout(80);continue;}if(location.blocked){const c=await page.locator('canvas').first().boundingBox(),x=c.x+c.width*.5,y=c.y+c.height*.6;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+c.x+c.width/2-location.x,y+c.y+c.height/2-location.y,{steps:6});await page.mouse.up();await page.waitForTimeout(30);continue;}if(hoverOnly){await page.mouse.move(location.x,location.y);return location;}await page.mouse.click(location.x,location.y);
  if(id===15){await page.locator('.steward-conversation-modal').waitFor({timeout:4000});return location;}
  try{await page.locator('.resident-modal').waitFor({timeout:1200});}catch{continue;}
  const actual=await page.locator('.resident-modal').getAttribute('data-npc-id');assert.equal(Number(actual),id,'native map click must open its exact stable identity');
  assert.equal(await page.locator('.portrait-caption h3').innerText(),RESIDENTS[id].name);
  assert.equal(await page.locator('.resident-atlas-portrait').getAttribute('aria-label'),RESIDENTS[id].name+'的成人比例半身立绘');return location;
 }
 throw Error('No exposed '+part+' click target for '+RESIDENTS[id].name);
}
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,clicks:[],errors:[],badAssets:[]};report.cases.push(row);
  const account=await service.identities.register({login:'identity_'+theme,password:'fictional-map-fixture',name:'演示岛主',islandName:'身份核对岛',avatar:'female_1',theme}),tenant=await service.tenants.get(account.token);
  const s=hydrateTown(createZeroState());s.freshStartPending=false;s.player={x:RESIDENTS[12].start[0],y:RESIDENTS[12].start[1]+20};for(let i=0;i<16;i++)s.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};
  await tenant.saves.open(theme,{legacyState:s,protect:true});
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1.25,extraHTTPHeaders:{'X-HD-Island':tenant.accountId}});
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);await context.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;return path.startsWith('/api/npc/')||path.startsWith('/api/hermes/')?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Models disabled in isolated map UI test"}'}):route.continue();});
  page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(r.status());});
  await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!document.querySelector('#app')?.hasAttribute('aria-busy'),null,{timeout:45000});
  await page.locator('#cameraHome').click();await hoverTarget(12);
  const click=await clickTarget(12,'label');row.clicks.push({id:12,name:'黎音',part:'label',zoom:click.zoom,passed:true});await page.screenshot({path:join(out,theme+'-liyin-card.png')});await page.locator('#closeModal').click();
  for(const id of [1,...RESIDENTS.filter(r=>![1,12,15].includes(r.id)).map(r=>r.id),12,15]){
   const hit=await clickTarget(id);row.clicks.push({id,name:RESIDENTS[id].name,part:'body',zoom:hit.zoom,passed:true});await page.locator('#closeModal').click();
  }
  // Use real zoom controls and pointer drag, then click the visible nameplate again.
  await page.locator('#zoomIn').click();await page.locator('#zoomIn').click();const c=await page.locator('canvas').first().boundingBox();await page.mouse.move(c.x+c.width/2,c.y+c.height*.65);await page.mouse.down();await page.mouse.move(c.x+c.width/2+45,c.y+c.height*.65+20,{steps:6});await page.mouse.up();
  await hoverTarget(12);const moved=await clickTarget(12,'label');row.clicks.push({id:12,name:'黎音',part:'label-after-zoom-drag',zoom:moved.zoom,passed:true});await page.locator('#closeModal').click();
  assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;console.log(theme+': '+row.clicks.length+' native map identity clicks passed');await context.close();
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});report.lastInspect=await page?.evaluate(()=>{const s=window.islandInspect?.();return s?{theme:s.theme,targets:s.mapCharacters,npcs:s.npcs,camera:s.camera,zoom:s.zoom}:null;}).catch(()=>null);console.error(e);}
finally{await browser?.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,clicks:c.clicks.length})),failure:report.failure}));}
