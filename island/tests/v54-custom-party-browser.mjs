import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
const out=process.env.HD_QA_OUT||'qa/v54/custom-party';await mkdir(out,{recursive:true});const directory=await mkdtemp(resolve(out,'browser-'));
const captured=[];
const provider=createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;const data=JSON.parse(body);captured.push({model:data.model,payload:JSON.parse(data.messages.at(-1).content)});res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({choices:[{message:{role:'assistant',content:JSON.stringify({guestId:4,reason:'莉安的工作是花艺，性格细致。她能把花园的颜色带到海边，适合陪伴这场相聚。'})},finish_reason:'stop'}],usage:{prompt_tokens:200,completion_tokens:50,total_tokens:250}}));});
await new Promise(r=>provider.listen(0,'127.0.0.1',r));const modelEndpoint='http://127.0.0.1:'+provider.address().port;
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,saves=createSaveStore({directory});
for(const theme of ['pixel','origami']){const s=hydrateTown(createState());s.freshStartPending=false;for(const n of Object.values(s.npcNeeds))n.hunger=n.energy=n.social=100;s.coins=120;for(const id of Object.keys(s.inventory))s.inventory[id]=0;Object.assign(s.inventory,{rod:1,c8_2:1,c16_4:1,c16_2:1,bread:4,rose:1});await saves.open(theme,{legacyState:s,clientId:'fixture'});}
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port,'--theme=origami'],{cwd:resolve('.'),windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory,HD_MODEL_ENDPOINT:modelEndpoint},stdio:['ignore','pipe','pipe']});
let logs='',browser,page;server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const report={directory,kind:'Actual dual-theme custom design, local Flash suggestion fixture, server proposal publish/update, versioned gift reconfirmation, real third-guest arrival and explicit partial cancellation. Not provider provenance, full game or human acceptance.',checks:[],errors:[]},wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000){const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await wait(100)}throw Error('condition timed out after '+ms);}
async function save(){await page.locator('#closeModal').click();await page.locator('#saveStatus').click();await page.locator('#saveNow').click();await wait(700);await page.locator('#closeModal').click();}
async function board(){await page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!document.querySelector('#islandBootNotice'));await page.locator('#partyBtn').click();if(await page.locator('#fishingPartyOpen').count())await page.locator('#fishingPartyOpen').click();await page.locator('#fishingBoard').waitFor();}
try{
 await until(async()=>{try{return(await fetch(base+'/api/status')).ok}catch{return false}});
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const ctx=await browser.newContext({viewport:{width:1440,height:1050}});
  await ctx.route('**/api/**',r=>/\/api\/(saves|parties)\//.test(r.request().url())?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated ordinary AI"}'}));
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push({theme,message:e.message,stack:e.stack}));
  await page.goto(base+'/?qa=1&theme='+theme);const inspect=()=>page.evaluate(()=>window.islandInspect());
  await board();await page.locator('#fishingDesign').click();
  await page.locator('#partyDesignName').fill('花园里的海风小聚');
  await page.locator('#partyDesignDescription').fill('用花园的颜色记住海边的相聚，钓完鱼一起吃茶点。');
  await page.locator('.party-theme-tags input[value="nature"]').check();
  await page.locator('#partySuggest').click();await until(async()=>await page.locator('.party-proposal-source').innerText().then(s=>s.includes('DeepSeek')));
  assert((await page.locator('#partyPreview').innerText()).includes('莉安'));
  await page.screenshot({path:out+'/'+theme+'-designer.png'});
  await page.setViewportSize({width:390,height:820});assert.equal(await page.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:out+'/'+theme+'-designer-compact.png'});await page.setViewportSize({width:1440,height:1050});
  await page.locator('#partyPublish').click();await page.waitForSelector('[data-fishing-invite]');let d=(await inspect()).fishingParty.draft;assert.equal(d.guestId,4);assert.equal(d.source,'deepseek');assert(d.proposalId);assert.deepEqual(d.tags,['nature','sea']);
  for(const id of [8,2,4]){await page.locator('[data-fishing-invite="'+id+'"]').click();await page.locator('#fishingInviteGive').click();await page.waitForSelector('[data-fishing-invite="'+id+'"]:disabled');}
  assert.equal((await inspect()).inventory.rose,0);
  await page.locator('#fishingDesign').click();await page.locator('#partyDesignName').fill('花园海风 · 再约定');await page.locator('#partyPublish').click();await page.waitForSelector('[data-fishing-invite]');d=(await inspect()).fishingParty.draft;assert.equal(d.version,1);assert.equal(Object.keys(d.invites).length,3);assert.equal(d.guestId,4);
  await page.locator('#fishingPlan').click();await page.waitForFunction(()=>window.islandInspect().fishingParty.draft.projectId);await page.locator('#closeModal').click();await board();
  await page.locator('#fishingDesign').click();await page.locator('#partyDesignDescription').fill('花园主题继续，钓完鱼先听一段海岛故事。');
  assert(await page.locator('#partyPublish').isDisabled());await page.locator('#partySuggest').click();await until(async()=>await page.locator('.party-proposal-source').innerText().then(s=>s.includes('DeepSeek')));await page.locator('#partyPublish').click();await page.waitForSelector('[data-fishing-invite]');
  d=(await inspect()).fishingParty.draft;assert.equal(d.version,2);assert.equal(Object.keys(d.invites).length,0);assert.equal((await inspect()).workProjects[0].status,'cancelled');
  for(const id of [8,2,4]){assert((await page.locator('[data-fishing-invite="'+id+'"]').innerText()).includes('不重复收物'));await page.locator('[data-fishing-invite="'+id+'"]').click();assert((await page.locator('.fishing-gift').innerText()).includes('不重复收取'));await page.locator('#fishingInviteGive').click();await page.waitForSelector('[data-fishing-invite="'+id+'"]:disabled');}
  assert.equal((await inspect()).inventory.rose,0);await save();await page.reload();await board();assert.equal((await inspect()).fishingParty.draft.version,2);assert.equal(Object.keys((await inspect()).fishingParty.draft.invites).length,3);
  await page.screenshot({path:out+'/'+theme+'-reconfirmed.png'});
  await page.locator('#fishingStart').click();await until(async()=>(await inspect()).fishingParty?.session?.phase==='running',120000);
  if(await page.locator('#fishingEnter').count())await page.locator('#fishingEnter').click();else if(!await page.locator('#fishingGame').count())await board();
  await page.locator('#fishingGame').waitFor();assert((await page.locator('.fishing-spectator').innerText()).includes('莉安'));
  const g=(await inspect()).fishingParty.session;assert.equal(g.participants.length,3);assert(g.participants.every(p=>p.arrived));
  const spots=g.participants.map(p=>p.position);for(let i=0;i<spots.length;i++)for(let j=i+1;j<spots.length;j++)assert(Math.hypot(spots[i].x-spots[j].x,spots[i].y-spots[j].y)>30);
  await page.locator('[data-fish="next"]').click();await wait(150);await page.locator('[data-fish="pause"]').click();await page.screenshot({path:out+'/'+theme+'-spectator.png'});
  await page.locator('[data-fish="quit"]').click();await page.locator('[data-fish="quit"]').click();await page.waitForFunction(()=>!window.islandInspect().fishingParty.session);const disk=await saves.current(theme);assert.equal(disk.state.fishingParty.history[0].phase,'abandoned');assert.equal(disk.state.activities,0);report.checks.push({theme,version:2,guest:4,source:g.source,proposalId:g.proposalId,reconfirmedWithoutSecondGift:true,threeActualSeparateArrivals:true,partialCancelNoReward:true});await ctx.close();
 }
 assert.equal(captured.length,4);assert(captured.every(p=>p.model==='deepseek-flash'&&p.payload.world.candidates.some(r=>r.id===4)));assert.equal(report.errors.length,0);report.providerCalls=captured.map(p=>({model:p.model,draftVersion:p.payload.world.draft?.version||null}));report.passed=true;
}catch(e){report.failure=e.stack;report.logs=logs;process.exitCode=1;if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await browser?.close();server.kill();provider.close();await writeFile(out+'/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
