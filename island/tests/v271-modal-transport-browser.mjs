import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Exercise the original native modal test against real committed actions. Only
// this isolated child server loses its HTTP reply; no receipt/result is forged.
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=resolve(process.env.HD_QA_OUT||'qa/v271/modal-transport');
await mkdir(out,{recursive:true});
const runDirectory=await mkdtemp(join(out,'isolated-'));
const report={scope:'Fictional protected saves, actual native item use and canonical receipt. Declared loss after successful commit. Original modal/view/refresh assertions and budgets retained. No models, live user data or human acceptance.',cases:[],passed:false};
try{
 for(const [name,retries,losses,expected] of [['no-retry-control',0,1,1],['one-loss-replayed',1,1,0],['two-losses-still-fail',1,2,1]]){
  const directory=join(runDirectory,name),proof=join(runDirectory,name+'-transport.jsonl');
  const env={...process.env,HD_QA_ROOT:root,HD_QA_OUT:directory,HD_QA_THEMES:'origami',HD_QA_COMMANDS:'itemUse',HD_QA_MODAL_FETCH_RETRIES:String(retries),HD_QA_MODAL_LOSS_COUNT:String(losses),HD_QA_MODAL_LOSS_PROOF:proof,
   NODE_OPTIONS:'--import='+pathToFileURL(join(root,'tests/modalReplyLossFixture.mjs')).href};
  const child=spawn(process.execPath,[join(root,'tests/v157-modal-command-navigation-browser.mjs')],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const exit=await new Promise((ok,bad)=>{child.once('error',bad);child.once('close',(code,signal)=>ok({code,signal}));});
  await writeFile(join(out,name+'-stdout.log'),stdout);await writeFile(join(out,name+'-stderr.log'),stderr);
  const actual=JSON.parse(await readFile(join(directory,'report.json'),'utf8'));
  const events=(await readFile(proof,'utf8')).trim().split('\n').map(s=>JSON.parse(s));
  const row={name,...exit,expectedExit:expected,attempts:events.length,requestIds:[...new Set(events.map(e=>e.requestId))],originalPassed:!!actual.passed};report.cases.push(row);
  assert.equal(exit.code,expected);assert.equal(exit.signal,null);assert.equal(events.length,retries+1);assert.equal(row.requestIds.length,1);
  assert.equal(events[0].replayed,false);assert.equal(events[0].replyLost,true);
  if(retries){assert.equal(events[1].replayed,true);assert.deepEqual(events[1].receipt,events[0].receipt);assert.equal(events[1].replyLost,losses===2);}
  if(expected===0){assert(actual.passed);assert.equal(actual.cases[0].confirmedReceiptCount,1);assert(actual.cases[0].uniqueReceiptAfterRefresh);assert.deepEqual(actual.cases[0].routeErrors,[]);}
  else{assert(!actual.passed);assert.equal(actual.cases[0].persistedReceiptCountOnFailure,1);assert.equal(actual.cases[0].routeErrors.length,1);assert.equal(actual.cases[0].stage,'await-real-response');}
  row.passed=true;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
