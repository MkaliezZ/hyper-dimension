import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createNativeWorkJournal} from './nativeWorkJournal.mjs';
import {sampleOwnedBrowserStall} from './nativeBrowserResources.mjs';

test('macOS stall sampling targets at most two owned renderers and one owned GPU without a shell',async()=>{
 const calls=[],session={send:async method=>{
  assert.equal(method,'SystemInfo.getProcessInfo');
  return{processInfo:[{id:41,type:'renderer',cpuTime:12},{id:42,type:'renderer',cpuTime:1},{id:43,type:'renderer',cpuTime:7},{id:44,type:'GPU',cpuTime:20},{id:45,type:'browser',cpuTime:30}]};
 }};
 const result=await sampleOwnedBrowserStall(session,{directory:tmpdir(),platform:'darwin',run:async(file,args,options)=>{calls.push({file,args,options});return{stdout:''};}});
 assert.deepEqual(result.processes.map(p=>p.id),[41,43,44]);assert(result.diagnosticIntervention);
 for(const call of calls){assert.equal(call.file,'/usr/bin/sample');assert.equal(call.options.shell,undefined);assert.equal(call.options.timeout,5000);assert.deepEqual(call.args.slice(1,4),['1','10','-file']);}
 assert(result.processes.every(p=>p.sampled));
 await assert.rejects(sampleOwnedBrowserStall({send:async()=>({processInfo:[{id:'1;unsafe',type:'renderer'}]})},{directory:tmpdir(),platform:'darwin',run:async()=>assert.fail('Invalid IDs must not reach the OS')}),/Invalid owned-browser PID/);
 const unsupported=await sampleOwnedBrowserStall({send:async()=>assert.fail('No process read on unsupported platform')},{platform:'win32'});assert(unsupported.unsupportedPlatform);
});

test('owned-page request diagnostics exclude save contents and unrelated endpoints, and retain a bounded tail',async()=>{
 const before=process.env.HD_QA_WORK_JOURNAL;process.env.HD_QA_WORK_JOURNAL='1';
 const out=await mkdtemp(join(tmpdir(),'hd-owned-observation-')),report={cases:[]},row={};
 const page=new EventEmitter();page.context=()=>({browser:()=>null});page.isClosed=()=>true;
 const journal=createNativeWorkJournal(out,report,{deadlineMs:60000});
 try{
  journal.observe(page,row);
  const request=(url,method='POST')=>({url:()=>url,method:()=>method,postDataJSON:()=>({kind:'personal',operation:'use',requestId:'fictional-equip',state:{privateMemo:'DO_NOT_RECORD'},headers:{Authorization:'DO_NOT_RECORD'},apiKey:'DO_NOT_RECORD'}),failure:()=>({errorText:'fixture aborted'})});
  for(const url of ['http://127.0.0.1/api/npc/chat','http://127.0.0.1/assets/item.png'])page.emit('request',request(url));
  page.emit('request',request('http://127.0.0.1/api/saves/pixel','GET'));
  assert.equal(row.nativeSaveRequests,undefined);
  const own=request('http://127.0.0.1/api/saves/pixel/action');page.emit('request',own);
  page.emit('response',{request:()=>own,status:()=>200});page.emit('requestfinished',own);
  assert.equal(row.nativeSaveRequests.length,1);
  assert.deepEqual(Object.keys(row.nativeSaveRequests[0]).sort(),['at','path','kind','operation','requestId','startedMs','status','responseMs','finishedMs'].sort());
  assert.equal(row.nativeSaveRequests[0].status,200);
  assert(!JSON.stringify(report).includes('DO_NOT_RECORD'));assert(!JSON.stringify(row).includes('DO_NOT_RECORD'));
  for(let i=0;i<140;i++)page.emit('request',request('http://127.0.0.1/api/saves/pixel/save'));
  assert.equal(row.nativeSaveRequests.length,120);
  const last=request('http://127.0.0.1/api/saves/pixel/action');page.emit('request',last);page.emit('requestfailed',last);
  assert.equal(row.nativeSaveRequests.length,120);assert.equal(row.nativeSaveRequests.at(-1).failure,'fixture aborted');
 }finally{
  await journal.beforeCleanup();await journal.finish();
  if(before===undefined)delete process.env.HD_QA_WORK_JOURNAL;else process.env.HD_QA_WORK_JOURNAL=before;
  assert(out.startsWith(join(tmpdir(),'hd-owned-observation-')),'Cleanup stays in this test-created temporary directory');
  await rm(out,{recursive:true,force:true});
 }
});

test('a stalled owned-process lookup is bounded before any OS sampling command',async()=>{
 await assert.rejects(sampleOwnedBrowserStall({send:()=>new Promise(()=>{})},{directory:tmpdir(),platform:'darwin',run:async()=>assert.fail('No OS process may be sampled without an acknowledged owned PID')}),/process lookup timed out/);
});

test('steward timing observations exclude prompts and secrets and retain only twelve request receipts',async()=>{
 const before=process.env.HD_QA_WORK_JOURNAL;process.env.HD_QA_WORK_JOURNAL='1';
 const out=await mkdtemp(join(tmpdir(),'hd-steward-observation-')),report={cases:[]},row={};
 const page=new EventEmitter();page.context=()=>({browser:()=>null});page.isClosed=()=>true;
 const journal=createNativeWorkJournal(out,report,{deadlineMs:60000});
 try{
  journal.observe(page,row);
  const request=i=>({url:()=> 'http://127.0.0.1/api/hermes/command',method:()=> 'POST',postDataJSON:()=>({requestId:'fictional-'+i,message:'PRIVATE_PROMPT',history:['PRIVATE_HISTORY'],apiKey:'PRIVATE_KEY',workspace:'PRIVATE_PATH'}),failure:()=>({errorText:'fixture aborted'})});
  for(let i=0;i<14;i++)page.emit('request',request(i));
  assert.equal(row.nativeSaveRequests,undefined);assert.equal(row.nativeStewardRequests.length,12);assert.equal(row.nativeStewardRequests[0].requestId,'fictional-2');
  const last=request(14);page.emit('request',last);page.emit('response',{request:()=>last,status:()=>200});page.emit('requestfinished',last);
  assert.equal(row.nativeStewardRequests.length,12);assert.equal(row.nativeStewardRequests.at(-1).status,200);assert(Number.isFinite(row.nativeStewardRequests.at(-1).finishedMs));
  const encoded=JSON.stringify(row);for(const secret of ['PRIVATE_PROMPT','PRIVATE_HISTORY','PRIVATE_KEY','PRIVATE_PATH'])assert(!encoded.includes(secret));
  assert.deepEqual(Object.keys(row.nativeStewardRequests.at(-1)).sort(),['at','path','kind','operation','requestId','startedMs','status','responseMs','finishedMs'].sort());
 }finally{
  await journal.beforeCleanup();await journal.finish();if(before===undefined)delete process.env.HD_QA_WORK_JOURNAL;else process.env.HD_QA_WORK_JOURNAL=before;
  assert(out.startsWith(join(tmpdir(),'hd-steward-observation-')));await rm(out,{recursive:true,force:true});
 }
});
