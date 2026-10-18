import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(process.env.HD_QA_ROOT||'.'),out=resolve(process.env.HD_QA_OUT||'qa/v291/lobby-frame-loss');await mkdir(out,{recursive:true});process.env.DEEPSEEK_API_KEY='';
const load=name=>import(pathToFileURL(join(root,name)));
const {chromium}=createRequire(join(root,'package.json'))('playwright-core'),{browserLaunchOptions}=await load('tests/browserRuntime.mjs');
const {createLanHttpServer}=await load('server/lanServer.mjs'),{worldWalkableForTheme}=await load('src/world.js');
const directory=await mkdtemp(join(out,'owned-server-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'OWNED-FRAME-LOSS'}),base='http://127.0.0.1:'+service.port;
const report={startedAt:new Date().toISOString(),sourceLanMapSha256:createHash('sha256').update(await readFile(join(root,'src/lanMap.js'))).digest('hex'),sourceLanMotionSha256:createHash('sha256').update(await readFile(join(root,'src/lanMotion.js'))).digest('hex'),scope:'Actual isolated LAN room and real native pointer movement. After the actual map loads and paints its owner, withhold real RAF callback delivery for four seconds while the document remains visible. No timestamps, positions, clock, resources, route or outcomes injected. Providers disabled; not full multiplayer, physical Mac or human acceptance.',cases:[],passed:false};let browser;
const sample=page=>page.evaluate(()=>{const s=lanInspect(),m=s.map.members.find(m=>m.id===s.view.me.id),p=s.view.room.members.find(m=>m.id===s.view.me.id);return{hidden:document.hidden,loaded:s.map.loaded,frameLoop:s.map.frameLoop||null,actor:m?{x:m.x,y:m.y,renderAt:m.renderAt}:null,canonical:{x:p.position.x,y:p.position.y},fault:{...window.ownedRafFault},actualActorIds:s.map.members.map(m=>m.id),expectedActorIds:[...(s.view.room.residents||[]).filter(r=>!r.position?.indoors).map(r=>r.actorId),...s.view.room.members.flatMap(m=>[m.id,...(m.companions||[]).map(c=>c.actorId)])]};});
try{
 browser=await chromium.launch(browserLaunchOptions());
 const probe=await browser.newBrowserCDPSession();try{const info=await probe.send('SystemInfo.getInfo');report.gpu={renderer:info.gpu.auxAttributes.glRenderer,canvas:info.gpu.featureStatus['2d_canvas']};assert(!/swiftshader|llvmpipe|software rasterizer/i.test(report.gpu.renderer));assert.match(report.gpu.canvas,/^enabled/);}finally{await probe.detach();}
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],passed:false};report.cases.push(row);
  const account=await service.identities.register({login:'frame_'+theme,password:'fictional-frame-password',name:'虚构帧恢复岛主',islandName:'帧恢复验证岛',avatar:'female_1',theme});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(()=>{const native=requestAnimationFrame.bind(window);window.ownedRafFault={enabled:false,dropped:0,delivered:0};window.requestAnimationFrame=callback=>native(at=>{if(ownedRafFault.enabled){ownedRafFault.dropped++;return;}ownedRafFault.delivered++;callback(at);});});
  const created=await context.request.post(base+'/api/lan/action',{data:{operation:'room_create',requestId:crypto.randomUUID(),title:'帧恢复同行',maxPlayers:4}});assert(created.ok());
  const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(base+'/?qa=1');await page.waitForFunction(()=>window.lanInspect?.().map?.loaded&&lanInspect().map.members.some(m=>m.id===lanInspect().view.me.id),null,{polling:100,timeout:60000});
   row.before=await sample(page);assert.equal(row.before.hidden,false);
   await page.evaluate(()=>{ownedRafFault.enabled=true;});
   const m=await page.evaluate(()=>lanInspect().map),box=await page.locator('#lanMapCanvas').boundingBox();
   const target=[{x:1644,y:1440},{x:768,y:564},{x:2124,y:804}].find(p=>worldWalkableForTheme(theme,p.x,p.y)&&Math.hypot(p.x-row.before.actor.x,p.y-row.before.actor.y)>120);assert(target);
   const x=box.x+m.cssW/2+(target.x-m.camera.x)*m.scale,y=box.y+m.cssH/2+(target.y-m.camera.y)*m.scale;assert(x>=box.x&&x<=box.x+box.width&&y>=box.y&&y<=box.y+box.height);
   const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lan/action'&&r.request().postDataJSON()?.operation==='room_move',{timeout:10000});await page.mouse.click(x,y);assert.equal((await response).status(),200);
   await page.waitForTimeout(4000);row.during=await sample(page);row.canonicalDisplacement=Math.hypot(row.during.canonical.x-row.before.canonical.x,row.during.canonical.y-row.before.canonical.y);row.visibleDisplacement=Math.hypot(row.during.actor.x-row.before.actor.x,row.during.actor.y-row.before.actor.y);
   assert.equal(row.during.hidden,false);assert(row.during.fault.dropped>0);assert(row.canonicalDisplacement>30,'The real server-authorized route must move during the declared delivery fault');
   assert(row.during.actor.renderAt>row.before.actor.renderAt+500&&row.visibleDisplacement>20,'The visible map must continue presenting actual motion while RAF callbacks stop');
   assert(row.during.frameLoop?.fallbackFrames>0,'Actual visible fallback frames must be delivered');
   await page.evaluate(()=>{ownedRafFault.enabled=false;});await page.waitForTimeout(1300);row.resumed=await sample(page);
   assert(row.resumed.frameLoop.rafFrames>row.during.frameLoop.rafFrames,'Native RAF delivery must resume without a manual focus/visibility event');assert.equal(row.resumed.frameLoop.errors,0);
   assert.deepEqual([...row.resumed.actualActorIds].sort(),[...row.resumed.expectedActorIds].sort());assert.deepEqual(row.errors,[]);await page.screenshot({path:join(out,theme+'-recovered.png')});row.passed=true;
  }catch(error){row.failure=error.stack;}
  finally{await page.evaluate(()=>{ownedRafFault.enabled=false;}).catch(()=>{});await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.length===2&&report.cases.every(c=>c.passed);if(!report.passed)process.exitCode=1;
}finally{await browser?.close();await service.close();report.finishedAt=new Date().toISOString();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,failure,canonicalDisplacement,visibleDisplacement})=>({theme,passed,failure,canonicalDisplacement,visibleDisplacement}))}));}
