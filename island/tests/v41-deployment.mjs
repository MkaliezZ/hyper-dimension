import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const report={at:new Date().toISOString(),frontEndOnly:true,performedServiceRestart:false,performedUserSaveWrite:false,servers:[]};
for(const [port,theme] of [[4173,'pixel'],[4174,'origami']]){
 const base='http://127.0.0.1:'+port,response=await fetch(base+'/'),html=await response.text(),status=await (await fetch(base+'/api/status')).json();
 const modules=['workshopRules.js','workshopGames.js','workshopView.js','interiorDesign.js','potteryStudio.js'];let current=true;
 for(const module of modules){const r=await fetch(base+'/src/'+module);assert.equal(r.status,200);current&&=(await r.text())===await readFile('src/'+module,'utf8');}
 const name='public/assets/pottery-stage-'+theme+'-v41.png',asset=await fetch(base+'/'+name.replace('public/','')),served=Buffer.from(await asset.arrayBuffer());
 assert.equal(asset.status,200);assert.deepEqual(served,await readFile(name));
 const row={port,theme,http:response.status,currentFrontend:current,potteryStyle:html.includes('/src/games-v41.css'),asset:name,assetSha256:createHash('sha256').update(served).digest('hex'),
  model:status.agents.deepseek.model,hermesModel:status.agents.hermes.model,cadence:status.agents.automaticRequests};
 assert.equal(row.http,200);assert(row.currentFrontend&&row.potteryStyle);assert.equal(row.model,'deepseek-flash');assert.equal(row.hermesModel,'deepseek-flash');
 assert.equal(row.cadence.plans.intervalSeconds,300);assert.equal(row.cadence.conversations.intervalSeconds,600);assert.equal(row.cadence.steward.intervalSeconds,950);report.servers.push(row);
}report.passed=true;await writeFile('qa/v41/deployment.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
