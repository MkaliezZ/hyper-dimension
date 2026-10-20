// Controlled original resident-chain diagnostic. No model, game-budget or state override.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';

const hash=value=>createHash('sha256').update(value).digest('hex');
export function observedResidentSource(source,helperURL){
 const replace=(before,after)=>{assert.equal(source.split(before).length,2,'Original resident observation hook changed');source=source.replace(before,after);};
 assert(source.includes("createWorkTimeBudget(120000,'First job')"));assert(source.includes("createWorkTimeBudget(240000,'Remaining chain')"));
 replace('const clockFile=join(directory,',"const backendObservation=await observeOwnedServer(service,out);\nconst clockFile=join(directory,");
 replace('const workJournal=createNativeWorkJournal(out,report,{deadlineMs:1980000});','const workJournal=createNativeWorkJournal(out,report,{deadlineMs:1980000});report.readOnlyBackendObservation=true;report.controlledDiagnosticOnly=true;');
 replace('finally{await workJournal.beforeCleanup();','finally{await backendObservation.finish();await workJournal.beforeCleanup();');
 return 'import {observeOwnedServer} from '+JSON.stringify(helperURL)+';\n'+source;
}

async function main(args){
 assert(args.length<=1&&(!args.length||['--check-hooks','--prepare-only'].includes(args[0])),'Use --check-hooks, --prepare-only, or no argument');
 const root=resolve(process.env.HD_RELEASE_ROOT||'island'),sourcePath=join(root,'tests/v213-task-chain-browser.mjs'),source=await readFile(sourcePath,'utf8'),helperURL=new URL('./resident-server-timing.mjs',import.meta.url).href;
 const observed=observedResidentSource(source,helperURL),syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:observed,encoding:'utf8'});assert.equal(syntax.status,0,syntax.stderr);
 if(args[0]==='--check-hooks'){console.log(JSON.stringify({originalHooksParsed:true,firstWorkBudgetMs:120000,remainingWorkBudgetMs:240000,modelsCalled:false,browserStarted:false}));return;}
 const out=resolve(process.env.HD_QA_OUT||join(root,'qa/resident-backend-diagnostics'));let existing=false;try{await access(out);existing=true;}catch{}assert(!existing,'Preserve existing diagnostic output; choose a new HD_QA_OUT');await mkdir(out,{recursive:true});
 const verify=await import(pathToFileURL(join(root,'tools/releaseCommon.mjs'))),before=await verify.verifyPayload(root);assert(before.verified);
 const fixture=join(root,'tests','.resident-backend-'+randomUUID()+'.mjs');await writeFile(fixture,observed,{flag:'wx'});await writeFile(join(out,'observed-fixture.mjs'),observed,{flag:'wx'});
 const row={schema:1,startedAt:new Date().toISOString(),root,sourceFixtureSHA256:hash(source),observedFixtureSHA256:hash(observed),helperSHA256:hash(await readFile(fileURLToPath(helperURL))),sourceRelease:before.release,sourcePayloads:before.files,originalFirstWorkBudgetMs:120000,originalSharedRemainingWorkBudgetMs:240000,originalCalendarAndClockBudgetsUnchanged:true,controlledDiagnosticOnly:true,modelsEnabled:false,wholeGoalComplete:false};
 const save=()=>writeFile(join(out,'run.json'),JSON.stringify(row,null,2));await save();
 if(args[0]==='--prepare-only'){row.preparedOnly=true;row.browserStarted=false;await save();return;}
 try{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('HD_')&&key!=='DEEPSEEK_API_KEY'));Object.assign(env,{DEEPSEEK_API_KEY:'',HD_QA_OUT:out,HD_QA_WORK_JOURNAL:'1',PYTHONDONTWRITEBYTECODE:'1'});
  const child=spawn(process.execPath,[fixture],{cwd:root,env,windowsHide:true,stdio:'inherit'});row.childPid=child.pid;await save();
  const code=await new Promise((accept,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{row.signal=signal;accept(code===null?1:code);});});row.originalFixtureExitCode=code;
  const after=await verify.verifyPayload(root);assert(after.verified);assert.equal(hash(await readFile(sourcePath)),row.sourceFixtureSHA256);row.payloadsUnchanged=after.files===before.files&&after.release===before.release;
  let observations;for(const name of ['backend-observation.json','backend-progress.json'])try{observations=JSON.parse(await readFile(join(out,name),'utf8'));row.backendEvidenceFile=name;break;}catch{}
  row.observationErrors=observations?.errors||[];row.cpuSegments=observations?.profiles?.length||0;row.httpRequests=observations?.http?.length||0;row.observationsRetained=!!observations;
  row.diagnosticComplete=code===0&&row.payloadsUnchanged&&row.observationsRetained&&row.cpuSegments>0&&!row.observationErrors.length;process.exitCode=code||(!row.diagnosticComplete?1:0);
 }catch(error){row.failure={name:error.name,code:error.code||null,message:error.message};process.exitCode=1;}
 finally{row.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({originalFixtureExitCode:row.originalFixtureExitCode,diagnosticComplete:row.diagnosticComplete,cpuSegments:row.cpuSegments,payloadsUnchanged:row.payloadsUnchanged,wholeGoalComplete:false}));}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
