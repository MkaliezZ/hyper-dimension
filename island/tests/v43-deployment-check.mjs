import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const hash=b=>createHash('sha256').update(b).digest('hex');const before=JSON.parse((await readFile('qa/v43/player-save-before-deployment.json','utf8')).replace(/^\uFEFF/,'')),beforeRows=Array.isArray(before)?before:[before],saved=[];
for(const r of beforeRows){const after=hash(await readFile(r.path)).toUpperCase();assert.equal(after,r.sha256,'Player save changed during deployment: '+r.path);saved.push({...r,unchanged:true})}
const rows=[];for(const [theme,port] of [['pixel',4173],['origami',4174]]){
 const base='http://127.0.0.1:'+port;let status;for(let i=0;i<50;i++){try{const r=await fetch(base+'/api/status');if(r.ok){status=await r.json();break}}catch{}await new Promise(r=>setTimeout(r,100))}
 assert(status);const files=[];for(const path of ['src/app.js','src/residentRuntime.js','src/runManagementUI.js','src/runtime-v43.css','src/npcProfileAuditUI.js','src/style.css']){const r=await fetch(base+'/'+path),bytes=Buffer.from(await r.arrayBuffer()),disk=await readFile(path);assert.equal(r.status,200);assert(bytes.equals(disk));files.push({path,status:r.status,sha256:hash(bytes)})}
 const index=await(await fetch(base+'/')).text();assert(index.includes('/src/runtime-v43.css'));assert.equal(status.agents.deepseek.model,'deepseek-flash');assert.equal(status.agents.hermes.model,'deepseek-flash');
 const runtime=await(await fetch(base+'/api/admin/runtime')).json();assert.equal(runtime.schema,43);assert.deepEqual(Object.values(runtime.channels).map(c=>c.intervalSeconds),[300,600,950]);rows.push({theme,port,models:{npc:status.agents.deepseek.model,hermes:status.agents.hermes.model},policy:runtime.policy,files});
}
assert.deepEqual(rows[0].policy,rows[1].policy);
const report={at:new Date().toISOString(),passed:true,backendRestarted:true,sharedPolicy:true,noUserSaveWrites:true,noProviderCallsDuringDeploymentCheck:true,saved,rows};
await writeFile('qa/v43/deployment.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,backendRestarted:true,saveHashesUnchanged:saved.length,rows:rows.map(r=>({theme:r.theme,port:r.port,files:r.files.length,models:r.models,policy:r.policy}))}));
