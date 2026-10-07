import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';import {createLanHttpServer} from '../server/lanServer.mjs';
await mkdir('qa/v65',{recursive:true});const directory=await mkdtemp(resolve('qa/v65/real-hermes-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'REAL-HERMES-FIXTURE'}),report={directory,scope:'Isolated synthetic users and text documents; real Hermes and DeepSeek Flash; no real user save or files',checks:[]};
try{
const accounts=[];
for(let n=0;n<2;n++){const a=await service.identities.register({login:'real_agent_'+n,password:'fixture-password',name:'验证岛主'+n,islandName:'验证小岛'+n,avatar:'male_'+n,theme:n?'origami':'pixel'});await service.tenants.open(a.token,n?'origami':'pixel',{});accounts.push(a);}
const results=await Promise.all(accounts.map(async(a,n)=>{
 const theme=n?'origami':'pixel',marker='海风验证-'+randomUUID(),message='请在你的默认文档工作区新建 proof.txt，只写入以下一行原文：'+marker+'。用文档工具保存并确认，不需要安排岛内任务。';
 const view=await service.agents.view(a.token,theme);assert(view.status.hermes.configured,'Hermes must be installed and configured');
 const result=await service.agents.wait(a.token,{theme,requestId:randomUUID(),message});assert.equal(result.source,'hermes',JSON.stringify({source:result.source,error:result.providerError,answer:result.answer}));assert.equal(result.model,'deepseek-flash');assert(result.operations.some(o=>o.tool==='document_write'&&o.status==='done'));
 assert.equal((await readFile(resolve(view.documents,'proof.txt'),'utf8')).trim(),marker);assert(result.artifacts.length>0);
 const list=await service.agents.work(a.token,'list',{theme});report.checks.push({owner:n,theme,source:result.source,model:result.model,verifiedWrite:true,artifact:result.artifacts[0].id,ledgerRunId:result.ledgerRunId});console.log('REAL_OWNER_'+n+'_WRITE_VERIFIED');
 return {view,result,marker,theme};
}));
assert.notEqual(results[0].view.documents,results[1].view.documents);
await assert.rejects(service.agents.work(accounts[1].token,'detail',{id:results[0].result.artifacts[0].id}));
const room=await service.identities.action(accounts[0].token,{operation:'room_create',requestId:randomUUID(),title:'实际管家随行',maxPlayers:2});
await service.identities.action(accounts[1].token,{operation:'room_join',requestId:randomUUID(),code:room.view.room.code});
const reply=await service.agents.wait(accounts[1].token,{theme:'origami',requestId:randomUUID(),message:'请读取刚才我们创建的 proof.txt，告诉我其中的完整内容。无需修改或创建其他文件。'});
assert.equal(reply.source,'hermes');assert(reply.operations.some(o=>o.tool==='document_read'&&o.status==='done'));assert(reply.answer.includes(results[1].marker));assert(!reply.answer.includes(results[0].marker));
report.privateArtifacts=true;report.sameOwnerHistoryAndDocumentsWhileVisiting=true;report.passed=true;console.log('REAL_VISIT_CONTINUATION_VERIFIED');
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await service.close();await writeFile('qa/v65/real-hermes-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
