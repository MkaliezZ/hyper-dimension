import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {A2A_EXTENSION} from '../server/a2aGateway.mjs';
assert(process.env.DEEPSEEK_API_KEY&&process.env.HD_TEST_A2A_SDK,'Configure the private model key and installed official SDK');
const {ClientFactory}=await import(process.env.HD_TEST_A2A_SDK),{Message}=await import(new URL('../index.js',process.env.HD_TEST_A2A_SDK).href);
const out=resolve(process.env.HD_QA_OUT||'qa/v357/a2a-live-roundtrip');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(out,'owned-fictional-')),serverDirectory=join(directory,'server');
let service=await createLanHttpServer({directory:serverDirectory,port:0,enrollmentKey:'OWNED-A2A-ROUNDTRIP'}),base='http://127.0.0.1:'+service.port,browser;
const accounts=[],devices=[],pages=[],before=[],errors=[],badAssets=[];
const report={scope:'Official SDK -> two real original-device CLI Hermes/DeepSeek Flash runtimes -> native dual-style UI reply with an actual post-commit response loss -> SDK continuation, correlated owner ledgers and exact history after game-service and CLI reconnect. Both consenting NPC5 companions are carried and represented in canonical exchange context. Fictional Markdown read/edit/readback checks the original private workspace while visiting. No injected game progress, stock, needs or clock. Same Windows host; not physical multi-device, Mac, NPC social encounter or human acceptance.',phase:'setup',startedAt:new Date().toISOString(),checks:[],passed:false};
async function phase(name){report.phase=name;await writeFile(join(out,'progress.json'),JSON.stringify(report,null,2)+'\n');console.log(name);}
async function wait(fn,ms=240000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,400));}throw Error('A2A roundtrip original wait budget elapsed');}
async function startDevice(n,code){
 const d=devices[n],args=[resolve('tools/steward-bridge.mjs'),'--server='+base,'--workspace='+d.workspace,'--state-dir='+d.stateDir,'--name=虚构原机'+n,...(code?['--pair-code='+code]:[])];
 const child=spawn(process.execPath,args,{cwd:resolve('.'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:process.env});d.child=child;d.stderr='';
 child.stdout.on('data',b=>{for(const line of b.toString().split('\n'))try{const value=JSON.parse(line);if(value.verification)d.verification=value.verification;}catch{}});child.stderr.on('data',b=>d.stderr+=b.toString());
 await wait(async()=>{if(child.exitCode!==null)throw Error('Owned CLI stopped; private trace retained');return d.verification&&(await service.bridge.view(accounts[n].token)).pending.length;},45000);
}
async function stopDevices(){for(const d of devices){const child=d.child;if(child&&child.exitCode===null){const ended=new Promise(r=>child.once('close',r));child.kill();await ended;}}}
const options=n=>({serviceParameters:{Authorization:'Bearer '+accounts[n].token},signal:AbortSignal.timeout(260000)});
function input(n,text,taskId){return {message:Message.fromJSON({messageId:randomUUID(),role:'ROLE_USER',parts:[{text}],...(taskId?{taskId}:{}),metadata:{[A2A_EXTENSION]:{recipientId:accounts[1-n].view.me.id}}})};}
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const [n,theme]of ['pixel','origami'].entries()){
  await phase('native-pair-'+theme);const a=await service.identities.register({login:'roundtrip_'+theme,password:'fictional-roundtrip-password',name:n?'虚构访客':'虚构岛主',islandName:n?'月桂访客岛':'松风主岛',avatar:n?'female_2':'male_1',theme});accounts.push(a);await service.tenants.open(a.token,theme,{});before.push((await service.tenants.readIslandForServer(a.view.me.id,theme)).state);
  const workspace=join(directory,'fictional-documents-'+n),stateDir=join(directory,'private-device-'+n);await mkdir(workspace,{recursive:true});await writeFile(join(workspace,'demo-project.md'),'# Fictional A2A project\nStatus: planned\nOnly fictional QA content.\n');devices.push({workspace,stateDir});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:a.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/api/lan/social/tick',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Unrelated automatic social model calls disabled in owned A2A control"}'}));
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)badAssets.push(new URL(r.url()).pathname);});
  await page.goto(base+'/?qa=1');await page.locator('#lanStewardOpen').click();await page.locator('.personal-steward-meta summary').click();await page.locator('#personalDeviceOpen').click();await page.locator('#devicePairBegin').click();
  const command=await page.locator('#devicePairCommand').inputValue(),code=command.match(/--pair-code=(HD-[A-F0-9]+)/)?.[1];assert(code);await startDevice(n,code);await page.locator('[data-device-approve]').waitFor();assert.equal(await page.locator('.device-verification strong').innerText(),devices[n].verification);await page.locator('[data-device-approve]').click();await page.locator('.device-bound .online').waitFor({timeout:30000});await page.locator('#deviceBridgeClose').click();await page.locator('#personalStewardClose').click();
  await service.identities.action(a.token,{operation:'travel_invite',requestId:randomUUID(),npcId:5});
 }
 const room=(await service.identities.action(accounts[0].token,{operation:'room_create',requestId:randomUUID(),title:'真实原机 A2A 往返',maxPlayers:2})).view.room;await service.identities.action(accounts[1].token,{operation:'room_join',requestId:randomUUID(),code:room.code});
 const actualRoom=await service.identities.roomStateForServer(room.id);for(const a of accounts){const party=actualRoom.members[a.view.me.id].travel.members;assert.equal(party.filter(p=>p.kind==='hermes').length,1);assert(party.some(p=>p.kind==='ai'&&p.npcId===5));}
 for(let n=0;n<2;n++){
  await phase('original-private-workspace-'+n);const page=pages[n];await page.reload();await page.locator('#lanStewardOpen').click();await page.locator('#personalStewardMessage').fill('请读取工作区中的 demo-project.md，把 Status: planned 改为 Status: ready，保留其他内容，再读取核对文件后告诉我结果。这是虚构测试材料。');await page.locator('#personalStewardSend').click();
  await wait(async()=>{const job=(await service.agents.view(accounts[n].token,n?'origami':'pixel')).jobs.at(-1);if(job&&['failed','unconfirmed'].includes(job.status))throw Error('Owned document work not confirmed');return job?.status==='completed';});
  const job=(await service.agents.view(accounts[n].token,n?'origami':'pixel')).jobs.at(-1);assert.equal(job.result.source,'hermes');assert.equal(job.result.runtimeLocation.type,'original-device');assert.equal(job.location,'visit');assert(job.result.operations.length>=3);assert.match(await readFile(join(devices[n].workspace,'demo-project.md'),'utf8'),/Status: ready/);await page.locator('#personalExchangeTab').click();await page.locator('#agentExchangeEnabled').check();
  report.checks.push({theme:n?'origami':'pixel',nativePairing:true,actualOriginalWorkspaceTools:true,workspaceRetainedWhileVisiting:true,requiredStewardAndConsentingResidentCarried:true});
 }
 await phase('official-sdk-visiting-original-agent');const factory=new ClientFactory(),clients=await Promise.all(accounts.map(()=>factory.createFromUrl(base))),firstInput=input(1,'请向松风主岛管家介绍自己月桂访客岛的真实设施与随行居民的名字和职业，问问哪些手作活动适合共同筹备。只交流岛屿公开资料，不读取私人文档。');
 const first=await clients[1].sendMessage(firstInput,options(1));assert.equal(first.history.length,2);const id=first.id;await clients[1].sendMessage(firstInput,options(1));
 await phase('native-host-reply-with-lost-acknowledgement');let dropped=0;
 await pages[0].route('**/api/lan/collaboration/action',async route=>{const body=route.request().postDataJSON();if(body.operation==='respond'&&dropped===0){dropped++;await route.fetch();return route.abort('failed');}return route.continue();});
 const nativeText='请回应来访管家，介绍本岛工坊和我们随行居民的实际职业，并提出下一项可一起准备的事情。';await pages[0].locator('#exchangeReply-'+id).fill(nativeText);await pages[0].locator('[data-exchange-op="respond"]').click();await pages[0].locator('#agentExchangeRetryPending').waitFor({timeout:30000});await pages[0].locator('#agentExchangeRetryPending').click();
 let internal;await wait(async()=>{internal=(await service.collaboration.view(accounts[0].token)).tasks.find(t=>t.id===id);if(internal.status==='retry')throw Error('Native A2A reply not confirmed');return internal.messages.length===2;});assert.equal(dropped,1);
 const second=await clients[1].getTask({id},options(1));assert.equal(second.history.length,4);assert.equal(Message.toJSON(second.history[2]).parts[0].text,nativeText);
 await phase('official-sdk-explicit-peer-return');const third=await clients[1].sendMessage(input(1,'请确认已收到主岛回复，结合双方真实工坊和同行居民，简要总结共同筹备的下一步；尚未交付的材料不要说成已交付。',id),options(1));assert.equal(third.history.length,6);
 internal=(await service.collaboration.view(accounts[0].token)).tasks.find(t=>t.id===id);assert.equal(internal.messages.length,3);assert.deepEqual(internal.messages.map(m=>m.ownerAccountId),[accounts[1].view.me.id,accounts[0].view.me.id,accounts[1].view.me.id]);for(let i=1;i<3;i++)assert.equal(internal.messages[i].parentRunId,internal.messages[i-1].ledgerRunId);
 for(let n=0;n<2;n++){
  const runs=(await service.agents.work(accounts[n].token,'ledger',{})).runs.filter(r=>r.kind==='a2a');assert.equal(runs.length,n?2:1);assert(runs.every(r=>r.phase==='completed'&&r.model==='deepseek-flash'));
  const state=(await service.tenants.readIslandForServer(accounts[n].view.me.id,n?'origami':'pixel')).state;assert.deepEqual(state.inventory,before[n].inventory);assert.equal(state.coins,before[n].coins);
  await pages[n].reload();await pages[n].locator('#lanStewardOpen').click();await pages[n].locator('#personalExchangeTab').click();await pages[n].locator('.exchange-thread .a2a-messages p').nth(2).waitFor();await pages[n].screenshot({path:join(out,(n?'origami':'pixel')+'-a2a-roundtrip.png')});report.checks[n].realOriginalA2ARuns=runs.length;
 }
 await phase('service-and-original-cli-reconnect');await stopDevices();const originalPort=service.port;await service.close();service=await createLanHttpServer({directory:serverDirectory,port:originalPort,enrollmentKey:'OWNED-A2A-ROUNDTRIP'});
 for(let n=0;n<2;n++){
  const d=devices[n],child=spawn(process.execPath,[resolve('tools/steward-bridge.mjs'),'--server='+base,'--workspace='+d.workspace,'--state-dir='+d.stateDir],{cwd:resolve('.'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:process.env});d.child=child;child.stdout.resume();child.stderr.on('data',v=>d.stderr+=v.toString());await wait(async()=>{if(child.exitCode!==null)throw Error('Owned reconnect CLI stopped');return(await service.bridge.view(accounts[n].token)).bound?.online;},45000);
 }
 const restored=await(await factory.createFromUrl(base)).getTask({id},options(1));assert.deepEqual(restored,third);
 for(let n=0;n<2;n++){assert.equal((await service.agents.work(accounts[n].token,'ledger',{})).runs.filter(r=>r.kind==='a2a').length,n?2:1);assert.match(await readFile(join(devices[n].workspace,'demo-project.md'),'utf8'),/Status: ready/);report.checks[n].reconnectPreservesTranscriptAndOriginalResults=true;}
 assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);report.messages=internal.messages.map(m=>({ownerIndex:accounts.findIndex(a=>a.view.me.id===m.ownerAccountId),text:m.text,ledgerRunId:m.ledgerRunId,parentRunId:m.parentRunId}));report.standardToNativeToStandard=true;report.postCommitLossReplayedExactlyOnce=true;report.privateFilesNotUsedForA2A=true;report.phase='completed';report.passed=true;
}catch(error){await writeFile(join(out,'private-failure.txt'),error.stack);report.failure='Owned A2A roundtrip failed; inspect retained private trace and progress.';process.exitCode=1;}
finally{await browser?.close();await stopDevices();await service.close();report.finishedAt=new Date().toISOString();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,phase:report.phase,failure:report.failure}));}
