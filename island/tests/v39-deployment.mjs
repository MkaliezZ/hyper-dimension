import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const report={at:new Date().toISOString(),frontEndOnly:true,performedServiceRestart:false,performedUserSaveWrite:false,servers:[]};
for(const [port,theme] of [[4173,'pixel'],[4174,'origami']]){
 const base='http://127.0.0.1:'+port,response=await fetch(base+'/'),html=await response.text(),status=await (await fetch(base+'/api/status')).json();
 const rules=await (await fetch(base+'/src/workshopRules.js')).text(),ui=await (await fetch(base+'/src/workshopGames.js')).text(),art=await (await fetch(base+'/src/workshopView.js')).text();
 const row={port,theme,http:response.status,currentFrontend:rules===await readFile('src/workshopRules.js','utf8')&&ui===await readFile('src/workshopGames.js','utf8')&&art===await readFile('src/workshopView.js','utf8'),
  coutureStyle:html.includes('/src/games-v39.css'),model:status.agents.deepseek.model,hermesModel:status.agents.hermes.model,cadence:status.agents.automaticRequests};
 assert.equal(row.http,200);assert(row.currentFrontend);assert(row.coutureStyle);assert.equal(row.model,'deepseek-flash');assert.equal(row.hermesModel,'deepseek-flash');
 assert.equal(row.cadence.plans.intervalSeconds,300);assert.equal(row.cadence.conversations.intervalSeconds,600);assert.equal(row.cadence.steward.intervalSeconds,950);
 report.servers.push(row);
}report.passed=true;await writeFile('qa/v39/deployment.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
