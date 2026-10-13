import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.env.HD_QA_OUT||'qa/v176/outdoor-checkpoint');await mkdir(out,{recursive:true});
const source=await readFile(path.join(root,'src/app.js'),'utf8');
for(const name of ['Field','Fishing','Festival','Couture','Fireworks','Party'])assert.match(source,new RegExp('server'+name+'=createServerCraft\\(\\{[^\\n]+continuousCheckpoint:true'),'continuous '+name);
const service=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><style>.hidden{display:none!important}body{margin:12px}svg{width:32px;height:32px}canvas{width:600px;height:340px;display:block}button{min-height:30px}.couture-reports,.fireworks-reports{display:none}</style><main id="game"></main>');}const file=path.resolve(root,pathname.startsWith('/assets/')?'public'+decodeURIComponent(pathname):'.'+decodeURIComponent(pathname));if(!/^\/(src|assets)\//.test(pathname)||!file.startsWith(root+path.sep))return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>service.listen(0,'127.0.0.1',r));let browser;
const report={scope:'Native browser buttons/pointers on actual outdoor view modules and actual checkpoint controller, both themes. Rule-created fixtures and mocked save transport with deterministic replay, a held acknowledgment and injected lost response. Tests input continuity and hard-pause safety only; does not establish real attendance, production rewards, full event completion or visual acceptance.',cases:[]};
try{
 browser=await chromium.launch(browserLaunchOptions());const page=await browser.newPage({viewport:{width:1500,height:1600}});
 for(const theme of ['pixel','origami'])for(const mode of ['mine','fishing','festival','couture','fireworks','legacy-party','sky-party','fishing-results','fishing-release']){
  await page.goto('http://127.0.0.1:'+service.address().port);const errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
  await page.evaluate(async({mode,theme})=>{
   const {createServerCraft}=await import('/src/serverCraftUI.js');const {artReady}=await import('/src/artStore.js');await artReady;
   const root=document.getElementById('game'),profile=id=>({name:'Fixture '+id,color:'#77aabb'}),options={theme,profile,portrait:()=>'',ready:()=>true,arrived:()=>true,model:()=>null,layout:{buyers:Array.from({length:4},()=>({x:0,y:0}))}};
   let kind,base,mount,replay;
   if(mode==='mine'){kind='field';const rules=await import('/src/miningGame.js'),view=await import('/src/miningGameUI.js');base=rules.createMiningGame(.12);replay=(g,e)=>rules.replayMining(g,[e]);mount=(t,c)=>view.mountMiningGame(root,{...t,item:'stone',name:'Fixture',expectedHp:2},{...c,claim:()=>false},theme);}
   if(mode==='fishing'||mode==='fishing-results'||mode==='fishing-release'){kind='fishing';const rules=await import('/src/fishingRules.js'),adapter=await import('/src/fishingReplay.js'),view=await import('/src/fishingPartyView.js');const match=rules.createFishingMatch(176,'easy');if(mode==='fishing-results')for(let i=0;i<6;i++){rules.startFishingRound(match);for(let step=0;step<550;step++)rules.tickFishing(match,.05);}if(mode==='fishing-release'){rules.startFishingRound(match);const l=match.rounds[0];rules.fishingAction(match,{type:'down',x:l.spot.x-l.wind,y:l.spot.y});for(let i=0;i<200&&match.current.mode!=='bite';i++)rules.tickFishing(match,.05);if(match.current.mode!=='bite')throw Error('Fixture failed to reach legal bite');rules.fishingAction(match,{type:'down'});}base=adapter.createFishingReplay(match);replay=adapter.applyFishingEvent;mount=(t,c)=>view.mountFishingMatch(root,{session:{match:t.game.match},theme,profile,avatar:'female_1',controls:c,onClaim:c.claim,onAbandon:c.exit});}
   if(mode==='festival'){kind='festival';const rules=await import('/src/marketRules.js'),view=await import('/src/marketView.js');base=rules.createMarketGame(176,'easy');replay=rules.applyMarketEvent;mount=(t,c)=>view.mountMarket(root,t,c,options);}
   if(mode==='couture'){kind='couture';const rules=await import('/src/coutureRules.js'),view=await import('/src/coutureView.js');base=rules.createCoutureGame(176,'easy');replay=rules.applyCoutureEvent;mount=(t,c)=>view.mountCouture(root,t,c,options);}
   if(mode==='fireworks'){kind='fireworks';const rules=await import('/src/fireworksRules.js'),view=await import('/src/fireworksView.js');base=rules.createFireworksGame(176,'easy');replay=rules.applyFireworksEvent;mount=(t,c)=>view.mountFireworks(root,t,c,options);}
   if(mode==='legacy-party'){kind='party';const rules=await import('/src/nightPartyReplay.js'),view=await import('/src/nightPartyView.js');base=rules.createNightPartyGame(176,'easy');replay=rules.applyNightPartyEvent;mount=(t,c)=>view.mountNightParty(root,t,c,options);}
   if(mode==='sky-party'){kind='party';const rules=await import('/src/nightSkyGame.js'),view=await import('/src/nightPartyView.js');base=rules.createNightSkyGame(176,'easy');replay=rules.applyNightSkyEvent;mount=(t,c)=>view.mountNightParty(root,t,c,options);}
   let ticket,pending=null,flight=null,hold=false,release,lose=false,view,controls,attempts=0;const accepted=[],seen=new Set();
   const action=async(t,input)=>{if(input.operation==='begin'){ticket={kind,requestId:input.requestId,epoch:'fixture',sequence:1,nextBatch:1,game:structuredClone(base)};return {ticket:structuredClone(ticket),state:{}};}const actual=structuredClone(pending?.body||input);pending??={body:actual};if(actual.operation==='finish'&&mode==='fishing-results'){if(ticket.game.match.phase!=='results')throw Error('Unfinished fixture');pending=null;return {ticket:structuredClone(ticket),state:{},receipt:{ticket:structuredClone(ticket),outcome:'finished'}};}if(actual.operation!=='checkpoint')throw Error('Unexpected settlement');attempts++;if(!seen.has(actual.batch)){for(const e of actual.events){replay(ticket.game,e);accepted.push(e);}seen.add(actual.batch);ticket.nextBatch++;}const response={ticket:structuredClone(ticket),state:{}};if(mode==='fishing-results')await new Promise(r=>setTimeout(r,80));if(hold){hold=false;await new Promise(r=>release=r);}if(lose){lose=false;throw Error('Injected lost checkpoint reply');}pending=null;return response;};
   const saves={status:()=>({status:pending?'action_pending':'saved',actions:{active:ticket}}),pendingAction:()=>pending,action:(t,input)=>{const run=action(t,input);flight=run;run.then(()=>{if(flight===run)flight=null},()=>{if(flight===run)flight=null});return run},idle:async()=>{if(flight)await flight;if(pending)throw Error('Unconfirmed response')}};
   const controller=createServerCraft({kind,idPrefix:'probe',saves,theme:()=>theme,persist:()=>{},applyState:()=>{},toast:()=>{},closeGame:()=>{},animate:async()=>{},onComplete:()=>{},continuousCheckpoint:true,mount:(t,c)=>{controls=c;view=mount(t,c);return view;}});await controller.begin('fixture');
   const inspect=()=>view.inspect(),clock=()=>{const s=inspect();return s.time??s.match?.elapsed??s.game?.elapsed??0;};
   window.probe={controller,inspect,clock,accepted,controls,get attempts(){return attempts},get state(){return ticket.game},hold(){hold=true;this.waiting=controls.saveOutcome();},release(){release();},lose(){lose=true;},async settle(){await this.waiting;},snapshot(){return {clock:clock(),view:inspect(),controller:controller.inspect(),attempts,accepted:structuredClone(accepted)}}};
  },{mode,theme});
  if(mode==='fishing-release'){await page.locator('[data-fish="resume"]').click();await page.locator('#fishingControl').focus();await page.keyboard.down('Space');assert(await page.evaluate(()=>probe.inspect().match.current.holding));await page.evaluate(()=>{probe.lose();probe.waiting=probe.controls.saveOutcome()});await page.evaluate(()=>probe.settle());const stopped=await page.evaluate(()=>probe.snapshot());assert(stopped.controller.recoveryRequired);assert.equal(stopped.view.match.current.holding,false);await page.keyboard.up('Space');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>probe.clock()),stopped.clock);await page.locator('#probeRetry').click();await page.waitForFunction(()=>!probe.controller.inspect().recoveryRequired);assert.equal(await page.evaluate(()=>probe.inspect().match.current.holding),false);await page.evaluate(()=>probe.controls.saveOutcome());assert.equal(await page.evaluate(()=>probe.state.match.current.holding),false);assert.deepEqual(errors,[]);await page.evaluate(()=>probe.controller.destroy());page.off('pageerror',onError);report.cases.push({theme,mode,legalFightFixture:true,nativeHeldSpace:true,hardPauseNeutralized:true,resumeAndReplayNotHolding:true,passed:true});continue;}
  if(mode==='fishing-results'){await page.waitForTimeout(250);const before=await page.evaluate(()=>probe.snapshot());assert.equal(before.view.match.phase,'results');assert.equal(before.controller.bufferedEvents,1,'completed fishing must not generate endless dt events');await page.locator('[data-fish="claim"]').click();await page.waitForFunction(()=>!probe.controller.inspect().active,null,{timeout:3000});const after=await page.evaluate(()=>probe.snapshot());assert.equal(after.accepted.filter(e=>e.dt).length,0);assert.deepEqual(errors,[]);await page.evaluate(()=>probe.controller.destroy());page.off('pageerror',onError);report.cases.push({theme,mode,generatedCompletedRuleFixture:true,claimDrained:true,passed:true});continue;}
  if(mode==='fishing')await page.locator('[data-fish="next"]').click();
  if(mode==='festival')await page.locator('#marketStart').click();
  if(mode==='couture')await page.locator('#coutureStart').click();
  if(mode==='fireworks')await page.locator('#fireworksStart').click();
  await page.waitForFunction(()=>!probe.controller.inspect().settling);await page.waitForTimeout(100);
  await page.evaluate(()=>probe.hold());await page.waitForFunction(()=>probe.controller.inspect().settling);const before=await page.evaluate(()=>probe.snapshot());
  await page.waitForTimeout(450);const during=await page.evaluate(()=>probe.snapshot());assert(during.clock>before.clock+.15,mode+' clock must continue during delayed save');
  if(mode==='mine')await page.locator('#mineStrike').click();
  if(mode==='fishing'){const r=await page.locator('canvas').boundingBox();await page.mouse.move(r.x+r.width*.62,r.y+r.height*.55);}
  if(mode==='festival')await page.locator('[data-market-item="bread"]').click();
  if(mode==='couture')await page.locator('[data-couture-wear="c4_1"]').click();
  if(mode==='fireworks')await page.locator('[data-fireworks-config="0|color:jade"]').click();
  if(mode==='legacy-party')await page.locator('#launchLantern').click();
  if(mode==='sky-party'){await page.locator('#nightSkyAngle').focus();await page.keyboard.press('ArrowRight');}
  const afterInput=await page.evaluate(()=>probe.snapshot());assert(afterInput.controller.bufferedEvents>before.controller.bufferedEvents,'native input remains buffered behind original batch');
  await page.evaluate(async()=>{probe.release();await probe.settle();await probe.controls.saveOutcome()});
  const after=await page.evaluate(()=>probe.snapshot()),actions=after.accepted.filter(e=>e.action).map(e=>e.action);
  if(mode==='mine')assert(actions.some(a=>a.type==='strike'));
  if(mode==='fishing')assert(actions.some(a=>a.type==='point'));
  if(mode==='festival')assert(actions.some(a=>a.type==='add'&&a.item==='bread'));
  if(mode==='couture')assert(actions.some(a=>a.type==='wear'&&a.item==='c4_1'));
  if(mode==='fireworks')assert(actions.some(a=>a.type==='configure'&&a.item==='color:jade'));
  if(mode==='legacy-party')assert(actions.some(a=>a.type==='tap'));
  if(mode==='sky-party')assert(actions.some(a=>a.type==='aim'));
  let hardPause=null;
  if(mode==='fireworks'||mode==='fishing'){
   await page.waitForTimeout(100);
   await page.evaluate(()=>{probe.lose();probe.waiting=probe.controls.saveOutcome()});await page.evaluate(()=>probe.settle());
   const stopped=await page.evaluate(()=>probe.snapshot());assert(stopped.controller.recoveryRequired);await page.waitForTimeout(200);
   if(mode==='fireworks'){assert(await page.locator('[data-fireworks-config="0|color:gold"]').isDisabled());await page.keyboard.press('ArrowRight');}
   else {const r=await page.locator('canvas').boundingBox();await page.mouse.move(r.x+r.width*.5,r.y+r.height*.5);await page.mouse.down();await page.mouse.up();}
   const locked=await page.evaluate(()=>probe.snapshot());assert.equal(locked.clock,stopped.clock);if(mode==='fireworks')assert.deepEqual(locked.view.game.configs,stopped.view.game.configs);if(mode==='fishing')assert.equal(locked.view.match.current.holding,false);
   await page.locator('#probeRetry').click();await page.waitForFunction(()=>!probe.controller.inspect().recoveryRequired);await page.evaluate(()=>probe.controls.saveOutcome());hardPause={passed:true};
  }
  assert.deepEqual(errors,[]);await page.evaluate(()=>probe.controller.destroy());page.off('pageerror',onError);report.cases.push({theme,mode,clockAdvance:during.clock-before.clock,nativeActionAccepted:true,hardPause,passed:true});console.log(theme+' '+mode+' passed');
 }
 report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>service.close(r));await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
