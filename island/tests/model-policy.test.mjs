import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {runtimeConfig} from '../server/runtimeConfig.mjs';
import {DEEPSEEK_MODEL,DEEPSEEK_MODEL_LABEL,islandWorkerEnvironment} from '../server/modelPolicy.mjs';
test('worker environment pins the official Flash ID despite inherited Pro settings',()=>{
 const env=islandWorkerEnvironment({HD_NPC_MODEL:'deepseek-v4-pro',HD_STEWARD_MODEL:'deepseek-v4-pro',HD_MODEL_ENDPOINT:'http://127.0.0.1'});
 assert.equal(env.HD_NPC_MODEL,'deepseek-flash');assert.equal(env.HD_STEWARD_MODEL,'deepseek-flash');assert.equal(DEEPSEEK_MODEL_LABEL,'DeepSeek V4.1 Flash');assert.equal(env.HD_MODEL_ENDPOINT,'http://127.0.0.1');
});
test('actual NPC and Hermes workers send Flash on the wire with Pro env and fallback config',{timeout:60000},async()=>{
 const requests=[];const root=resolve(import.meta.dirname,'..'),children=[];
 const server=createServer(async(req,res)=>{
  if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({data:[{id:DEEPSEEK_MODEL,object:'model',owned_by:'deepseek'}]}));return;}
  if(req.url!=='/chat/completions'){res.writeHead(404).end();return;}
  let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);requests.push({model:data.model,stream:!!data.stream,tools:!!data.tools});
  const content=data.tools?'本地测试已核对模型配置。':'{"decisions":[]}';
  if(data.stream){
   res.writeHead(200,{'content-type':'text/event-stream'});
   for(const [delta,finish_reason] of [[{role:'assistant',content},null],[{},'stop']])res.write('data: '+JSON.stringify({id:'test-completion',object:'chat.completion.chunk',created:1,model:DEEPSEEK_MODEL,choices:[{index:0,delta,finish_reason}]})+'\n\n');
   res.end('data: [DONE]\n\n');
  }else res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({id:'test-completion',object:'chat.completion',created:1,model:DEEPSEEK_MODEL,choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}}));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const home=resolve(root,'qa/model-policy-hermes');await mkdir(home,{recursive:true});await writeFile(resolve(home,'config.yaml'),JSON.stringify({model:{default:'deepseek-v4-pro',provider:'custom',base_url:base},fallback_providers:[{provider:'custom',model:'deepseek-v4-pro',base_url:base,api_key:'test-key-not-a-secret'}],memory:{memory_enabled:false,user_profile_enabled:false},toolsets:['hyper_dimension'],tools:{tool_search:{enabled:'off'}}}));
 const env={...process.env,DEEPSEEK_API_KEY:'test-key-not-a-secret',HD_MODEL_ENDPOINT:base,HD_NPC_MODEL:'deepseek-v4-pro',HD_STEWARD_MODEL:'deepseek-v4-pro',HERMES_HOME:home,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'};
 async function run(executable,args,packet){const child=spawn(executable,args,{cwd:root,env,windowsHide:true,stdio:['pipe','pipe','pipe']});children.push(child);child.stderr.resume();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('worker timed out')),40000);child.on('error',e=>{clearTimeout(timer);reject(e)});child.on('exit',code=>{clearTimeout(timer);if(code)reject(Error('worker exit '+code))});createInterface({input:child.stdout}).on('line',line=>{let r;try{r=JSON.parse(line)}catch{return}if(r.id===packet.id){clearTimeout(timer);child.kill();resolve(r)}});child.stdin.write(JSON.stringify(packet)+'\n')})}
 try{
  const resident=await run(runtimeConfig.paths.modelPython,[resolve(root,'server/model_worker.py')],{id:101,system:'Return a JSON object',payload:{},maxTokens:100});assert.ok(!resident.error,resident.error);assert.equal(resident.metrics.model,'deepseek-flash');
  const install=runtimeConfig.paths.install;
  const hermes=await run(runtimeConfig.paths.hermesPython,[resolve(root,'server/hermes_worker.py'),install],{id:102,message:'读取测试环境中的岛屿状态',payload:{built:[],openKinds:[],residents:[],inventory:{},materials:[],recipes:[]}});
  assert.ok(!hermes.error,hermes.error);assert.equal(hermes.answer.model,'deepseek-flash');
  console.log('Observed local request models:',JSON.stringify(requests));assert.ok(requests.length>=2);assert.ok(requests.every(r=>r.model==='deepseek-flash'));
  await writeFile(resolve(root,'qa/model-policy-validation.json'),JSON.stringify({model:DEEPSEEK_MODEL,label:DEEPSEEK_MODEL_LABEL,requests,proEnvironmentOverridden:true,hermesFallbackDisabled:true,testEndpoint:'local mock',liveProviderVerified:false},null,2));console.log('Verified NPC and real Hermes request bodies:',JSON.stringify(requests));
 }finally{for(const child of children)child.kill();await new Promise(r=>server.close(r));}
});
