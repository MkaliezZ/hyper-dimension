import assert from 'node:assert/strict';import {spawn,execFile} from 'node:child_process';import {createServer} from 'node:http';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
await mkdir('qa/v43',{recursive:true});const directory=await mkdtemp(resolve('qa/v43/runtime-http-')),requests=[],children=[];
const report={directory,kind:'Two real servers, real NPC worker and real Hermes against an isolated local provider fixture; no live provider or user saves.',checks:[],requests};
const provider=createServer(async(req,res)=>{
 if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({data:[{id:'deepseek-flash',object:'model',owned_by:'deepseek'}]}));return}
 if(req.url!=='/chat/completions'){res.writeHead(404).end();return}
 let body='';for await(const c of req)body+=c;const d=JSON.parse(body);requests.push({model:d.model,stream:!!d.stream,tools:!!d.tools});
 const payload=(()=>{try{return JSON.parse(d.messages.at(-1).content)}catch{return {}}})();
 const bad=payload.topic==='invalid-json',content=d.tools?'本地夹具：模型已结束，没有执行任何岛屿或文档操作。':bad?'not-valid-json':JSON.stringify({decisions:[{id:0,purposeId:'fixture',reason:'准备当前缺少的木材',speech:'先去收集木料。'}]});
 const total=d.tools?40:bad?35:30,usage={prompt_tokens:total-10,completion_tokens:10,total_tokens:total};
 if(d.stream){
  res.writeHead(200,{'content-type':'text/event-stream'});
  for(const chunk of [{choices:[{index:0,delta:{role:'assistant',content},finish_reason:null}]},{choices:[{index:0,delta:{},finish_reason:'stop'}]},{choices:[],usage}])res.write('data: '+JSON.stringify({id:'local-usage',object:'chat.completion.chunk',created:1,model:'deepseek-flash',...chunk})+'\n\n');
  res.end('data: [DONE]\n\n');
 }else res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({id:'local-usage',object:'chat.completion',created:1,model:'deepseek-flash',choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage}));
});
await new Promise(r=>provider.listen(0,'127.0.0.1',r));const endpoint='http://127.0.0.1:'+provider.address().port;
async function freePort(){const p=createServer();await new Promise(r=>p.listen(0,'127.0.0.1',r));const port=p.address().port;await new Promise(r=>p.close(r));return port}
async function launch(theme){
 const port=await freePort(),url='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[resolve('server.mjs'),'--port='+port,'--theme='+theme],{windowsHide:true,env:{...process.env,DEEPSEEK_API_KEY:'local-test-not-a-secret',HD_MODEL_ENDPOINT:endpoint,HD_SAVE_DIR:directory,HD_HERMES_HOME:resolve(directory,'hermes-'+theme),HD_STEWARD_WORKDIR:resolve(directory,'workbench'),HD_NPC_MODEL:'deepseek-v4-pro',HD_STEWARD_MODEL:'deepseek-v4-pro'},stdio:'ignore'});children.push(child);
 let ready=false;for(let i=0;i<120;i++){try{ready=(await fetch(url+'/api/status')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready);return {url,child};
}
async function call(server,path,body){const r=await fetch(server.url+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});return {status:r.status,data:await r.json()}}
const runtime=async s=>(await call(s,'/api/admin/runtime')).data;
const resident=id=>({id,name:'测试邻居'+id,job:'木工',personality:'细心',lifeGoal:'备料',speechStyle:'具体',version:1,needs:{hunger:90,energy:90,social:90},options:[{purposeId:'fixture',goal:'forest',action:'work',resource:'wood',duration:12}]});
const tick=theme=>({theme,day:1,built:[],residents:[resident(0)],inventory:{},recipes:[],events:[]});
const manual=theme=>({theme,day:1,built:[],residents:[],inventory:{},message:'这是本地验证，只回复模型结束，不使用工具。',history:[]});
async function set(s,policy,id){const state=await runtime(s),r=await call(s,'/api/admin/policy',{requestId:id,expectedVersion:state.policy.version,policy});assert.equal(r.status,200,JSON.stringify(r.data));return r.data}
async function kill(child){if(child.exitCode!==null)return;if(process.platform==='win32')await new Promise(r=>execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>r()));else child.kill();await new Promise(r=>setTimeout(r,100))}
try{
 const a=await launch('pixel'),b=await launch('origami');
 let state=await set(a,{paused:true,dailyRunLimit:1,dailyTokenLimit:50},'pause');
 const denied=await Promise.all([call(a,'/api/npc/tick',tick('pixel')),call(b,'/api/npc/tick',tick('origami'))]);assert(denied.every(r=>r.status===429&&r.data.code==='automatic_paused'));assert.equal(requests.length,0);
 const first=await call(a,'/api/hermes/command',manual('pixel'));assert.equal(first.status,200);assert.equal(first.data.source,'hermes',JSON.stringify(first.data));
 let rows=(await runtime(a)).runs;const root=rows.find(r=>r.id===first.data.ledgerRunId);assert(root);assert.equal(root.usage.total,40,JSON.stringify(root));assert.equal(root.usage.calls,1);assert.equal(root.phase,'completed');
 report.checks.push('paused automatic routes make no provider request; real Hermes manual stream reports 40 tokens');
 await set(b,{paused:false,dailyRunLimit:1,dailyTokenLimit:50},'resume');
 const race=await Promise.all([call(a,'/api/npc/tick',tick('pixel')),call(b,'/api/npc/tick',tick('origami'))]);assert.equal(race.filter(r=>r.status===200).length,1);assert.equal(race.filter(r=>r.status===429).length,1);
 const result=race.find(r=>r.status===200).data;assert.equal(result.decisions.length,1);rows=(await runtime(a)).runs;assert.equal(rows.find(r=>r.id===result.ledgerRunId).usage.total,30);
 const exhausted=await call(b,'/api/npc/interact',{...tick('origami'),residents:[resident(0),resident(1)]});assert.equal(exhausted.data.code,'automatic_budget_exhausted');
 const second=await call(b,'/api/hermes/command',manual('origami'));assert.equal(second.data.source,'hermes');assert.equal((await runtime(b)).today.automaticTokens,30);
 await set(a,{paused:false,dailyRunLimit:null,dailyTokenLimit:30},'token-limit');assert.equal((await call(b,'/api/npc/tick',tick('origami'))).data.code,'automatic_budget_exhausted');
 await set(a,{paused:false,dailyRunLimit:null,dailyTokenLimit:null},'unlimited');
 const bad=await call(a,'/api/npc/interact',{...tick('pixel'),residents:[resident(0),resident(1)],topic:'invalid-json'});assert.equal(bad.status,503);
 state=await runtime(b);const failed=state.runs.find(r=>r.kind==='conversations');assert.equal(failed.phase,'failed');assert.equal(failed.usage.total,35);assert.equal(state.today.automaticTokens,65);assert.equal(state.today.knownTokens,145);
 const originDenied=await fetch(a.url+'/api/admin/runtime',{headers:{Origin:'https://foreign.example'}});assert.equal(originDenied.status,403);
 report.checks.push('shared cross-process quota; actual NPC 30 and malformed-response 35 tokens; manual excluded from automatic 65; 145 total without double counting; cross-origin blocked');
 await kill(a.child);const restarted=await launch('pixel');const persisted=await runtime(restarted);assert.equal(persisted.today.knownTokens,145);assert.equal(persisted.runs.length,4);assert.equal(persisted.policy.paused,false);
 assert(requests.every(r=>r.model==='deepseek-flash'));report.today=persisted.today;report.policy=persisted.policy;report.runs=persisted.runs.map(({id,kind,theme,phase,usage})=>({id,kind,theme,phase,usage}));report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;throw e}
finally{for(const child of children)await kill(child);await new Promise(r=>provider.close(r));await writeFile('qa/v43/runtime-http-report.json',JSON.stringify(report,null,2))}
console.log(JSON.stringify(report,null,2));
