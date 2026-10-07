import assert from 'node:assert/strict';import {createServer} from 'node:http';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
await mkdir('qa/v43',{recursive:true});const directory=await mkdtemp(resolve('qa/v43/lineage-')),requests=[],report={directory,scope:'Actual Hermes parent/child and tools against a local provider fixture; no live provider, user saves or documents.'};
const provider=createServer(async(req,res)=>{
 if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({data:[{id:'deepseek-flash',object:'model',owned_by:'deepseek'}]}));return}
 if(req.url!=='/chat/completions'){res.writeHead(404).end();return}
 let body='';for await(const chunk of req)body+=chunk;const d=JSON.parse(body),parent=d.tools.some(t=>t.function.name==='recruitment_delegate'),steps=d.messages.filter(m=>m.role==='assistant'&&m.tool_calls?.length).length;
 const name=parent?(steps===0?'recruitment_observe':'recruitment_delegate'):(steps===0?'recruitment_observe_child':'recruitment_take_step'),args=steps===0?{}:parent?{stepIds:['fixture:wood']}:{stepIds:['fixture:wood'],intent:'到岛后按实际工具动作收集木材'};
 const total=parent?20:30,usage={prompt_tokens:total-5,completion_tokens:5,total_tokens:total};
 requests.push({model:d.model,parent,step:steps,total});
 const delta=steps<2?{role:'assistant',tool_calls:[{index:0,id:'fixture-'+(parent?'p':'c')+steps,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{role:'assistant',content:'已通过工具确认分工，等待到岛后实际执行。'};
 res.writeHead(200,{'content-type':'text/event-stream'});
 for(const chunk of [{choices:[{index:0,delta,finish_reason:null}]},{choices:[{index:0,delta:{},finish_reason:steps<2?'tool_calls':'stop'}]},{choices:[],usage}])res.write('data: '+JSON.stringify({id:'fixture-lineage',object:'chat.completion.chunk',created:1,model:'deepseek-flash',...chunk})+'\n\n');
 res.end('data: [DONE]\n\n');
});
await new Promise(r=>provider.listen(0,'127.0.0.1',r));
Object.assign(process.env,{DEEPSEEK_API_KEY:'local-test-not-a-secret',HD_MODEL_ENDPOINT:'http://127.0.0.1:'+provider.address().port,HD_SAVE_DIR:directory,HD_HERMES_HOME:resolve(directory,'home'),HD_STEWARD_WORKDIR:resolve(directory,'workbench')});
try{
 const {recruitmentRun}=await import('../server/agentService.mjs'),{runLedger}=await import('../server/runLedger.mjs');
 const run=await recruitmentRun({project:{id:'fixture',title:'本地验证'},candidate:{name:'小麦'},steps:[{id:'fixture:wood',quantity:2}]},'pixel:fixture:1');
 assert.equal(run.child.parentId,run.parent.id);assert.deepEqual(run.child.acceptedSteps,['fixture:wood']);assert.equal(run.parent.usage.total,60);assert.equal(run.child.usage.total,90);
 const snapshot=await runLedger.snapshot(),record=snapshot.runs.find(r=>r.id===run.ledgerRunId);assert.equal(record.usage.total,150);assert.equal(record.usage.calls,6);assert.equal(record.children.length,2);assert.equal(record.children.find(c=>c.parentId).usage.total,90);assert.equal(snapshot.today.knownTokens,150);
 assert.equal(snapshot.today.automaticTokens,0);assert.equal(snapshot.today.manualRuns,1);assert.equal(requests.length,6);assert(requests.every(r=>r.model==='deepseek-flash'));
 report.passed=true;report.requests=requests;report.parent=run.parent.id;report.child=run.child.id;report.usage=record.usage;report.children=record.children;report.today=snapshot.today;console.log(JSON.stringify({passed:true,parentTokens:60,childTokens:90,rootTokens:150,calls:6}));
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;console.error(e)}
finally{await writeFile('qa/v43/lineage-provider-report.json',JSON.stringify(report,null,2));await new Promise(r=>provider.close(r));process.exit(process.exitCode||0)}
