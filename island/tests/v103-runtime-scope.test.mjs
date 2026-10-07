import test from 'node:test';import assert from 'node:assert/strict';import{realpath,mkdtemp,mkdir,writeFile,readFile,readdir,unlink}from'node:fs/promises';import{join,win32,resolve}from'node:path';import{tmpdir}from'node:os';import{spawn}from'node:child_process';import{windowsLegacyProcesses,acquireDataLease,registeredRuntimePids,assertNoLegacyRuntime}from'../server/dataLease.mjs';import{createDataBackup,verifyDataBackup}from'../server/dataBackup.mjs';
const project='C:\\Development Workspace\\Hyper Dimension',a=Buffer.from('save source'),b=Buffer.from('world source');
const list=items=>async(exe,args,options)=>{assert.equal(exe,'powershell.exe');assert(args.includes('-NonInteractive'));assert(options.windowsHide);return{stdout:JSON.stringify(items)};};
const row=(pid,script,ports=[])=>({pid,script,ports});
test('Windows backup scope recognizes exact quoted entry files, case and separator variants, while nested checkouts and prefix neighbors remain independent',async()=>{
 const direct=['server.mjs','server/lanServer.mjs','server/lanAgentWorker.mjs'].map((p,i)=>row(998901+i,'"'+win32.join(project,p).toUpperCase()+'"'));
 const unrelated=[row(998910,win32.join(project,'qa/frozen/server.mjs')),row(998911,win32.join(project,'qa/frozen/server/lanAgentWorker.mjs')),row(998912,win32.join(project+' other','server.mjs')),row(998913,win32.join(project,'src/server.mjs'))];
 assert.deepEqual(await windowsLegacyProcesses(project,{execute:list([...direct,...unrelated]),loadSources:()=>{throw Error('Absolute files do not need ambiguous HTTP checks');}}),[998901,998902,998903]);
});
test('relative legacy server must expose both exact game modules; unrelated port and partial matches do not identify its deployment',async()=>{
 const ids=await windowsLegacyProcesses(project,{execute:list([row(998920,'server.mjs',[18001]),row(998921,'server.mjs',[18002]),row(998922,'server.mjs',[18003])]),loadSources:async()=>[a,b],request:async url=>{const u=new URL(url);return new Response(u.port==='18001'?u.pathname.endsWith('saveClient.js')?a:b:u.port==='18002'?u.pathname.endsWith('saveClient.js')?a:'foreign world':'foreign');}});
 assert.deepEqual(ids,[998920]);
});
test('relative legacy worker remains conservatively blocking when its working directory cannot be identified',async()=>{
 assert.deepEqual(await windowsLegacyProcesses(project,{execute:list([row(998930,'server/lanAgentWorker.mjs')]),loadSources:()=>{throw Error('Worker has no HTTP identity');}}),[998930]);
});
test('vanished relative services and invalid ports cannot identify a writer or trigger off-host requests',async()=>{
 let calls=0;const ids=await windowsLegacyProcesses(project,{execute:list([row(998940,'server.mjs',[-1,0,65536,'18000',18001])]),loadSources:async()=>[a,b],request:async url=>{assert.equal(new URL(url).hostname,'127.0.0.1');calls++;throw Object.assign(Error('Gone'),{code:'ECONNREFUSED'});}});
 assert.deepEqual(ids,[]);assert.equal(calls,1);
});
test('self inspection is ignored and duplicate CIM entries do not produce duplicate writers',async()=>{
 const file=win32.join(project,'server.mjs');assert.deepEqual(await windowsLegacyProcesses(project,{execute:list([row(process.pid,file),row(998950,file),row(998950,file)])}),[998950]);
});
test('failure to enumerate actual Windows processes blocks maintenance rather than pretending no writers exist',async()=>{
 await assert.rejects(windowsLegacyProcesses(project,{execute:async()=>{throw Object.assign(Error('Access denied'),{code:'EACCES'});}}),e=>e.code==='EACCES');
});
test('data-directory lease still prevents backup when a different checkout uses that data',async()=>{
 const root=await mkdtemp(join(await realpath(tmpdir()),'hd-shared-data-')),directory=join(root,'data');await mkdir(directory);await writeFile(join(directory,'value.txt'),'retained');const owner=await acquireDataLease({directory,mode:'runtime',sharedRuntime:true});
 try{await assert.rejects(createDataBackup({directory,output:join(root,'backup')}),e=>e.code==='data_busy');assert.equal(await readFile(join(directory,'value.txt'),'utf8'),'retained');}finally{await owner.release();}
});
async function fixture(){const root=await mkdtemp(join(await realpath(tmpdir()),'hd Windows scope '));await mkdir(join(root,'src'));await writeFile(join(root,'src/saveClient.js'),a);await writeFile(join(root,'src/world.js'),b);return root;}
async function launch(root,{relative=false}={}){
 const file=join(root,'server.mjs'),code="import fs from 'node:fs';import http from 'node:http';import path from 'node:path';const s=http.createServer((q,r)=>{try{r.end(fs.readFileSync(path.join(process.cwd(),q.url)));}catch{r.statusCode=404;r.end();}});s.listen(0,'127.0.0.1',()=>process.stdout.write(JSON.stringify({port:s.address().port})+'\\n'));process.on('SIGTERM',()=>s.close(()=>process.exit(0)));";
 await writeFile(file,code);const child=spawn(process.execPath,[relative?'server.mjs':file],{cwd:root,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});let text='';const info=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture server did not start')),10000);child.stdout.on('data',b=>{text+=b;try{const value=JSON.parse(text.trim());clearTimeout(timer);resolve(value);}catch{}});child.once('error',e=>{clearTimeout(timer);reject(e)});child.once('exit',code=>{clearTimeout(timer);reject(Error('Fixture exited '+code))});});
 return{child,...info,async close(){if(child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill();await end;}}};
}
test('actual Windows CIM identifies a live direct old writer with spaces in its absolute path',{skip:process.platform!=='win32'},async()=>{
 const root=await fixture(),s=await launch(root);try{assert((await windowsLegacyProcesses(root)).includes(s.child.pid));}finally{await s.close();}
});
test('actual nested Windows QA writer does not block parent deployment backup and backup still verifies bytes',{skip:process.platform!=='win32'},async()=>{
 const root=await fixture(),nested=join(root,'qa','isolated');await mkdir(nested,{recursive:true});const s=await launch(nested);try{
 assert(!(await windowsLegacyProcesses(root)).includes(s.child.pid));assert((await windowsLegacyProcesses(nested)).includes(s.child.pid));
 const directory=join(root,'data');await mkdir(directory);await writeFile(join(directory,'value.txt'),'actual quiet data');
 await createDataBackup({directory,output:join(root,'backup')});const result=await verifyDataBackup(join(root,'backup'));assert.equal(result.manifest.files.length,1);assert.equal(result.inventory.files.length,1);assert.equal(result.manifest.files[0].path,"value.txt");assert.equal(await readFile(join(root,'backup','payload','value.txt'),'utf8'),'actual quiet data');
 }finally{await s.close();}
});
test('actual relative Windows legacy command is identified through both served files',{skip:process.platform!=='win32'},async()=>{
 const root=await fixture(),s=await launch(root,{relative:true});try{assert((await windowsLegacyProcesses(root)).includes(s.child.pid));}finally{await s.close();}
});

async function modernServer(){const projectRoot=resolve(import.meta.dirname,'..'),dir=await mkdtemp(join(await realpath(tmpdir()),'hd modern runtime '));await mkdir(join(dir,'busy'));await writeFile(join(dir,'busy/value.txt'),'isolated live directory');const {createServer}=await import('node:net');const portServer=createServer();await new Promise(r=>portServer.listen(0,'127.0.0.1',r));const port=portServer.address().port;await new Promise(r=>portServer.close(r));const child=spawn(process.execPath,[join(projectRoot,'server.mjs'),'--port='+port],{cwd:projectRoot,windowsHide:true,shell:false,env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:join(dir,'busy'),HD_RUN_LEDGER_DIR:join(dir,'runs'),HD_HERMES_HOME:join(dir,'hermes'),HD_STEWARD_WORKDIR:join(dir,'docs')},stdio:['ignore','ignore','pipe']});let ready=false;try{for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:'+port+'/api/status')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready);return{child,dir,projectRoot,async close(){if(child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill();await end;}}};}catch(e){child.kill();throw e;}}
test('actual modern server with independent leased data allows unrelated backup but rejects backing up its live data',{skip:process.platform!=='win32'},async()=>{const s=await modernServer();try{assert((await registeredRuntimePids(s.projectRoot)).has(s.child.pid));await assertNoLegacyRuntime();const quiet=join(s.dir,'quiet');await mkdir(quiet);await writeFile(join(quiet,'value.txt'),'quiet while another island runs');await createDataBackup({directory:quiet,output:join(s.dir,'quiet-backup')});assert.equal((await verifyDataBackup(join(s.dir,'quiet-backup'))).manifest.files.length,1);await assert.rejects(createDataBackup({directory:join(s.dir,'busy'),output:join(s.dir,'busy-backup')}),e=>e.code==='data_busy');}finally{await s.close();}});
test('missing live lease never lets a registry entry hide an unprotected writer',{skip:process.platform!=='win32'},async()=>{const s=await modernServer();let leaseFile,bytes;try{for(const f of await readdir(join(s.projectRoot,'.runtime/data-lease-registry'))){if(!f.endsWith('.json'))continue;const row=JSON.parse(await readFile(join(s.projectRoot,'.runtime/data-lease-registry',f),'utf8'));if(row.pid===s.child.pid){leaseFile=row.leaseFile;break;}}assert(leaseFile);bytes=await readFile(leaseFile);await unlink(leaseFile);assert(!(await registeredRuntimePids(s.projectRoot)).has(s.child.pid));await assert.rejects(assertNoLegacyRuntime(),e=>e.code==='data_busy');await writeFile(leaseFile,bytes);bytes=null;assert((await registeredRuntimePids(s.projectRoot)).has(s.child.pid));}finally{if(bytes)await writeFile(leaseFile,bytes);await s.close();}});
test('corrupted live registry to lease binding blocks maintenance and preserves the original lock',{skip:process.platform!=='win32'},async()=>{const s=await modernServer();let registryFile,bytes;try{for(const f of await readdir(join(s.projectRoot,'.runtime/data-lease-registry'))){if(!f.endsWith('.json'))continue;const file=join(s.projectRoot,'.runtime/data-lease-registry',f),value=await readFile(file),row=JSON.parse(value);if(row.pid===s.child.pid){registryFile=file;bytes=value;row.leaseFile=join(s.dir,'foreign-lease.json');await writeFile(file,JSON.stringify(row));break;}}assert(registryFile);await assert.rejects(assertNoLegacyRuntime(),e=>e.code==='data_process_unverified');await writeFile(registryFile,bytes);bytes=null;assert((await registeredRuntimePids(s.projectRoot)).has(s.child.pid));}finally{if(bytes)await writeFile(registryFile,bytes);await s.close();}});
