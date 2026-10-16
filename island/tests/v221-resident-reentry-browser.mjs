import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {DEFAULT_CLOCK} from '../src/environmentClock.js';
import {residentSchedule} from '../src/residentSchedule.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,career,needs,relationship} from '../src/townSimulation.js';
import {residentLifeClock} from '../src/residentLife.js';
import {setResidentCooldown} from '../src/residentCooldowns.js';

const out=resolve(process.env.HD_QA_OUT||'qa/v221/native-resident-reentry');await mkdir(out,{recursive:true});
const report={scope:'Fictional LAN saves start with explicitly configured prior-day history, needs and a pending disagreement. Normal rate1/900-second clocks and native movement/conversation are used after entry. Providers are disabled; actual local fallback dialogue is not called AI-generated. Expired legacy pauses must release; a new completed conversation must create a durable pause; active pauses survive reload. No user data, human, offline-time or full long-term story acceptance.',cases:[],passed:false};
const browser=await chromium.launch(browserLaunchOptions()),services=new Set();
try{
 for(const theme of ['pixel','origami'])for(const mode of ['expired-legacy','active-stamp']){
  const row={theme,mode,errors:[],interactions:0};report.cases.push(row);
  const directory=await mkdtemp(join(out,theme+'-'+mode+'-')),event=residentSchedule(0,{hour:19,cycles:0}),hour=event.eventStart+.1,clock={...DEFAULT_CLOCK,clockId:'reentry-'+theme+'-'+mode,epochMs:Date.now(),phaseAtEpoch:hour/24};
  await mkdir(join(directory,'environment'),{recursive:true});await writeFile(join(directory,'environment/environment-clock.json'),JSON.stringify(clock));
  const service=await createLanHttpServer({directory,port:0,enrollmentKey:'RESIDENT-REENTRY-ONLY'}),base='http://127.0.0.1:'+service.port;
  services.add(service);
  const account=await service.identities.register({login:'rr_'+theme+'_'+(mode==='expired-legacy'?'old':'active'),password:'fictional-reentry-password',name:'居民节奏验证岛主',islandName:'居民节奏验证岛',avatar:'female_1',theme}),store=(await service.tenants.get(account.token)).saves,seed=hydrateTown(createZeroState());
  seed.freshStartPending=false;seed.day=5;seed.economy.daySeconds=40;
  for(let i=0;i<16;i++)Object.assign(needs(i,seed),{energy:90,hunger:90,social:70});needs(0,seed).social=10;
  relationship(seed,0,8).tension=20;relationship(seed,8,0).tension=20;
  const c=career(0,seed);c.personalAfter=3565;
  if(mode==='expired-legacy'){c.socialAfter=3300;c.history.push({day:3,daySeconds:800,time:3000,action:'social',buildingId:7,result:'上次交谈已结束'});}
  else setResidentCooldown(seed,c,'social',300,5000);
  c.history.push({day:4,daySeconds:800,time:3500,action:'visit',buildingId:7,purposeId:'life:seed-notes',result:'上次休闲已结束'});
  await store.open(theme,{legacyState:seed,protect:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  if(process.env.HD_QA_BASELINE_CLIENT_DIR)for(const name of ['townSimulation.js','residentRuntime.js'])await context.route('**/src/'+name,async r=>r.fulfill({contentType:'text/javascript',body:await readFile(join(process.env.HD_QA_BASELINE_CLIENT_DIR,name),'utf8')}));
  await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;if(path==='/api/npc/interact')row.interactions++;return /^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick'?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in fictional resident reentry check"}'}):r.continue();});
  page.on('pageerror',e=>row.errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&window.islandInspect().environment.clockId?.startsWith('reentry-'),null,{timeout:60000});
  const snapshot=()=>page.evaluate(()=>{const s=islandInspect();return {now:s.now,economy:s.economy,npc:s.npcs[0],meetings:s.meetings,conversations:s.npcConversations};});
  try{
   await page.goto(base+'/play?qa=1');await ready();row.entry=await snapshot();
   if(mode==='expired-legacy'){
    await page.waitForFunction(()=>islandInspect().meetings.some(m=>m.ids.includes(0)&&m.ids.includes(8)),null,{timeout:Number(process.env.HD_QA_MEETING_WAIT_MS)||30000});row.meeting=await snapshot();
    await page.waitForFunction(()=>islandInspect().npcConversations.some(c=>c.participants?.includes(0)&&c.participants.includes(8)),null,{timeout:150000});const after=await snapshot(),conversation=after.conversations.find(c=>c.participants.includes(0)&&c.participants.includes(8));
    assert(after.npc.career.cooldowns?.social?.until>residentLifeClock({day:5,economy:after.economy}));assert(conversation.lines?.length>0);row.conversation={type:conversation.type,source:conversation.source,participants:conversation.participants,lines:conversation.lines.length};row.stamp=structuredClone(after.npc.career.cooldowns.social);
   }else{
    await page.waitForTimeout(4500);const after=await snapshot();assert.equal(after.meetings.some(m=>m.ids.includes(0)),false);assert.equal(after.conversations.some(c=>c.participants?.includes(0)),false);assert.deepEqual(after.npc.career.cooldowns.social,c.cooldowns.social);row.stamp=structuredClone(after.npc.career.cooldowns.social);
   }
   // Read the real save-management UI to await its ordinary autosave, rather
   // than injecting state or claiming a page-local value persisted by itself.
   await page.locator('#saveStatus').click();await page.locator('#saveNow').click();await page.waitForFunction(()=>!document.querySelector('#saveNow')?.disabled,null,{timeout:30000});await page.locator('#closeModal').click();
   const saved=await store.current(theme);assert.deepEqual(career(0,saved.state).cooldowns.social,row.stamp);
   await page.reload();await ready();await page.waitForTimeout(4500);row.reopened=await snapshot();assert.deepEqual(row.reopened.npc.career.cooldowns.social,row.stamp);assert.equal(row.reopened.meetings.some(m=>m.ids.includes(0)),false);
   const current=await store.current(theme);assert.deepEqual(career(0,current.state).cooldowns.social,row.stamp);assert.equal(current.state.saveSlot,saved.state.saveSlot);assert.deepEqual(row.errors,[]);row.passed=true;await page.screenshot({path:join(out,theme+'-'+mode+'-reopened.png')});
  }catch(error){row.failure=error.stack;row.last=await snapshot().catch(()=>null);process.exitCode=1;await page.screenshot({path:join(out,theme+'-'+mode+'-failure.png')}).catch(()=>{});}
  finally{await context.close();await service.close();services.delete(service);await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{await browser.close();for(const service of services)await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failure:report.failure,cases:report.cases.map(c=>({theme:c.theme,mode:c.mode,passed:c.passed,failure:c.failure}))}));}
