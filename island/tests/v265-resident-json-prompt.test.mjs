import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runtimeConfig} from '../server/runtimeConfig.mjs';

const root=resolve(import.meta.dirname,'..');
async function dispatchedPlan(content){
 const requests=[];
 const provider=createServer(async(req,res)=>{
  let body='';for await(const bytes of req)body+=bytes;
  requests.push(JSON.parse(body));res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{role:'assistant',content}}],usage:{prompt_tokens:10,completion_tokens:4,total_tokens:14}}));
 });
 await new Promise(r=>provider.listen(0,'127.0.0.1',r));
 const directory=await mkdtemp(join(tmpdir(),'hyper-dimension-plan-format-'));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('HD_')&&key!=='DEEPSEEK_API_KEY'));
 Object.assign(env,{DEEPSEEK_API_KEY:'fictional-local-provider-key',HD_MODEL_ENDPOINT:'http://127.0.0.1:'+provider.address().port,HD_MODEL_PYTHON:runtimeConfig.paths.modelPython,PYTHONDONTWRITEBYTECODE:'1'});
 for(const [name,folder]of Object.entries({HD_SAVE_DIR:'saves',HD_RUN_LEDGER_DIR:'runs',HD_ARTIFACT_DIR:'artifacts',HD_HERMES_HOME:'hermes',HD_STEWARD_WORKDIR:'documents',HD_DOCUMENT_ROOT:'documents'}))env[name]=join(directory,folder);
 const script=`
 const service=await import('./server/agentService.mjs');
 const {runLedger}=await import('./server/runLedger.mjs');
 let result;
 try{
  const answer=await service.decideBatch({theme:'pixel',saveSlot:'fictional-format-check',day:1,residents:[{id:7,name:'虚构居民',schedule:{period:'work',work:[9,17],wake:6,sleep:22,hour:12},options:[{purposeId:'career:0',goal:'forest',action:'work',resource:'wood',duration:20,reason:'筹备木作材料'}]}]});
  result={answer};
 }catch(error){result={errorCode:error.code,error:error.message};}
 finally{await service.stopAgentWorkers();}
 const snapshot=await runLedger.snapshot();
 console.log(JSON.stringify({...result,runs:snapshot.runs.map(r=>({model:r.model,phase:r.phase,resultCode:r.resultCode,usage:r.usage})),plans:snapshot.channels.plans}));
 `;
 try{
  const output=await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{cwd:root,env,windowsHide:true,timeout:30000,maxBuffer:100000});
  const result=JSON.parse(output.stdout.trim().split('\n').at(-1));
  assert.equal(requests.length,1,'No format-repair provider retry may bypass the automatic budget');
  assert.equal(requests[0].model,'deepseek-flash');
  assert.deepEqual(requests[0].response_format,{type:'json_object'});
  assert.deepEqual(requests[0].thinking,{type:'disabled'});
  assert.equal(requests[0].max_tokens,3000);
  assert.equal(result.runs.length,1);assert.equal(result.runs[0].model,'deepseek-flash');
  assert.equal(result.plans.accepted,1);
  assert.equal(result.runs[0].usage.total,14);
  assert.equal(result.runs[0].usage.calls,1);
  return {request:requests[0],result};
 }finally{await new Promise(r=>provider.close(r));}
}

test('actual dispatched resident planning prompt provides valid JSON and preserves allowed NPC purpose selection',{timeout:45000},async()=>{
 const {request,result}=await dispatchedPlan('{"decisions":[{"id":7,"purposeId":"career:0","reason":"筹备木料","speech":"先备好材料。"}]}');
 const system=request.messages.find(m=>m.role==='system').content;
 const example=system.match(/\{[\s\S]+\}/)?.[0];assert(example,'A complete output example is required');
 const sample=JSON.parse(example);assert(Array.isArray(sample.decisions)&&sample.decisions.length===1);
 assert.equal(typeof sample.decisions[0].id,'number');assert.equal(typeof sample.decisions[0].purposeId,'string');
 assert.equal(typeof sample.decisions[0].reason,'string');assert.equal(typeof sample.decisions[0].speech,'string');
 assert.match(system,/最后一项.*逗号/);assert.match(system,/示例.*不能.*替代/);
 assert.equal(result.answer.source,'deepseek');assert.equal(result.answer.decisions[0].id,7);
 assert.equal(result.answer.decisions[0].purposeId,'career:0');assert.equal(result.answer.decisions[0].resource,'wood');
 assert.equal(result.runs[0].phase,'completed');
});

test('a stopped reply with the actual trailing-comma failure remains rejected and preserves its one-call reported usage',{timeout:45000},async()=>{
 const {result}=await dispatchedPlan('{"decisions":[{"id":7,"purposeId":"career:0","reason":"虚构筹备目的",}]}');
 assert.equal(result.errorCode,'model_response_format');assert.equal(result.answer,undefined);
 assert.equal(result.runs[0].phase,'failed');assert.equal(result.runs[0].resultCode,'model_response_format');
});
