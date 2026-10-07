import assert from 'node:assert/strict';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
await mkdir('qa/v43',{recursive:true});const directory=await mkdtemp(resolve('qa/v43/live-usage-'));
Object.assign(process.env,{HD_SAVE_DIR:directory,HD_MODEL_ENDPOINT:'https://api.deepseek.com'});
const report={at:new Date().toISOString(),directory,scope:'One real Flash plan for an isolated island fixture; authorized game data only, no user save, document or conversation body retained.'};
try{
 const {decideBatch}=await import('../server/agentService.mjs'),{runLedger}=await import('../server/runLedger.mjs');
 const result=await decideBatch({theme:'pixel',day:1,built:[],inventory:{},recipes:[],residents:[{id:0,name:'木工',job:'木工',personality:'细心',needs:{energy:95,hunger:90,social:80},options:[{purposeId:'live-wood',goal:'forest',action:'work',resource:'wood',reason:'采集木材准备下一次手作',score:80}]}]});
 const record=(await runLedger.snapshot()).runs.find(r=>r.id===result.ledgerRunId);assert.equal(result.model,'deepseek-flash');assert.equal(result.decisions.length,1);assert.equal(record.phase,'completed');assert(record.usage.total>0);assert.equal(record.usage.calls,1);
 report.passed=true;report.model=result.model;report.runId=record.id;report.phase=record.phase;report.usage=record.usage;report.provider='api.deepseek.com';console.log(JSON.stringify({passed:true,model:report.model,usage:report.usage}));
}catch(e){report.passed=false;report.failure=String(e.message).slice(0,180);process.exitCode=1;console.log(JSON.stringify({passed:false,error:report.failure}))}
finally{await writeFile('qa/v43/live-usage-report.json',JSON.stringify(report,null,2));process.exit(process.exitCode||0)}
