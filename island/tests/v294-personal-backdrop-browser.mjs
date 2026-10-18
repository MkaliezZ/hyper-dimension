import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),q=resolve(process.env.HD_QA_OUT||join(root,'qa/v294/personal-backdrop'));await mkdir(q,{recursive:true});
const {chromium}=createRequire(join(root,'package.json'))('playwright-core'),load=name=>import(pathToFileURL(join(root,name))),sha=b=>createHash('sha256').update(b).digest('hex');
const {browserLaunchOptions}=await load('tests/browserRuntime.mjs'),{createLanHttpServer}=await load('server/lanServer.mjs');
process.env.DEEPSEEK_API_KEY='';
const after=await readFile(join(root,'src/app.js'));
const service=await createLanHttpServer({directory:await mkdtemp(join(q,'owned-')),port:0,enrollmentKey:'OWNED-PERSONAL-BACKDROP'}),base='http://127.0.0.1:'+service.port;
const report={scope:'Owned fictional fresh LAN accounts and actual personal-avatar authority. Hold a real already-committed response while observing native RAF/main-canvas paints. Strict checks prove backdrop retention, resize and normal drawing recovery, not reproduction of a physical Mac timeout or overall game FPS. No model, user browser or document data; no clock/resource/outcome injection.',appSha256:sha(after),cases:[],passed:false,wholeGoalComplete:false};let browser;
const persist=()=>writeFile(join(q,'report.json'),JSON.stringify(report,null,2));
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const mode of ['after'])for(const theme of ['pixel','origami']){
  const row={mode,theme,errors:[]};report.cases.push(row);
  const a=await service.identities.register({login:'backdrop_'+mode+'_'+theme,password:'fictional-backdrop-password',name:'虚构衣橱岛主',islandName:'衣橱验证岛',avatar:'male_0',theme}),store=(await service.tenants.get(a.token)).saves;
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();let release;
  try{
   await context.addCookies([{name:'hd_lan_session',value:a.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   await context.addInitScript(()=>{window.personalPaints=0;const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='game')personalPaints++;return clear.apply(this,args);};});
   await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;return /^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick'?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in owned wardrobe check"}'}):r.continue();});
   let held;const committed=new Promise(r=>held=r),gate=new Promise(r=>release=r);
   await context.route('**/api/saves/**/action',async route=>{const input=route.request().postDataJSON();if(input.kind!=='personal'||input.operation!=='avatar')return route.continue();const response=await route.fetch();assert.equal(response.status(),200);row.requestId=input.requestId;row.actualCommittedResponse=true;held();await gate;await route.fulfill({response});});
   page.on('pageerror',e=>row.errors.push(e.message));await page.goto(base+'/play?qa=1');
   await page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!islandInspect().startup.busy,null,{timeout:60000});
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   const saveTheme=await page.evaluate(()=>islandInspect().saveTheme),slot=(await store.current(saveTheme)).state.saveSlot;
   await page.locator('#stewardBtn').click();await page.locator('#stewardAppearance').click();await page.locator('[data-gender="女"]').click();await page.locator('[data-avatar="female_4"]').click();await committed;
   assert.equal((await store.current(saveTheme)).state.butlerAvatar,'female_4');
   const paints=()=>page.evaluate(async()=>{for(let i=0;i<2;i++)await new Promise(requestAnimationFrame);const start=personalPaints,at=performance.now();for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);return{painted:personalPaints-start,milliseconds:performance.now()-at,personal:islandInspect().serverPersonal,hidden:document.hidden};});
   row.waiting=await paints();assert.equal(row.waiting.personal.inflight,1);
   const paintsBeforeResize=await page.evaluate(()=>personalPaints);await page.setViewportSize({width:1400,height:960});row.resized=await paints();row.resized.totalSinceResize=(await page.evaluate(()=>personalPaints))-paintsBeforeResize;
   release();await page.waitForSelector('[data-avatar="female_4"].selected',{timeout:30000});
   assert.equal((await store.current(saveTheme)).state.butlerAvatar,'female_4');assert.equal((await store.current(saveTheme)).state.saveSlot,slot);
   await page.locator('#closeModal').click();row.resumed=await paints();assert(row.resumed.painted>=6);
   row.sameSaveSlot=true;row.realChoiceConfirmed=true;row.backdropHeld=row.waiting.painted<=1;row.passed=row.backdropHeld;assert.deepEqual(row.errors,[]);
  }catch(error){row.failure=error.stack;await page.screenshot({path:join(q,mode+'-'+theme+'-failure.png'),timeout:5000}).catch(()=>{});}
  finally{release?.();await context.close();await persist();}
 }
 assert(report.cases.filter(c=>c.mode==='after').every(c=>c.passed&&c.realChoiceConfirmed&&c.resumed.painted>=6&&c.resized.totalSinceResize>=1&&c.resized.totalSinceResize<=2));report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{await browser?.close();await service.close();assert.equal(sha(await readFile(join(root,'src/app.js'))),report.appSha256);report.sourceUnchangedAfter=true;report.finishedAt=new Date().toISOString();await persist();console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({mode,theme,waiting,resumed,passed,failure})=>({mode,theme,waiting,resumed,passed,failure})),failure:report.failure,wholeGoalComplete:false}));}
