import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {NPC_CADENCE} from '../src/npcCadence.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=['src/app.js','src/serverCraftUI.js','src/craftGameReplay.js','src/workshopGames.js','src/classicGames.js','src/gameLevels.js','src/serverGatherUI.js','src/saveClient.js','src/actionMerge.js','src/projectPlans.js','src/taskBoard.js','src/gather-v46.css'];
const rows=JSON.parse((await readFile('qa/v47/restart.json','utf8')).replace(/^\uFEFF/,''));
const report={at:new Date().toISOString(),scope:'Read-only deployment files/status and restart save hashes; no save/action POST or model request.',services:[],cadence:NPC_CADENCE};
try{
 assert.equal(NPC_CADENCE.planSeconds,300);assert.equal(NPC_CADENCE.conversationSeconds,600);assert.equal(NPC_CADENCE.stewardSeconds,950);
 for(const r of rows){
  const base='http://127.0.0.1:'+r.port,status=await(await fetch(base+'/api/status')).json();
  assert.equal(status.theme,r.theme);assert.equal(status.agents.deepseek.model,'deepseek-flash');assert.equal(status.agents.hermes.model,'deepseek-flash');
  assert.deepEqual(status.saveProtocol,{gather:1,craft:1,craftInputReplay:true,craftCheckpointSeconds:5});
  const results=[];
  for(const file of files){const response=await fetch(base+'/'+file);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),hash(await readFile(file)));results.push({file,sha256:hash(bytes)});}
  assert((await(await fetch(base+'/')).text()).includes('/src/gather-v46.css'));
  const after=await(await fetch(base+'/api/status')).json();
  assert.equal(after.agents.deepseek.calls,status.agents.deepseek.calls);assert.equal(after.agents.hermes.calls,status.agents.hermes.calls);
  assert(r.unchanged);assert.equal(r.beforeHash,r.afterHash);assert.equal(hash(await readFile(r.backup)).toUpperCase(),r.beforeHash);
  report.services.push({theme:r.theme,port:r.port,pid:r.pid,files:results,saveUnchangedAtRestart:r.unchanged,saveProtocol:status.saveProtocol,model:'deepseek-flash'});
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
await writeFile('qa/v47/deployment.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,services:report.services.map(x=>({theme:x.theme,port:x.port,pid:x.pid,saveUnchanged:x.saveUnchangedAtRestart,saveProtocol:x.saveProtocol})),failure:report.failure}));
