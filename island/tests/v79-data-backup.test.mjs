import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,symlink,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {createDataBackup,verifyDataBackup,restoreDataBackup,recoverDataRestore,safeRelative} from '../server/dataBackup.mjs';
import {acquireDataLease,leasePath,restoreJournalPath,exists} from '../server/dataLease.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {createRunLedger} from '../server/runLedger.mjs';
import {createWorkbenchStore} from '../server/workbenchStore.mjs';
import {fixture,meet} from './v74-travel-fixture.mjs';
const exec=promisify(execFile),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const out=resolve('qa/v79'),proofs=[];await mkdir(out,{recursive:true});
async function place(){const base=await mkdtemp(join(out,'data-'));return {base,data:join(base,'data'),backup:join(base,'backup'),target:join(base,'restored')};}
async function capture(root,file,theme='pixel',projectId=null){
 const runs=createRunLedger({directory:join(root,'runs')}),run=await runs.begin({kind:'steward_manual',theme});await runs.providerStarted(run.id);
 const provider='fixture-provider-'+randomUUID();await runs.finish(run.id,{phase:'completed',usage:{input:12,output:5,total:17},providerRunId:provider});
 const python=process.env.HD_DOCUMENT_PYTHON||resolve('.runtime/python',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 const code="import sys;sys.path.insert(0,'server');from pathlib import Path;from document_artifacts import capture_saved;import json;print(json.dumps(capture_saved(Path(sys.argv[1]),'document_write','备份恢复验收')))";
 const {stdout}=await exec(python,['-c',code,file],{windowsHide:true,env:{...process.env,HD_ARTIFACT_DIR:join(root,'artifacts'),HD_DOCUMENT_MODE:'manual',HD_DOCUMENT_THEME:theme,HD_DOCUMENT_LEDGER_ID:run.id,HD_DOCUMENT_RUN_ID:provider,HD_DOCUMENT_PROJECT_ID:projectId||'',PYTHONDONTWRITEBYTECODE:'1',PYTHONUTF8:'1'},timeout:15000});
 return {capture:JSON.parse(stdout),run,runs};
}
function workbench(root,runs){return createWorkbenchStore({directory:join(root,'artifacts'),ledger:runs,preview:async()=>({})});}
async function makeWork(f,cut){
 await f.update(s=>{s.freshStartPending=false;for(const id of ['wood','stone','ore','clay','herb','wheat','seed','fish'])s.inventory[id]=100;},0);
 await f.action(1,'travel_invite',{npcId:16});const room=await f.action(0,'room_create',{title:'恢复后的共同试作',maxPlayers:2});await f.action(1,'room_join',{code:room.view.room.code});
 const e=await meet(f);await f.service.social.cooperate(f.accounts[1].token,{eventId:e.id,operation:'propose'});
 const op=(i,operation)=>f.service.social.cooperate(f.accounts[i].token,{eventId:e.id,operation});await op(1,'accept');await op(0,'accept');
 const host=()=>f.service.tenants.get(f.accounts[0].token).then(c=>c.saves.current(f.theme)),before=await host();
 if(cut==='reserve')await assert.rejects(op(0,'start'),e=>e.code==='lan_event_settlement_pending');
 else {await op(0,'start');await assert.rejects(async()=>{for(let i=0;i<300;i++){await f.step();await f.service.social.view(f.accounts[0].token);}},e=>e.code==='lan_event_settlement_pending');}
 return {eventId:e.id,roomId:room.roomId,before};
}
for(const [theme,cut] of [['pixel','credit0'],['origami','reserve']])test(theme+' full offline restore preserves real contracts, escrow recovery, artifacts, runs and account ownership',{timeout:120000},async()=>{
 let fired=false;const f=await fixture(theme,{socialFault:(stage,{index,plan})=>{const match=cut==='reserve'?stage==='settlement-step'&&plan.steps[0].input.operation==='reserve':stage==='settlement-step'&&index===1&&plan.steps[0].input.operation==='capture';if(match&&!fired){fired=true;throw Error('Injected backup recovery cut');}}});
 let restored;try{
  const {eventId,before}=await makeWork(f,cut);assert(fired);const guest=(await f.read()).state,account=await f.service.identities.authorize(f.accounts[1].token),ownerRoot=join(f.directory,'_lan','agents',account.id);
  await mkdir(join(ownerRoot,'documents'),{recursive:true});const docfile=join(ownerRoot,'documents','成果验收.md'),text='恢复前的正式成果\n';await writeFile(docfile,text);
  const first=await capture(ownerRoot,docfile,theme),wb=workbench(ownerRoot,first.runs);const listed=await wb.list(theme);assert.equal(listed.artifacts.length,1);const documentId=listed.artifacts[0].documentId;
  const co=await f.service.tenants.get(f.accounts[0].token);await co.cocreation.current(theme);await f.service.activities.view(f.accounts[0].token);
  await f.service.close();
  const conversation=join(ownerRoot,'conversation.json');await writeFile(conversation,JSON.stringify({version:1,seeds:{},jobs:[{id:'manual-before-stop',theme,worldKey:guest.saveSlot,message:'实际执行结果尚待确认',status:'running',createdAt:new Date().toISOString(),location:'home'}]}));
  const sqlite=join(ownerRoot,'hermes','sessions.db');await mkdir(join(ownerRoot,'hermes'),{recursive:true});
  const python=process.env.HD_DOCUMENT_PYTHON||resolve('.runtime/python',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  await exec(python,['-c',"import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute('create table history(id integer primary key, message text)');c.execute('insert into history(message) values (?)',('保留原始历史',));c.commit();c.close()",sqlite],{windowsHide:true,timeout:15000});
  const backup=f.directory+'-backup',target=f.directory+'-restored';await mkdir(target);await writeFile(join(target,'original-marker.txt'),'恢复前目录保留');
  const made=await createDataBackup({directory:f.directory,output:backup,legacyCheck:false});assert.equal(made.components.settlements,1);assert(made.components.wallets>0);assert(made.components.recruitments>0);assert.equal(made.components.artifactSnapshots,1);assert.equal(made.components.runLedgers,1);assert(made.components.cocreation>0);
  const checked=await verifyDataBackup(backup);const oldHashes=checked.manifest.files;const receipt=await restoreDataBackup({backup,directory:target,legacyCheck:false});assert.equal(await readFile(join(receipt.previous,'original-marker.txt'),'utf8'),'恢复前目录保留');
  const callbacks=[];restored=await createLanHttpServer({directory:target,port:0,enrollmentKey:'RESTORE-ISOLATED',agentRuntimeFactory:()=>({documents:'fixture',async call(method){callbacks.push(method);if(method==='status')return {hermes:{configured:true}};throw Error('Restoration must not replay models or document work');},async close(){}})});
  await assert.rejects(restored.identities.authorize(f.accounts[0].token),e=>e.code==='lan_unauthorized');const login=await restored.identities.login({login:'partner_0',password:'fixture-password'}),loginGuest=await restored.identities.login({login:'partner_1',password:'fixture-password'});
  const hostContext=await restored.tenants.get(login.token),after=await hostContext.saves.current(theme),social=JSON.parse(await readFile(join(target,'_lan','social.json'),'utf8')),event=social.events.find(e=>e.id===eventId),c=event.cooperation;
  if(cut==='reserve'){assert.equal(c.status,'cancelled');assert.deepEqual(after.state.inventory,before.state.inventory);}
  else{assert.equal(c.status,'completed');const gains={};for(const p of c.parts)gains[p.item]=(gains[p.item]||0)+1;for(const id of new Set([...Object.keys(c.cost),...Object.keys(gains)]))assert.equal(after.state.inventory[id],(before.state.inventory[id]||0)-(c.cost[id]||0)+(gains[id]||0));}
  assert.deepEqual(after.state.lanEconomyControl.holds,{});assert(!await exists(join(target,'_lan','social-settlement.json')));
  const guestAfter=await restored.tenants.readIslandForServer(account.id,theme);assert.deepEqual(guestAfter.state.recruitment,guest.recruitment);assert.deepEqual(guestAfter.state.agentTaskLedger,guest.agentTaskLedger);
  const registry=JSON.parse(await readFile(join(target,'_lan','islands',account.id,theme,'recruitment.json'),'utf8'));assert.equal(registry.record.contracts.find(x=>x.id===f.contract.id).runs.at(-1).child.id,f.contract.runs.at(-1).child.id);
  const newRoot=join(target,'_lan','agents',account.id),newRuns=createRunLedger({directory:join(newRoot,'runs')}),newWb=workbench(newRoot,newRuns),download=await newWb.download(first.capture.id);assert.equal(download.bytes.toString(),text);assert.equal(download.metadata.path,join(newRoot,'documents','成果验收.md'));
  const originalLedger=JSON.parse(await readFile(join(ownerRoot,'runs','current.json'),'utf8'));assert.deepEqual((await newRuns.snapshot()).runs,originalLedger.state.runs.slice().reverse());
  await exec(python,['-c',"import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);assert c.execute('pragma quick_check').fetchone()[0]=='ok';assert c.execute('select message from history').fetchone()[0]=='保留原始历史';c.close()",join(newRoot,'hermes','sessions.db')],{windowsHide:true,timeout:15000});
  await restored.agents.view(loginGuest.token,theme);const jobs=JSON.parse(await readFile(join(newRoot,'conversation.json'),'utf8'));assert.equal(jobs.jobs[0].status,'unconfirmed');assert(!callbacks.includes('command'));assert(!callbacks.includes('recruit'));
  await writeFile(join(newRoot,'documents','成果验收.md'),'迁移后继续编辑\n');await capture(newRoot,join(newRoot,'documents','成果验收.md'),theme);const second=await newWb.list(theme);assert.equal(second.artifacts.length,1);assert.equal(second.artifacts[0].documentId,documentId);assert.equal(second.totalVersions,2);
  const version=after.version;await restored.social.view(login.token);assert.equal((await hostContext.saves.current(theme)).version,version);
  proofs.push({theme,cut,components:made.components,files:made.files,retainedOriginalDirectory:true,loginAgain:true,settlement:c.status,originalContractPreserved:true,artifactBytesAndPaths:true,continuedDocumentId:true,sqliteQuickCheck:true,manualJobUnconfirmedWithoutReplay:true,sourceManifestFiles:oldHashes.length});
 }finally{await restored?.close();await f.service.close();}
});
test('shared style runtimes block whole and child data backup until every runtime stops',async()=>{
 const p=await place();await mkdir(join(p.data,'saves'),{recursive:true});await writeFile(join(p.data,'note.txt'),'saved');
 const a=await acquireDataLease({directory:join(p.data,'saves'),mode:'runtime',sharedRuntime:true}),b=await acquireDataLease({directory:join(p.data,'saves'),mode:'runtime',sharedRuntime:true});
 try{await assert.rejects(createDataBackup({directory:p.data,output:p.backup,legacyCheck:false}),e=>e.code==='data_busy');await assert.rejects(createDataBackup({directory:join(p.data,'saves'),output:p.backup,legacyCheck:false}),e=>e.code==='data_busy');await a.release();await assert.rejects(createDataBackup({directory:p.data,output:p.backup,legacyCheck:false}),e=>e.code==='data_busy');}
 finally{await a.release();await b.release();}
 await createDataBackup({directory:p.data,output:p.backup,legacyCheck:false});assert.equal((await verifyDataBackup(p.backup)).manifest.files.length,1);
});
test('data changes during copy never publish a valid backup',async()=>{
 const p=await place();await mkdir(p.data);await writeFile(join(p.data,'one.txt'),'before');
 await assert.rejects(createDataBackup({directory:p.data,output:p.backup,legacyCheck:false,fault:async stage=>{if(stage==='copied')await writeFile(join(p.data,'one.txt'),'changed');}}),e=>e.code==='backup_changed');assert(!await exists(p.backup));assert.equal(await readFile(join(p.data,'one.txt'),'utf8'),'changed');
});
for(const cut of ['prepared','old-moved','new-installed'])test('interrupted restore at '+cut+' resumes from validated stage and retains original tree',async()=>{
 const p=await place();await mkdir(p.data);await writeFile(join(p.data,'value.txt'),'desired');await createDataBackup({directory:p.data,output:p.backup,legacyCheck:false});await mkdir(p.target);await writeFile(join(p.target,'value.txt'),'old');
 await assert.rejects(restoreDataBackup({backup:p.backup,directory:p.target,legacyCheck:false,fault:async stage=>{if(stage===cut)throw Error('cut');}}),/cut/);
 await assert.rejects(acquireDataLease({directory:p.target,mode:'runtime'}),e=>e.code==='data_restore_pending');
 const result=await recoverDataRestore({directory:p.target,legacyCheck:false});assert(result.recovered);assert.equal(await readFile(join(p.target,'value.txt'),'utf8'),'desired');assert.equal(await readFile(join(result.previous,'value.txt'),'utf8'),'old');assert(!await exists(restoreJournalPath(p.target)));
 assert.deepEqual(await recoverDataRestore({directory:p.target,legacyCheck:false}),{recovered:false});
});
test('corrupt payload, missing files, additional files and unsafe manifest paths cannot replace original data',async()=>{
 for(const variant of ['bytes','missing','extra','path']){
  const p=await place();await mkdir(p.data);await writeFile(join(p.data,'value.txt'),'desired');await createDataBackup({directory:p.data,output:p.backup,legacyCheck:false});await mkdir(p.target);await writeFile(join(p.target,'original.txt'),'retain');
  if(variant==='bytes')await writeFile(join(p.backup,'payload','value.txt'),'broken');
  else if(variant==='missing')await unlink(join(p.backup,'payload','value.txt'));
  else if(variant==='extra')await writeFile(join(p.backup,'payload','extra.txt'),'extra');
  else{const file=join(p.backup,'manifest.json'),m=JSON.parse(await readFile(file,'utf8'));m.files[0].path='../escape.txt';delete m.checksum;m.checksum=hash(m);await writeFile(file,JSON.stringify(m));}
  await assert.rejects(restoreDataBackup({backup:p.backup,directory:p.target,legacyCheck:false}));assert.equal(await readFile(join(p.target,'original.txt'),'utf8'),'retain');
 }
 for(const p of ['../a','/a','a//b','a\\b','a:stream','CON.txt','a.','a/../b'])assert.throws(()=>safeRelative(p));
});
test('links and live low-level write locks fail before snapshot publication',async()=>{
 const p=await place();await mkdir(p.data);await writeFile(join(p.data,'write.lock'),JSON.stringify({pid:process.pid,token:'active'}));await assert.rejects(createDataBackup({directory:p.data,output:p.backup,legacyCheck:false}),e=>e.code==='data_busy');await unlink(join(p.data,'write.lock'));
 const elsewhere=join(p.base,'outside');await mkdir(elsewhere);await symlink(elsewhere,join(p.data,'linked'),process.platform==='win32'?'junction':'dir');await assert.rejects(createDataBackup({directory:p.data,output:p.backup,legacyCheck:false}),e=>e.code==='data_path_link'||e.code==='backup_link');assert(!await exists(p.backup));
});
test('external document sources require an allowed root and restore into data without overwriting the external original',async()=>{
 const p=await place(),owner=join(p.data,'saves','_agent'),external=join(p.base,'outside');await mkdir(owner,{recursive:true});await mkdir(external);const file=join(external,'report.md');await writeFile(file,'external source');
 const first=await capture(owner,file),wb=workbench(owner,first.runs);await wb.list('pixel');
 await assert.rejects(createDataBackup({directory:p.data,output:p.backup,legacyCheck:false}),e=>e.code==='backup_external_root');
 await createDataBackup({directory:p.data,output:p.backup,documentRoots:[external],legacyCheck:false});await writeFile(file,'newer external original');await restoreDataBackup({backup:p.backup,directory:p.target,legacyCheck:false});
 const restoredRoot=join(p.target,'saves','_agent'),restoredWb=workbench(restoredRoot,createRunLedger({directory:join(restoredRoot,'runs')})),detail=await restoredWb.detail(first.capture.id);
 assert(detail.path.startsWith(join(p.target,'_restored_sources')));assert.equal(await readFile(detail.path,'utf8'),'external source');assert.equal(await readFile(file,'utf8'),'newer external original');assert.equal((await restoredWb.download(first.capture.id)).bytes.toString(),'external source');
});
test('a corrupt current ledger or missing referenced snapshot is rejected rather than called a complete backup',async()=>{
 const p=await place(),root=join(p.data,'saves','_agent');await mkdir(root,{recursive:true});const file=join(root,'note.md');await writeFile(file,'known');const first=await capture(root,file);await workbench(root,first.runs).list('pixel');await unlink(join(root,'artifacts','captures',first.capture.id+'.md'));
 await assert.rejects(createDataBackup({directory:p.data,output:p.backup,legacyCheck:false}),e=>e.code==='backup_artifact_missing');assert(!await exists(p.backup));
});
test.after(async()=>{await writeFile(join(out,'data-backup-report.json'),JSON.stringify({scope:'Isolated accounts and directories. Actual disk stores, original-ID wallet recovery, recruitment/travel fixture with deterministic model, Python artifact capture and SQLite verification. No user data or external model call.',proofs},null,2));});
