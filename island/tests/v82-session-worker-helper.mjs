import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createSaveStore} from '../server/saveStore.mjs';
const directory=resolve(process.argv[2]),phase=process.argv[3],output=process.argv[4],previous=process.argv[5];
const saves=createSaveStore({directory:join(directory,'saves')});
const doc=['initial','foreign'].includes(phase)?await saves.open('pixel',{clientId:'v82-session-fixture'}):await saves.current('pixel');
const state=doc.state||doc.document?.state;
assert(state);const slot=state.saveSlot||"legacy-pixel";
await mkdir(join(directory,'workbench'),{recursive:true});
if(phase==='initial')await writeFile(join(directory,'workbench','input.md'),'V82_TOOL_MEMORY: 海风计划甲，下一步核对灯笼与田地。\n');
const {steward,recruitmentRun,collaborate,stopAgentWorkers}=await import('../server/agentService.mjs');
const base={theme:'pixel',saveSlot:slot,residents:[],built:[],recipes:[],inventory:{},history:[],retryModel:true};
let result;
try {
 if(phase==='foreign'){
  const initial=JSON.parse(await readFile(previous,'utf8'));
  await assert.rejects(steward({...base,message:'V82_FOREIGN: 无权读取其他账号的上下文',resumeSessionId:initial.manual.id}),e=>e.code==='hermes_resume_unavailable');
  result={foreignSessionRejected:true};
 }else if(phase==='failure'){
  const initial=JSON.parse(await readFile(previous,'utf8'));
  const failed=await steward({...base,message:'V82_PARTIAL_FAILURE: 写入独立测试文件后模拟服务中断',resumeSessionId:initial.manual.id});
  assert.notEqual(failed.source,'hermes');assert(failed.operations.some(o=>o.tool==='document_write'&&o.status==='done'));
  const partial=await readFile(join(directory,'workbench','partial.md'),'utf8');assert.equal(partial,'V82_PARTIAL_WORK: 请先核对这份实际成果。');
  const db=new DatabaseSync(join(directory,'hermes','state.db'),{readOnly:true});let phase;
  try{phase=db.prepare('SELECT phase FROM hd_session_runs WHERE session_id=? ORDER BY rowid DESC LIMIT 1').get(initial.manual.id)?.phase;}finally{db.close();}
  assert.equal(phase,'failed');
  await assert.rejects(steward({...base,message:'V82_RETRY_FAILED',resumeSessionId:initial.manual.id}),e=>e.code==='hermes_resume_unavailable');
  assert.equal(await readFile(join(directory,'workbench','partial.md'),'utf8'),partial);
  result={failedNativePhase:phase,partialWritePreserved:true,failedSessionCannotResume:true};
 }else if(phase==='initial'){
  const manual=await steward({...base,message:'V82_INITIAL: 读取测试文档，记住海风计划。'});
  assert.equal(manual.source,'hermes');assert(manual.session?.canResume);assert(manual.operations.some(o=>o.tool==='document_read'&&o.status==='done'));
  const recruit=await recruitmentRun({project:{id:'fixture',title:'会话迁移验证'},candidate:{name:'小麦'},steps:[{id:'fixture:wood',quantity:2}]},'pixel:fixture:1');
  assert.equal(recruit.child.parentId,recruit.parent.id);
  const a2a=await collaborate({theme:'pixel',stage:'offer',taskId:'session-fixture-a2a',actor:{name:'管家甲'},peer:{name:'管家乙'}});
  assert(a2a.session?.persisted);assert(!a2a.session.canResume);
  const automatic=await steward({...base,automatic:true,resumeSessionId:manual.session.id,message:'V82_AUTOMATIC: 仅巡查小岛。'});
  assert.equal(automatic.source,'hermes');assert.equal(automatic.session.mode,'island');
  await assert.rejects(steward({...base,theme:'origami',resumeSessionId:manual.session.id,message:'V82_BAD_SCOPE'}),e=>e.code==='hermes_resume_unavailable');
  result={manual:manual.session,parent:recruit.parent.id,child:recruit.child.id,a2a:a2a.session,automatic:automatic.session,scopeRejected:true,slot};
 } else {
  const initial=JSON.parse(await readFile(previous,'utf8'));
  const resumed=await steward({...base,message:'V82_RESUME: 继续此前的工作，并读取迁移后当前位置的文档。',resumeSessionId:initial.manual.id});
  assert.equal(resumed.source,'hermes');assert.equal(resumed.session.id,initial.manual.id);assert(resumed.session.messages>initial.manual.messages);
  assert(resumed.operations.some(o=>o.tool==='document_read'&&o.status==='done'&&o.path===join(directory,'workbench','input.md')));
  result={session:resumed.session,operations:resumed.operations.map(o=>({tool:o.tool,status:o.status,path:o.path})),resumedWithoutClientHistory:true};
 }
} finally {await stopAgentWorkers();}
await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({phase,passed:true}));
