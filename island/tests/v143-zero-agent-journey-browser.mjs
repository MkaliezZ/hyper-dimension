import {playNightUI} from './night-play-browser.mjs';
import {completeZeroBasics} from './zero-basics-browser.mjs';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
if(process.env.HD_QA_REAL_HERMES!=='1')throw Error('Explicitly set HD_QA_REAL_HERMES=1 for this real-provider journey; keep credentials private.');
assert(process.env.DEEPSEEK_API_KEY,'Configure a private provider key before the real-provider journey.');
const themes=(process.env.HD_QA_THEMES||'pixel,origami').split(',');assert(themes.every(t=>['pixel','origami'].includes(t)));
const out=resolve(process.env.HD_QA_OUT||'qa/v143/zero-agent-journey');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(out,'isolated-'));
for(const [key,sub]of Object.entries({HD_SAVE_DIR:'saves',HD_HERMES_HOME:'hermes',HD_STEWARD_WORKDIR:'documents',HD_RUN_LEDGER_DIR:'runs',HD_ARTIFACT_DIR:'artifacts',HD_ENVIRONMENT_DIR:'environment'}))process.env[key]=join(directory,sub);
const {createLanHttpServer}=await import('../server/lanServer.mjs');
const service=await createLanHttpServer({directory:join(directory,'server'),port:0,enrollmentKey:'ISOLATED-REAL-JOURNEY'});
const base='http://127.0.0.1:'+service.port;
const report={at:new Date().toISOString(),sourceVersion:'V143 candidate',scope:'Server-created zero-coin/zero-inventory first day. Native axe/mining/joinery, two earned orders and milestone seeds, normal three-minute crop growth and harvest, then real Hermes parent/child recruitment, normal ferry/roads/production, personal invitations, four aimed night flights, unique cooperation/wage/departure and reload. No state/time/stock/quality/contract/position/result injection. Automatic provider requests blocked; requested recruitment uses real deepseek-flash. Automated inputs are not human, physical-device or all-five-template acceptance.',directory,cases:[],passed:false};let browser;const activePages=new Map();
const save=()=>writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of themes){
  const row={theme,startedAt:Date.now(),errors:[],actions:[],modelResponses:[],samples:[],phases:[],badAssets:[]};report.cases.push(row);
  const account=await service.identities.register({login:'journey_'+theme,password:'fictional-isolated-fixture',name:'协作验证岛主',islandName:'同心星灯岛',avatar:'female_1',theme});
  const tenant=await service.tenants.get(account.token);
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'X-HD-Island':tenant.accountId}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/api/npc/')||path==='/api/hermes/plan'||path.endsWith('/suggest'))return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Automatic provider calls disabled for isolated journey"}'});return route.continue();});
  const page=await context.newPage();activePages.set(theme,page);
  page.on('pageerror',e=>row.errors.push(e.message));
  const responses=[];
  page.on('response',res=>{const url=res.url();if(res.status()>=400&&url.includes('/assets/'))row.badAssets.push({url,status:res.status()});if(url.endsWith('/action')&&res.request().method()==='POST'){const input=res.request().postDataJSON();responses.push(res.json().then(result=>{row.actions.push({at:Date.now(),kind:input.kind,operation:input.operation,requestId:input.requestId,status:res.status(),actorId:result.ticket?.actorId,intent:result.ticket?.intent,receipt:result.receipt,code:result.code});}).catch(()=>{}));}if(url.includes('/api/recruitment/')&&url.endsWith('/status'))responses.push(res.json().then(r=>{const run=r.active?.runs?.at(-1);if(run&&!row.modelResponses.some(x=>x.parent?.id===run.parent?.id))row.modelResponses.push(run);}).catch(()=>{}));});
  const inspect=()=>page.evaluate(()=>window.islandInspect?.());
  async function sample(label){const s=await inspect();const snap={label,at:Date.now(),now:s.now,day:s.day,coins:s.coins,inventory:s.inventory,actor:s.actor,recruitment:s.recruitment,projects:s.workProjects,tasks:s.agentTaskLedger,party:s.nightParty,attendance:s.nightAttendance,npcs:s.npcs.map(n=>({id:n.id,x:n.x,y:n.y,status:n.status,inside:n.inside,action:n.action,path:n.path,walking:n.walking})),serverResident:s.serverResident,serverParty:s.serverParty};row.samples.push(snap);return snap;}
  async function wait(label,predicate,seconds=90){const deadline=Date.now()+seconds*1000;let snapshot;while(Date.now()<deadline){snapshot=await sample(label);if(predicate(snapshot))return snapshot;if(row.errors.length)throw Error(row.errors.join('\n'));await save();await page.waitForTimeout(2000);}throw Error(label+' did not finish within '+seconds+' normal-clock seconds');}
  const ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!document.querySelector('#app')?.hasAttribute('aria-busy'),null,{timeout:45000});
  await page.goto(base+'/play?qa=1');await ready();
  row.zeroBasics=await completeZeroBasics(page,{record:async label=>{await sample(label);await save();console.log(theme+' zero phase '+label);}});
  await page.screenshot({path:join(out,theme+'-earned-start.png')});
  await page.locator('#partyBtn').click();await page.locator('#nightPartyOpen').click();await page.locator('#nightBasic').click();await page.locator('#nightPlan').click();
  await page.waitForFunction(()=>!!window.islandInspect().nightParty?.draft?.projectId);
  const first=await sample('plan-created');row.projectId=first.party.draft.projectId;row.draftId=first.party.draft.id;assert(first.tasks.some(t=>t.targetItem==='lantern'&&t.remaining>0));
  await page.locator('#closeModal').click();await page.locator('#stewardBtn').click();await page.locator('#stewardRecruit').click();await page.locator('#recruitPlan').selectOption(row.projectId);await page.locator('#recruitHire').click();
  const accepted=await wait('actual-parent-child-accepted',s=>!!s.recruitment.active,260);row.contractId=accepted.recruitment.active.id;row.acceptedSteps=accepted.recruitment.active.steps;row.phases.push({phase:accepted.recruitment.active.phase,at:Date.now()});
  const registry=await context.request.get(base+'/api/recruitment/'+theme+'/status');assert(registry.ok());const recruitment=await registry.json();const run=recruitment.active.runs.at(-1);assert.equal(run.source,'hermes');assert.equal(run.model,'deepseek-flash');assert.equal(run.child.parentId,run.parent.id);assert(run.parent.tools.includes('recruitment_delegate'));assert(run.child.tools.includes('recruitment_take_step'));assert(run.child.acceptedSteps.length);row.realRun=run;
  await page.screenshot({path:join(out,theme+'-real-negotiation.png')});await page.locator('#closeModal').click();
  const phaseSet=new Set();let moved=false,arrived=false,readyState;const end=Date.now()+660000;
  while(Date.now()<end){const snap=await sample('production');const a=snap.recruitment.active;if(a&&!phaseSet.has(a.phase)){phaseSet.add(a.phase);row.phases.push({phase:a.phase,at:Date.now(),now:snap.now});console.log(theme+' phase '+a.phase+' time '+Math.round(snap.now));}if(a?.hasArrived)arrived=true;const child=snap.npcs.find(n=>n.id===16);if(child?.walking||child?.path>0)moved=true;const plan=snap.projects.find(p=>p.id===row.projectId);if(plan?.status==='ready'){readyState=snap;break;}if(row.errors.length)throw Error(row.errors.join('\n'));await save();await page.waitForTimeout(2000);}
  assert(readyState,'real-time production must complete the actual supply project');assert(arrived&&moved,'child must visibly arrive and follow actual roads');assert(readyState.inventory.lantern>=2);row.actualSupplySeconds=(Date.now()-accepted.at)/1000;
  await page.screenshot({path:join(out,theme+'-ready.png')});
  await page.locator('#partyBtn').click();await page.locator('#nightPartyOpen').click();
  for(const id of [0,2]){await page.locator('[data-night-invite="'+id+'"]').click();await page.locator('#nightInviteConfirm').click();await page.waitForFunction(n=>window.islandInspect().nightParty.draft.invites[n]?.version===window.islandInspect().nightParty.draft.version,id);}
  await page.locator('#nightStart').click();await page.locator('#launchLantern').waitFor();
  await wait('all-residents-arrived',s=>Object.values(s.attendance?.people||{}).length>0&&Object.values(s.attendance.people).every(p=>p.arrived),150);
  await playNightUI(page);
  await page.locator('#nightClaim').click();const finished=await wait('party-result-saved',s=>s.party.history.some(h=>h.id===row.draftId&&h.phase==='finished'),60);row.partyResult=finished.party.history.find(h=>h.id===row.draftId);row.eventId=row.partyResult.eventId;assert(row.partyResult.paid>=20);
  const disk=await tenant.saves.current(theme);const provenance=disk.state.eventWonders.sources[row.eventId];assert(provenance?.proof?.some(p=>p.parentRunId===run.parent.id&&p.childRunId===run.child.id));row.cooperationProof=provenance.proof;row.achievement=disk.state.achievementBook.cooperated[row.eventId];assert(row.achievement);
  await page.screenshot({path:join(out,theme+'-finished.png')});await page.locator('#closeModal').click();
  await wait('actual-departure-archived',s=>!s.recruitment.active,180);
  const finalRegistry=await(await context.request.get(base+'/api/recruitment/'+theme+'/status')).json();const archived=finalRegistry.history.find(c=>c.id===row.contractId);assert.equal(archived.phase,'departed');assert(archived.delivery.delivered>0);assert(archived.delivery.fee>0&&archived.delivery.fee<=8);row.archived={phase:archived.phase,delivery:archived.delivery};
  await page.reload();await ready();const after=await sample('refresh');assert(after.party.history.some(h=>h.eventId===row.eventId&&h.phase==='finished'));assert(!after.recruitment.active);
  await Promise.all(responses);const childReceipts=row.actions.filter(a=>a.receipt?.ticket?.actorId===16&&a.receipt.outcome==='finished');assert(childReceipts.length,'actual server-owned child production receipts');row.childReceipts=childReceipts;assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;row.elapsedSeconds=(Date.now()-row.startedAt)/1000;activePages.delete(theme);await context.close();await save();console.log(theme+' actual recruitment/party journey passed');
 }
 report.passed=true;
}catch(error){report.failure=error.stack;for(const [theme,page]of activePages){await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}process.exitCode=1;}
finally{await browser?.close();await service.close();await save();console.log(JSON.stringify({passed:report.passed,checks:report.cases.map(r=>({theme:r.theme,passed:r.passed,elapsed:r.elapsedSeconds})),failure:report.failure}));}
