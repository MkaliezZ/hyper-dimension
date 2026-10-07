import assert from 'node:assert/strict';import {createServer} from 'node:http';import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';import {resolve} from 'node:path';
await mkdir('qa/v44',{recursive:true});const directory=await mkdtemp(resolve('qa/v44/hermes-')),path=resolve(directory,'实际成果.txt'),requests=[],report={directory,scope:'Actual Hermes engine and document tools against a local provider fixture; only synthetic project notes and isolated test files, no live provider or user data.'};
const provider=createServer(async(req,res)=>{
 if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({data:[{id:'deepseek-flash',object:'model'}]}));return}
 if(req.url!=='/chat/completions'){res.writeHead(404).end();return}
 let body='';for await(const c of req)body+=c;const d=JSON.parse(body),text=JSON.stringify(d.messages),steps=d.messages.filter(m=>m.role==='assistant'&&m.tool_calls?.length).length,manual=d.tools.some(t=>t.function.name==='document_write');
 const mode=text.includes('fixture-mode:write')?'write':text.includes('fixture-mode:failure')?'failure':text.includes('fixture-mode:local-save')?'local-save':'no-file';
 requests.push({model:d.model,mode,step:steps,manual,projectContext:text.includes('synthetic-current-marker'),historyAbsent:!text.includes('synthetic-history-marker')});
 let delta;const tool=(name,args)=>({role:'assistant',tool_calls:[{index:0,id:'fixture-'+steps,type:'function',function:{name,arguments:JSON.stringify(args)}}]});
 if(mode==='local-save'&&steps===0)delta=tool('document_write',{path:resolve(directory,'本机归档.txt'),content:'本机归档，不携带项目纪要'});
 else if(mode==='write'&&steps===0)delta=tool('document_write',{path,content:'版本一：预算100\n第二行'});
 else if(mode==='write'&&steps===1)delta=tool('document_edit',{path,oldText:'预算100',newText:'预算180'});
 else if(mode==='failure'&&steps===0)delta=tool('document_edit',{path,oldText:'预算180',newText:'预算220'});
 else if(mode==='failure'){res.writeHead(401,{'content-type':'application/json'}).end(JSON.stringify({error:{message:'fixture auth failure after save',type:'authentication_error',code:'invalid_api_key'}}));return}
 else delta={role:'assistant',content:mode==='write'?'文件已实际保存、回读与修改。':'仅提及虚构文件，没有保存工具调用。'};
 res.writeHead(200,{'content-type':'text/event-stream'});for(const c of [{choices:[{index:0,delta,finish_reason:null}]},{choices:[{index:0,delta:{},finish_reason:delta.tool_calls?'tool_calls':'stop'}]},{choices:[],usage:{prompt_tokens:25,completion_tokens:5,total_tokens:30}}])res.write('data: '+JSON.stringify({id:'fixture-document',object:'chat.completion.chunk',created:1,model:'deepseek-flash',...c})+'\n\n');res.end('data: [DONE]\n\n');
});
await new Promise(r=>provider.listen(0,'127.0.0.1',r));
Object.assign(process.env,{DEEPSEEK_API_KEY:'local-test-not-a-secret',HD_MODEL_ENDPOINT:'http://127.0.0.1:'+provider.address().port,HD_SAVE_DIR:directory,HD_HERMES_HOME:resolve(directory,'home'),HD_STEWARD_WORKDIR:resolve(directory,'workbench')});
try{
 const {steward}=await import('../server/agentService.mjs'),{workbench}=await import('../server/workbenchService.mjs'),{runLedger}=await import('../server/runLedger.mjs');
 let list=await workbench.project('pixel',{action:'create',name:'Synthetic document project',goal:'Test fixture only',notes:'synthetic-history-marker',requestId:'fixture-create'}),p=list.projects[0];
 await workbench.project('pixel',{action:'update',id:p.id,expectedVersion:1,name:p.name,goal:p.goal,notes:'synthetic-current-marker',requestId:'fixture-current'});
 const input={theme:'pixel',day:1,built:[],inventory:{},residents:[],recipes:[],tasks:{},events:[],automatic:false};
 const answer=await steward({...input,includeWorkProject:true,message:'fixture-mode:write; 创建并修改隔离文件',retryModel:true});assert.equal(answer.source,'hermes');assert.equal(answer.artifacts.length,2);assert.deepEqual(answer.artifacts.map(v=>v.version),[1,2]);
 assert(answer.operations.every(op=>op.status==='done'&&op.artifact?.id));assert(answer.artifacts.every(v=>v.projectId===p.id&&v.runId===answer.ledgerRunId));
 assert.equal((await workbench.preview(answer.artifacts[0].id)).preview.content,'版本一：预算100\n第二行');assert.equal((await workbench.download(answer.artifacts[1].id)).bytes.toString(),'版本一：预算180\n第二行');
 assert.equal(await readFile(path,'utf8'),'版本一：预算180\n第二行');assert(requests.every(r=>r.projectContext&&r.historyAbsent));
 const fake=await steward({...input,message:'仅提及一个文件名',retryModel:true});assert.equal(fake.artifacts.length,0);assert.equal(requests.at(-1).projectContext,false);
 const local=await steward({...input,message:'fixture-mode:local-save',retryModel:true});assert.equal(local.artifacts.length,1);assert.equal(local.artifacts[0].projectId,p.id);assert.equal(requests.at(-1).projectContext,false);
 const auto=await steward({...input,automatic:true,includeWorkProject:true,message:'仅自动观察小岛',retryModel:true});assert.equal(auto.source,'hermes');assert.equal(requests.at(-1).manual,false);assert.equal(requests.at(-1).projectContext,false);
 const failed=await steward({...input,includeWorkProject:true,message:'fixture-mode:failure; 保存后模拟模型出错',retryModel:true});assert.equal(failed.source,'local');assert.equal(failed.artifacts.length,1);assert.equal(failed.artifacts[0].version,3);assert.equal(failed.operations[0].status,'done');assert.equal((await workbench.download(failed.artifacts[0].id)).bytes.toString(),'版本一：预算220\n第二行');
 assert(requests.every(r=>r.model==='deepseek-flash'));const runs=await runLedger.snapshot();assert.equal(runs.runs.filter(r=>r.kind==='steward_manual').length,4);assert.equal(runs.runs.filter(r=>r.phase==='failed').length,1);
 report.passed=true;report.requests=requests;report.actualVersions=(await workbench.list('pixel')).totalVersions;report.savedAfterModelFailure=true;report.explicitManualContext=true;report.automaticAndDefaultNoContext=true;console.log(JSON.stringify({passed:true,actualVersions:4,savedAfterModelFailure:true,requests:requests.length}));
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;console.error(e)}
finally{await writeFile('qa/v44/hermes-artifacts-report.json',JSON.stringify(report,null,2));await new Promise(r=>provider.close(r));process.exit(process.exitCode||0)}
