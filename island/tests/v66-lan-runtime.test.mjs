import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import {createLanHttpServer} from '../server/lanServer.mjs';
test('real owner worker keeps automatic cadence after restart, pins Flash, isolates budgets and excludes document tools',{timeout:90000},async()=>{
 await mkdir('qa/v66',{recursive:true});const directory=await mkdtemp(resolve('qa/v66/runtime-')),requests=[],previous={key:process.env.DEEPSEEK_API_KEY,endpoint:process.env.HD_MODEL_ENDPOINT};let service;
 const provider=createServer(async(req,res)=>{
  if(req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({data:[{id:'deepseek-flash',object:'model'}]}));return;}
  if(req.url!=='/chat/completions'){res.writeHead(404).end();return;}const chunks=[];for await(const c of req)chunks.push(c);const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));requests.push(data);
  let content;if(data.tools)content='已观察当前小岛，本轮沿用已有安排。';else{const payload=JSON.parse(data.messages.at(-1).content);content=JSON.stringify(payload.requestedIds?{decisions:payload.residents.map(r=>({id:r.id,purposeId:r.options[0].purposeId,reason:'根据职业完成当前木材收集',speech:'我先去林地收集木材。'}))}:{lines:[{speaker:0,text:'今天天气适合收集木材。'},{speaker:1,text:'我也希望一起把事情做好。'},{speaker:0,text:'我们先把分工确认清楚。'},{speaker:1,text:'好，我完成后再来找你。'}],changes:[],emotions:[],summary:'商量当前安排',type:'negotiate'});}
  if(data.stream){res.writeHead(200,{'Content-Type':'text/event-stream'});for(const [delta,finish_reason]of [[{role:'assistant',content},null],[{},'stop']])res.write('data: '+JSON.stringify({id:'fixture-chat',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta,finish_reason}],usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}})+'\n\n');res.end('data: [DONE]\n\n');}
  else res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({id:'fixture-chat',object:'chat.completion',created:1,model:'deepseek-flash',choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}}));
 });
 await new Promise(r=>provider.listen(0,'127.0.0.1',r));process.env.DEEPSEEK_API_KEY='isolated-test-key';process.env.HD_MODEL_ENDPOINT='http://127.0.0.1:'+provider.address().port;
 try{
  service=await createLanHttpServer({directory,port:0,enrollmentKey:'RUNTIME-AUTO-FIXTURE'});const accounts=[];
  for(let n=0;n<2;n++){const a=await service.identities.register({login:'worker_'+n,password:'fixture-password',name:'运行验证'+n,islandName:'运行验证小岛'+n,avatar:'male_'+n,theme:'pixel'});await service.tenants.open(a.token,'pixel',{});accounts.push(a);}
  const payload=async n=>({theme:'pixel',saveSlot:(await service.tenants.readIslandForServer(accounts[n].view.me.id,'pixel')).state.saveSlot,residents:[0,1].map(id=>({id,name:'测试居民'+id,job:'木工',personality:'认真',options:[{purposeId:'fixture-forest-'+id,goal:'forest',action:'work'}]})),built:[],history:[{role:'user',content:'PRIVATE-DOCUMENT-SENTINEL'}],includeWorkProject:true,message:'PRIVATE-DOCUMENT-SENTINEL'});
  const first=await service.agents.automatic(accounts[0].token,'plans',await payload(0));assert.equal(first.source,'deepseek');assert.equal(first.decisions.length,2);
  await assert.rejects(service.agents.automatic(accounts[0].token,'plans',await payload(0)),e=>e.code==='automatic_cooldown'&&e.status===429&&e.retryAfter>0);
  const social=await service.agents.automatic(accounts[0].token,'conversations',await payload(0));assert.equal(social.lines.length,4);
  const steward=await service.agents.automatic(accounts[0].token,'steward',await payload(0));assert.equal(steward.source,'hermes');assert(!steward.tools.some(t=>t.startsWith('document_')||t==='host_info'));
  const other=await service.agents.automatic(accounts[1].token,'plans',await payload(1));assert.equal(other.source,'deepseek');
  const count=requests.length;
  const ledger=await service.agents.work(accounts[0].token,'ledger',{});assert.equal(ledger.channels.plans.intervalSeconds,300);assert.equal(ledger.channels.conversations.intervalSeconds,600);assert.equal(ledger.channels.steward.intervalSeconds,950);assert.equal(ledger.channels.plans.accepted,1);
  await service.close();service=await createLanHttpServer({directory,port:0,enrollmentKey:'RUNTIME-AUTO-FIXTURE'});
  await assert.rejects(service.agents.automatic(accounts[0].token,'plans',await payload(0)),e=>e.code==='automatic_cooldown'&&e.retryAfter>0);assert.equal(requests.length,count);
  const room=await service.identities.action(accounts[0].token,{operation:'room_create',requestId:randomUUID(),title:'跨岛预算检查',maxPlayers:2});
  await assert.rejects(service.agents.travelConverse(accounts[0].token,room.roomId,await payload(0)),e=>e.code==='automatic_cooldown'&&e.retryAfter>0);assert.equal(requests.length,count);
  const policy=await service.agents.work(accounts[0].token,'ledger',{});await service.agents.work(accounts[0].token,'policy',{requestId:randomUUID(),expectedVersion:policy.policy.version,policy:{paused:true,dailyRunLimit:10,dailyTokenLimit:null}});
  assert.equal((await service.agents.work(accounts[1].token,'ledger',{})).policy.paused,false);
  await assert.rejects(service.agents.travelConverse(accounts[0].token,room.roomId,await payload(0)),e=>e.code==='automatic_paused');assert.equal(requests.length,count);
  const current=await service.identities.view(accounts[0].token);await service.identities.action(accounts[0].token,{operation:'room_close',roomId:room.roomId,expectedRevision:current.room.revision,requestId:randomUUID()});
  await assert.rejects(service.agents.automatic(accounts[0].token,'steward',await payload(0)),e=>e.code==='automatic_paused');
  assert(requests.every(r=>r.model==='deepseek-flash'));assert(!JSON.stringify(requests).includes('PRIVATE-DOCUMENT-SENTINEL'));
  await writeFile('qa/v66/runtime-report.json',JSON.stringify({directory,source:'Actual Node and Python/Hermes workers with isolated local model provider',requests:requests.length,model:'deepseek-flash',cadence:[300,600,950],restartPreservesCadence:true,crossIslandSharesConversationCooldown:true,crossIslandRespectsPause:true,privateBudgets:true,automaticDocumentToolsAbsent:true,personalHistoryExcluded:true,passed:true},null,2));
 }finally{await service?.close();await new Promise(r=>provider.close(r));if(previous.key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previous.key;if(previous.endpoint===undefined)delete process.env.HD_MODEL_ENDPOINT;else process.env.HD_MODEL_ENDPOINT=previous.endpoint;}
});
