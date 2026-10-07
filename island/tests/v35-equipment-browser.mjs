import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {hydrateTown} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {GARMENTS,TOOLS} from '../src/equipmentRules.js';
import {rasterTransform} from '../src/rasterQuality.js';
const visualOnly=process.argv.includes('--visual-only');
await mkdir('qa/v35',{recursive:true});const directory=await mkdtemp(resolve('qa/v35/browser-')),saves=createSaveStore({directory});
for(const theme of ['pixel','origami']){const s=hydrateTown(createZeroState());s.freshStartPending=false;for(const id of [...Object.keys(GARMENTS),...Object.keys(TOOLS)]){s.inventory[id]=2;s.economy.playerGoods[id]=2;}await saves.open(theme,{legacyState:s,clientId:'equipment-fixture'});}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={directory,kind:'Actual dual-theme equipment UI and map render; seeded handmade clothes/tools are explicit fixtures, not human zero-start acceptance. Provider calls blocked.',checks:[],errors:[],badImages:[]};let engine,page;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated equipment QA"}'}));
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badImages.push(r.url())});
  const get=()=>page.evaluate(()=>window.islandInspect());
  const equipment=async()=>{await page.locator('#playerBtn').click();await page.locator('#openEquipment').click();await page.waitForFunction(()=>window.islandInspect()?.equipmentPreview&&window.islandInspect().garmentAssets.metadata===8&&window.islandInspect().garmentAssets.headMetadata===2)};
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().garmentAssets.metadata===8);await equipment();
  const equipped=[];
  for(const g of Object.values(GARMENTS)){await page.locator('[data-wear-slot="'+g.slot+'"]').click();await page.locator('[data-wear="'+g.id+'"]').click();const v=await get();assert.equal(v.wardrobe.slots[g.slot].item,g.id);assert.equal(v.inventory[g.id],1);equipped.push(g.id)}
  for(const heading of [0,1,2,3,4,5,6,7]){await page.locator('[data-equipment-direction="'+heading+'"]').click();assert.equal((await get()).equipmentPreview.heading,heading)}
  await page.locator('#equipmentMotion').selectOption('pickaxe');await page.waitForTimeout(150);await page.screenshot({path:'qa/v35/'+theme+'-equipment.png'});
  await page.locator('#equipmentStoreAll').click();assert(Object.values((await get()).wardrobe.slots).every(r=>r===null));
  for(const id of equipped)assert.equal((await get()).inventory[id],2);
  await page.locator('[data-wear-slot="body"]').click();await page.locator('[data-wear="c4_1"]').click();await page.locator('[data-wear-slot="head"]').click();await page.locator('[data-wear="c4_3"]').click();await page.locator('[data-wear-slot="hands"]').click();await page.locator('[data-wear="c4_4"]').click();await page.locator('[data-tool="c16_9"]').click();await page.locator('#closeModal').click();
  // Render actual character code for every avatar / garment / heading; no palette substitution.
  const render=await page.evaluate(async()=>{
   const {AVATARS}=await import('/src/avatarCatalog.js'),{avatarFrame}=await import('/src/avatars.js'),{drawAnimatedCharacter}=await import('/src/characters.js'),{GARMENTS}=await import('/src/equipmentRules.js'),{garmentFrame,garmentArtReady}=await import('/src/garmentArt.js'),{artReady}=await import('/src/artStore.js');await Promise.all([garmentArtReady,artReady]);const theme=window.islandInspect().theme;
   const images=[...new Set(AVATARS.flatMap(a=>[0,4,6].map(h=>avatarFrame(a.id,theme,h).img)))];await Promise.all(images.map(im=>im.decode()));
   let poses=0;const c=document.createElement('canvas');c.width=160;c.height=160;const g=c.getContext('2d');
   for(const avatar of AVATARS)for(const item of Object.keys(GARMENTS))for(let h=0;h<8;h++){
    const clothing=garmentFrame(item,theme,h);if(!clothing)throw Error('missing garment '+item+h);if(clothing.flip!==[1,2,3].includes(h))throw Error('wrong garment mirror');
    g.clearRect(0,0,160,160);drawAnimatedCharacter(g,{x:80,y:135,appearance:avatar.id,garments:[item],direction:Math.PI/2+h*Math.PI/4,walkMix:1,phase:1.4},theme,'#a08a64',false,2,1.1);poses++;
   }
   const sheet=document.createElement('canvas');sheet.width=1020;sheet.height=2020;const ctx=sheet.getContext('2d');ctx.fillStyle=theme==='pixel'?'#f3efd9':'#f6eee4';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.font='16px sans-serif';ctx.fillStyle='#5d634b';
   let row=0;for(const [id,item] of Object.entries(GARMENTS)){ctx.fillText(item.name,12,24+row*165);for(let col=0;col<6;col++){const h=[0,6,4][col%3],avatar=col<3?'male_0':'female_5';drawAnimatedCharacter(ctx,{x:85+col*170,y:155+row*165,appearance:avatar,garments:[id],direction:Math.PI/2+h*Math.PI/4,walkMix:0,phase:0},theme,'#a08a64',false,2,1.28);}row++}
   const all=document.createElement('canvas');all.width=1020;all.height=2050;const ac=all.getContext('2d');ac.fillStyle=theme==='pixel'?'#f3efd9':'#f6eee4';ac.fillRect(0,0,all.width,all.height);ac.font='16px sans-serif';ac.fillStyle='#5d634b';
   for(let row=0;row<AVATARS.length;row++){const avatar=AVATARS[row];ac.fillText(avatar.name,12,24+row*170);for(let col=0;col<6;col++){const h=[0,6,4][col%3];drawAnimatedCharacter(ac,{x:85+col*170,y:160+row*170,appearance:avatar.id,garments:['c4_1','c4_7','c4_2','c4_5','c4_3','c4_4'],direction:Math.PI/2+h*Math.PI/4,walkMix:col<3?0:1,phase:1.4},theme,'#a08a64',false,2,1.28);}}
   const {hatlessHeadFrame}=await import('/src/garmentArt.js');for(const avatar of ['male_3','female_2','male_5'])for(let h=0;h<8;h++)if(!hatlessHeadFrame(avatar,theme,h))throw Error('missing bare head '+avatar+h);
   const {TOOLS}=await import('/src/equipmentRules.js'),{itemFrame}=await import('/src/artStore.js');
   const toolImages=[...new Set(Object.keys(TOOLS).map(id=>itemFrame(id,theme).img))];await Promise.all(toolImages.map(im=>im.decode()));
   let toolPoses=0;for(const avatar of AVATARS)for(const spec of Object.values(TOOLS))for(let h=0;h<8;h++)for(const t of [.1,.5,.9]){
    g.clearRect(0,0,160,160);drawAnimatedCharacter(g,{x:80,y:135,appearance:avatar.id,garments:['c4_1','c4_3','c4_4'],direction:Math.PI/2+h*Math.PI/4,walkMix:0,phase:0,action:{type:spec.action,t,duration:1,equipment:{tool:{id:spec.id}}}},theme,'#a08a64',false,2,1.1);toolPoses++;
   }
   const tools=document.createElement('canvas');tools.width=1520;tools.height=1470;const tc=tools.getContext('2d');tc.fillStyle=theme==='pixel'?'#f3efd9':'#f6eee4';tc.fillRect(0,0,tools.width,tools.height);tc.font='16px sans-serif';tc.fillStyle='#5d634b';
   let toolRow=0;for(const spec of Object.values(TOOLS)){tc.fillText(spec.name,12,24+toolRow*210);for(let h=0;h<8;h++)drawAnimatedCharacter(tc,{x:95+h*190,y:195+toolRow*210,appearance:'female_4',garments:['c4_1','c4_3','c4_4'],direction:Math.PI/2+h*Math.PI/4,walkMix:0,phase:0,action:{type:spec.action,t:.5,duration:1,equipment:{tool:{id:spec.id}}}},theme,'#a08a64',false,2,1.5);toolRow++;}
   return {poses,toolPoses,sheet:sheet.toDataURL('image/png'),avatars:all.toDataURL('image/png'),tools:tools.toDataURL('image/png')};
  });await writeFile('qa/v35/'+theme+'-garment-contact.png',Buffer.from(render.sheet.split(',')[1],'base64'));await writeFile('qa/v35/'+theme+'-avatar-equipment-contact.png',Buffer.from(render.avatars.split(',')[1],'base64'));await writeFile('qa/v35/'+theme+'-tool-contact.png',Buffer.from(render.tools.split(',')[1],'base64'));assert.equal(render.poses,1152);assert.equal(render.toolPoses,2016);
  await equipment();await page.setViewportSize({width:390,height:820});assert.equal(await page.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:'qa/v35/'+theme+'-compact.png'});await page.setViewportSize({width:1440,height:1000});await page.locator('#closeModal').click();
  if(visualOnly){report.checks.push({theme,actualGarments:equipped.length,renderedPoses:render.poses,toolPoses:render.toolPoses,eightHeadings:true,compactOverflow:false});await context.close();continue;}
  const point=async(x,y)=>{const v=await get(),box=await page.locator('#game').boundingBox(),extent=v.scene==='world'?v.worldExtent:{width:1000,height:660},t=rasterTransform(v.camera.width,v.camera.height,extent.width,extent.height,v.zoom,v.camera,...v.rendering.density);return {x:box.x+t.ox+x*t.scale,y:box.y+t.oy+y*t.scale}};
  await page.locator('[data-go="mine"]').click();await page.waitForFunction(()=>{const v=window.islandInspect(),c=document.querySelector('#game').getBoundingClientRect();return v.scene==='mine'&&Math.abs(v.rendering.css[0]-c.width)<1&&Math.abs(v.rendering.css[1]-c.height)<1});const p=await point(320,170);await page.mouse.click(p.x,p.y);await page.waitForSelector('#mineStrike',{timeout:20000});assert((await get()).resourceLedger.reservations);await page.locator('#closeModal').click();assert.equal(Object.keys((await get()).resourceLedger.reservations).filter(k=>k.startsWith('player-tool:')).length,0);
  await page.mouse.click(p.x,p.y);await page.waitForSelector('#mineStrike',{timeout:20000});await page.locator('#mineStrike').click();await page.waitForFunction(()=>window.islandInspect().actor.action==='pickaxe');
  const action=(await get()).actor;assert.equal(action.equipment.tool.id,'pickaxe');assert.equal(action.equipment.tool.source,'owned');assert.equal(action.duration,1.125);await page.waitForFunction(()=>!window.islandInspect().actor.action);
  // Enter the actual current premium angling game with a reserved advanced rod.
  await page.locator('#gatherBtn').click();await page.locator('[data-source="fishing"]').click();await page.locator('[data-gather="fish"]').click();await page.waitForSelector('.workshop-game',{timeout:30000});await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded);
  const fishState=(await get()).roomGame;assert.equal(fishState.equipment.id,'c16_9');assert.equal(fishState.equipment.source,'owned');await page.locator('[data-action="start"]').click();
  let game=(await get()).roomGame;const canvas=page.locator('.wk-canvas'),box=await canvas.boundingBox(),spot=game.level.spots[0];await page.mouse.click(box.x+(spot.x-game.level.wind+100)/960*box.width,box.y+spot.y/540*box.height);
  await page.waitForFunction(()=>window.islandInspect().roomGame?.mode==='waiting',{},{timeout:5000});assert((await get()).roomGame.castGood);
  await page.screenshot({path:'qa/v35/'+theme+'-advanced-fishing.png'});
  const fishBefore=(await get()).journey.stats.gathered.fish||0; // Shared bag also receives independent NPC catches.
  let caught=false;
  const gamePoint=(x,y)=>({x:box.x+x/960*box.width,y:box.y+y/540*box.height});
  for(let tick=0;tick<700;tick++){
   const g=await page.evaluate(()=>{const s=window.islandInspect().roomGame;return s?{phase:s.phase,mode:s.mode,fish:s.fish,surge:s.surge,tension:s.tension,holding:s.holding,result:s.result}:null});
   if(g?.result){assert(g.result.passed);caught=true;break}
   if(g.mode==='bite'){const q=gamePoint(g.fish.x,g.fish.y);await page.mouse.click(q.x,q.y)}
   else if(g.mode==='fight'){const q=gamePoint(g.fish.x,g.fish.y);await page.mouse.move(q.x,q.y);const hold=g.tension<(g.surge?.30:.58);if(hold&&!g.holding)await page.mouse.down();else if(!hold&&g.holding)await page.mouse.up();}
   await page.waitForTimeout(100);
  }
  await page.mouse.up();assert(caught,'actual angling catch completes');await page.waitForSelector('[data-action="claim"]',{timeout:5000});await page.locator('[data-action="claim"]').click();
  await page.waitForFunction(()=>window.islandInspect().actor.action==='fish');const fishingAction=(await get()).actor;assert.equal(fishingAction.equipment.tool.id,'c16_9');assert(Math.abs(fishingAction.duration-1.87)<1e-8);assert(Object.keys((await get()).resourceLedger.reservations).some(k=>k.startsWith('player-tool:')));
  await page.waitForFunction(()=>!window.islandInspect().actor.action);assert.equal((await get()).journey.stats.gathered.fish,fishBefore+1);
  await page.locator('#gatherBtn').click();await page.locator('[data-source="fishing"]').click();await page.locator('[data-gather="fish"]').click();await page.waitForSelector('.workshop-game',{timeout:30000});await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded);await page.locator('#closeModal').click();assert.equal(Object.keys((await get()).resourceLedger.reservations).filter(k=>k.startsWith('player-tool:')).length,0);
  let persisted=false;for(let n=0;n<80;n++){const d=await saves.current(theme);if(d.state.wardrobe.version===2&&d.state.wardrobe.slots.head?.item==='c4_3'&&d.state.toolbelt.fish==='c16_9'){persisted=true;break}await page.waitForTimeout(100)}assert(persisted);
  await page.reload();await page.waitForFunction(()=>window.islandInspect?.().wardrobe.slots.head?.item==='c4_3');assert.equal((await get()).toolLoadout.fish.id,'c16_9');assert.equal((await get()).wardrobe.slots.body.item,'c4_1');assert.equal(Object.keys((await get()).resourceLedger.reservations).filter(k=>k.startsWith('player-tool:')).length,0);
  report.checks.push({theme,actualGarments:equipped.length,renderedPoses:render.poses,toolPoses:render.toolPoses,sixSlotConservation:true,eightHeadings:true,compactOverflow:false,miningActionTool:action.equipment.tool.id,miningActionSeconds:action.duration,actualAdvancedCast:true,actualCatchClaim:true,toolTransferToAction:true,fishGain:1,cancelReleases:true,diskReload:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badImages,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;await page?.screenshot({path:'qa/v35/browser-failure.png'}).catch(()=>{});report.snapshot=await page?.evaluate(()=>window.islandInspect?.()).catch(()=>null);}
finally{await engine?.close();server.kill();await writeFile('qa/v35/'+(visualOnly?'visual-review-report':'browser-report')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,checks:report.checks,errors:report.errors,badImages:report.badImages,passed:report.passed,failure:report.failure}));}
