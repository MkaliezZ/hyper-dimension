import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {mkdir,mkdtemp,readFile,writeFile,copyFile} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';import {createHash} from 'node:crypto';
import {createDataBackup,verifyDataBackup,restoreDataBackup} from '../server/dataBackup.mjs';
import {inspectSqliteBackup} from '../server/sqliteBackup.mjs';
const exec=promisify(execFile),out=resolve('qa/v82');
function rows(file){const db=new DatabaseSync(file,{readOnly:true});try{return db.prepare('SELECT * FROM messages ORDER BY id').all()}finally{db.close()}}
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
test('real Hermes canonical sessions retain tool links, recruitment lineage and scoped manual continuation after whole migration',{timeout:120000},async()=>{
 await mkdir(out,{recursive:true});const fixture=await mkdtemp(join(out,'sessions-')),data=join(fixture,'data'),target=join(fixture,'restored'),backup=join(fixture,'backup'),initialFile=join(fixture,'initial.json'),resumedFile=join(fixture,'resumed.json');
 const requests=[],report={scope:'Actual pinned Hermes engine and document tools against a local HTTP provider fixture; real canonical SQLite, full backup and fresh-process restore; no live DeepSeek, user documents or user saves.',fixture};
 let activeDirectory=data,providerFailure;
 const provider=createServer(async(req,res)=>{try{
  if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({data:[{id:'deepseek-flash',object:'model',owned_by:'deepseek'}]}));return;}
  if(!req.url.endsWith('/chat/completions')){res.writeHead(404).end();return;}
  let text='';for await(const chunk of req)text+=chunk;const d=JSON.parse(text);assert.equal(d.model,'deepseek-flash');const names=d.tools.map(t=>t.function.name),last=d.messages.findLastIndex(m=>m.role==='user'),user=d.messages[last]?.content||'',turn=d.messages.slice(last+1),step=turn.filter(m=>m.role==='assistant'&&m.tool_calls?.length).length;
  let name,args,limit=2;
  if(names.includes('recruitment_delegate')){name=step===0?'recruitment_observe':'recruitment_delegate';args=step===0?{}:{stepIds:['fixture:wood']};}
  else if(names.includes('recruitment_take_step')){name=step===0?'recruitment_observe_child':'recruitment_take_step';args=step===0?{}:{stepIds:['fixture:wood'],intent:'按真实工具动作取得木材'};}
  else if(names.includes('a2a_reply')){name=step===0?'a2a_observe':'a2a_reply';args=step===0?{}:{decision:'propose',message:'会先核对携物与主题穿着，准备妥当后请岛主确认参加本场活动。'};}
  else if(names.includes('document_read')){const partial=user.includes('V82_PARTIAL_FAILURE');name=step===0?'island_observe':partial?'document_write':'document_read';args=step===0?{}:partial?{path:join(activeDirectory,'workbench','partial.md'),content:'V82_PARTIAL_WORK: 请先核对这份实际成果。'}:{path:join(activeDirectory,'workbench','input.md')};if(user.includes('V82_RESUME'))assert(d.messages.slice(0,last).some(m=>m.role==='tool'&&typeof m.content==='string'&&m.content.includes('V82_TOOL_MEMORY')),'prior tool result missing from native resume');}
  else {limit=1;name='island_observe';args={};assert(!names.includes('document_read'));assert(!JSON.stringify(d.messages).includes('V82_TOOL_MEMORY'));}
  requests.push({model:d.model,names,tool:step<limit?name:null,resumed:user.includes('V82_RESUME'),nativeToolMemory:d.messages.slice(0,last).some(m=>m.role==='tool'&&String(m.content).includes('V82_TOOL_MEMORY'))});
  if(user.includes('V82_PARTIAL_FAILURE')&&step>=limit){res.writeHead(402,{'content-type':'application/json'}).end(JSON.stringify({error:{message:'Isolated fixture: response interrupted after actual document operation',code:'insufficient_balance'}}));return;}
  const delta=step<limit?{role:'assistant',tool_calls:[{index:0,id:'v82-call-'+requests.length,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{role:'assistant',content:'已核对实际工具记录，下一步按当前工作区继续。'};
  res.writeHead(200,{'content-type':'text/event-stream'});for(const part of [{choices:[{index:0,delta,finish_reason:null}]},{choices:[{index:0,delta:{},finish_reason:step<limit?'tool_calls':'stop'}]},{choices:[],usage:{prompt_tokens:15,completion_tokens:5,total_tokens:20}}])res.write('data: '+JSON.stringify({id:'v82-session-fixture',object:'chat.completion.chunk',created:1,model:'deepseek-flash',...part})+'\n\n');res.end('data: [DONE]\n\n');
 }catch(e){providerFailure=e;res.writeHead(500,{'content-type':'application/json'}).end(JSON.stringify({error:{message:e.message}}));}});
 await new Promise(r=>provider.listen(0,'127.0.0.1',r));
 const localRuntime=existsSync(resolve('.runtime/hermes-agent/run_agent.py'));
 const install=process.env.HD_V82_TEST_INSTALL||resolve(localRuntime?'.runtime/hermes-agent':'qa/v80/fresh-runtime/hermes-agent'),python=process.env.HD_V82_TEST_PYTHON||resolve(localRuntime?'.runtime/python/Scripts/python.exe':'qa/v80/fresh-runtime/python/Scripts/python.exe');
 const environment=directory=>({...process.env,DEEPSEEK_API_KEY:'local-fixture-no-secret',HD_MODEL_ENDPOINT:'http://127.0.0.1:'+provider.address().port,HD_HERMES_INSTALL:install,HD_HERMES_PYTHON:python,HD_MODEL_PYTHON:python,HD_DOCUMENT_PYTHON:python,HD_HERMES_HOME:join(directory,'hermes'),HD_SAVE_DIR:join(directory,'saves'),HD_RUN_LEDGER_DIR:join(directory,'runs'),HD_ARTIFACT_DIR:join(directory,'artifacts'),HD_STEWARD_WORKDIR:join(directory,'workbench'),HD_DOCUMENT_ROOT:join(directory,'workbench'),PYTHONDONTWRITEBYTECODE:'1'});
 try{
  await exec(process.execPath,['tests/v82-session-worker-helper.mjs',data,'initial',initialFile],{env:environment(data),windowsHide:true,timeout:60000,maxBuffer:100000});
  assert(!providerFailure,providerFailure?.stack);const initial=JSON.parse(await readFile(initialFile,'utf8')),dbFile=join(data,'hermes','state.db'),originalMessages=rows(dbFile),beforeHash=hash(originalMessages);
  const db=new DatabaseSync(dbFile,{readOnly:true});try{
   const child=db.prepare('SELECT parent_session_id FROM sessions WHERE id=?').get(initial.child);assert.equal(child.parent_session_id,initial.parent);
   const scoped=db.prepare('SELECT COUNT(*) AS n FROM hd_session_scopes').get().n;assert.equal(scoped,5);
   const manual=db.prepare('SELECT * FROM messages WHERE session_id=? ORDER BY id').all(initial.manual.id);assert(manual.some(m=>m.role==='tool'&&m.content.includes('V82_TOOL_MEMORY')));
   for(const m of originalMessages.filter(m=>m.role==='tool'))assert(originalMessages.some(a=>a.session_id===m.session_id&&a.tool_calls&&JSON.parse(a.tool_calls).some(c=>c.id===m.tool_call_id)),'tool result lacks exact assistant call ID');
  }finally{db.close();}
  const beforeForeign=requests.length,foreign=join(fixture,'foreign-owner'),foreignFile=join(fixture,'foreign.json');
  await exec(process.execPath,['tests/v82-session-worker-helper.mjs',foreign,'foreign',foreignFile,initialFile],{env:environment(foreign),windowsHide:true,timeout:60000,maxBuffer:100000});
  assert.equal(requests.length,beforeForeign);assert(JSON.parse(await readFile(foreignFile,'utf8')).foreignSessionRejected);
  const checked=await inspectSqliteBackup(dbFile);assert(checked.canonical&&checked.tools>=8);
  await createDataBackup({directory:data,output:backup,legacyCheck:false});const verified=await verifyDataBackup(backup);assert.equal(verified.components.hermesSessions[0].sessions,5);assert.equal(hash(rows(dbFile)),beforeHash,'backup validator changed original transcript');
  await restoreDataBackup({backup,directory:target,legacyCheck:false});
  const restoredDb=join(target,'hermes','state.db');assert.equal(hash(rows(restoredDb)),beforeHash);
  const migrated=new DatabaseSync(restoredDb,{readOnly:true});try{for(const r of migrated.prepare('SELECT cwd FROM sessions').all())assert.equal(r.cwd,join(target,'workbench'));for(const r of migrated.prepare('SELECT workdir FROM hd_session_scopes').all())assert.equal(r.workdir,join(target,'workbench'));}finally{migrated.close();}
  assert.equal(await readFile(join(data,'saves','pixel','current.json'),'utf8'),await readFile(join(target,'saves','pixel','current.json'),'utf8'));
  activeDirectory=target;await exec(process.execPath,['tests/v82-session-worker-helper.mjs',target,'resume',resumedFile,initialFile],{env:environment(target),windowsHide:true,timeout:60000,maxBuffer:100000});
  assert(!providerFailure,providerFailure?.stack);const resumed=JSON.parse(await readFile(resumedFile,'utf8')),afterRows=rows(restoredDb);assert.equal(hash(afterRows.slice(0,originalMessages.length)),beforeHash);assert.equal(resumed.session.messages,initial.manual.messages+6);
  assert(requests.some(r=>r.resumed&&r.nativeToolMemory));assert(requests.every(r=>r.model==='deepseek-flash'));
  const failedFile=join(fixture,'failed.json'),beforeFailed=requests.length;
  await exec(process.execPath,['tests/v82-session-worker-helper.mjs',target,'failure',failedFile,initialFile],{env:environment(target),windowsHide:true,timeout:60000,maxBuffer:100000});
  assert(!providerFailure,providerFailure?.stack);const failed=JSON.parse(await readFile(failedFile,'utf8'));assert(failed.failedSessionCannotResume&&failed.partialWritePreserved);assert.equal(requests.length-beforeFailed,3,'failed native session must not silently retry its tools');
  const corrupt=join(fixture,'corrupt-state.db');await copyFile(dbFile,corrupt);const bytes=await readFile(corrupt);bytes.fill(0,0,16);await writeFile(corrupt,bytes);await assert.rejects(inspectSqliteBackup(corrupt),e=>e.code==='backup_sqlite');assert.deepEqual(await readFile(corrupt),bytes);
  report.passed=true;Object.assign(report,{canonical:checked,scopeRejected:true,foreignOwnerContextRejectedBeforeProvider:true,partialWorkPreservedOnFailure:true,failedSessionCannotResume:true,originalMessages:originalMessages.length,messageHash:beforeHash,transcriptPreservedAfterMigration:true,newWorkspacePathsVerified:true,freshProcessResume:true,resumeToolsReadNewRoot:true,historyNotDuplicated:true,corruptionRejectedWithoutRepair:true,gameSavePreserved:true,requests,initial,resumed});
 }catch(e){report.passed=false;report.failure=e.stack;throw e;}
 finally{await new Promise(r=>provider.close(r));await writeFile(join(out,'native-session-report.json'),JSON.stringify(report,null,2)+'\n');}
});
