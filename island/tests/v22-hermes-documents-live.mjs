import assert from 'node:assert/strict';import {mkdir,writeFile,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
const dir=resolve('qa/v22/hermes-documents',randomUUID());await mkdir(dir,{recursive:true});
const file=resolve(dir,'真实管家文档验证.txt');await writeFile(file,'这是一份合成测试文档，没有私人资料。\n活动：星灯夜集\n预算：120岛币\n','utf8');
const r=await fetch('http://127.0.0.1:4174/api/hermes/command',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(245000),body:JSON.stringify({day:1,built:[],residents:[],recipes:[],events:[],executions:[],tasks:{},economy:{},inventory:{},retryModel:true,
history:[{role:'user',content:'你能修改本机文档吗？'},{role:'assistant',content:'以前我没有本机文档工具，只能规划。'}],
message:'请实际读取本机文件 '+file+'，把“预算：120岛币”改成“预算：180岛币”，保存后重新读取确认。使用真实工具完成，只处理这个合成测试文档，不要派发岛内任务。'})});
const data=await r.json();const content=await readFile(file,'utf8');
const result={http:r.status,source:data.source,model:data.model,answer:data.answer,commands:data.commands?.length||0,tools:data.tools,operations:data.operations,file,content,verified:content.includes('预算：180岛币')&&!content.includes('预算：120岛币'),error:data.providerError};
await writeFile('qa/v22/hermes-live-documents.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
assert.equal(result.source,'hermes');assert.equal(result.model,'deepseek-flash');assert.equal(result.verified,true);assert.equal(result.commands,0);
assert.ok(result.operations.some(op=>op.tool==='document_edit'&&op.status==='done'));

