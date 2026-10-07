import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve} from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex'),restart=JSON.parse((await readFile('qa/v44/restart.json','utf8')).replace(/^\uFEFF/,'')),files=['src/workbenchUI.js','src/workbench-v44.css','src/stewardChat.js','src/residentRuntime.js','src/app.js'],report={at:new Date().toISOString(),scope:'Read-only checks on existing local deployments, no manual document or model request.',deployments:[],saves:[]};
for(const port of [4173,4174]){
 const base='http://127.0.0.1:'+port,status=await(await fetch(base+'/api/status')).json();assert.equal(status.agents.deepseek.model,'deepseek-flash');assert.equal(status.agents.hermes.model,'deepseek-flash');
 const runtime=await(await fetch(base+'/api/admin/runtime')).json();for(const [name,seconds] of [['plans',300],['conversations',600],['steward',950]])assert.equal(runtime.channels[name].intervalSeconds,seconds);
 const content=await(await fetch(base+'/')).text();assert(content.includes('/src/workbench-v44.css'));const modules=[];
 for(const file of files){const r=await fetch(base+'/'+file);assert(r.ok);assert.equal(await r.text(),await readFile(file,'utf8'));modules.push(file)}
 const work=await(await fetch(base+'/api/workbench/'+status.theme)).json();assert.equal(work.schema,44);const after=await(await fetch(base+'/api/admin/runtime')).json();assert.deepEqual(after.today,runtime.today);
 report.deployments.push({port,theme:status.theme,modules,workbench:true,existingPolicy:runtime.policy,modelCallsTriggered:false});
}
for(const s of restart.before){const after=sha(await readFile(s.path));assert.equal(after,s.sha256.toLowerCase());report.saves.push({path:s.path,sha256:after,unchanged:true})}
report.passed=true;await writeFile('qa/v44/deployment.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
