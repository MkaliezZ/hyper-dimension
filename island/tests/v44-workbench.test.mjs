import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';import {join,resolve,basename,extname} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {createWorkbenchStore} from '../server/workbenchStore.mjs';import {createRunLedger} from '../server/runLedger.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture(){
 await mkdir('qa/v44',{recursive:true});const directory=await mkdtemp(resolve('qa/v44/store-'));let time=Date.parse('2026-10-05T09:00:00+08:00');
 const ledger=createRunLedger({directory:join(directory,'runs'),now:()=>time}),root=join(directory,'artifacts');
 const preview=async path=>({content:await readFile(path,'utf8')});const store=createWorkbenchStore({directory:root,ledger,preview,now:()=>time});
 async function capture(content,{path=join(directory,'原文档.md'),theme='pixel',projectId=null,phase='completed',kind='steward_manual',automatic=false,provider=true}={}){
  const r=await ledger.begin({kind,automatic,theme});if(provider)await ledger.providerStarted(r.id);
  const id='capture-'+randomUUID().replaceAll('-',''),bytes=Buffer.from(content),manifest={schema:44,id,sourcePath:path,name:basename(path),format:extname(path).slice(1),bytes:bytes.length,sha256:hash(bytes),capturedAt:new Date(time++).toISOString(),tool:'document_write',changes:content.length,theme,ledgerRunId:r.id,providerRunId:'provider-'+r.id,projectId,mode:'manual'};
  await mkdir(join(root,'captures'),{recursive:true});await writeFile(join(root,'captures',id+'.'+manifest.format),bytes);await writeFile(join(root,'captures',id+'.json'),JSON.stringify(manifest));await writeFile(path,bytes);
  await ledger.finish(r.id,{phase,providerRunId:manifest.providerRunId});return {id,runId:r.id,manifest,path};
 }
 return {directory,root,ledger,store,capture,other:()=>createWorkbenchStore({directory:root,ledger,preview}),create:async(name='测试项目',theme='pixel')=>store.project(theme,{action:'create',requestId:randomUUID(),name,goal:'生成并核验实际文件',notes:'待处理'})};
}
test('work projects survive restart; notes history stays out of model context; CAS and idempotence',async()=>{
 const f=await fixture(),first=await f.create(),p=first.projects[0],input={action:'update',id:p.id,expectedVersion:1,name:p.name,goal:'目标已细化',notes:'继续第二阶段',requestId:'once'};
 let s=await f.store.project('pixel',input);assert.equal(s.projects[0].version,2);assert.equal(s.projects[0].history[0].notes,'待处理');
 s=await f.other().project('pixel',input);assert.equal(s.projects[0].version,2);assert.equal(s.projects[0].history.length,1);
 await assert.rejects(f.other().project('pixel',{...input,requestId:'stale'}),e=>e.code==='project_conflict');
 await assert.rejects(f.store.project('pixel',{...input,notes:'changed'}),e=>e.code==='project_conflict');
 const c=await f.other().context('pixel');assert.equal(c.notes,'继续第二阶段');assert(!('history' in c));assert.equal(await f.store.context('origami'),null);
});
test('immutable original downloads and previews preserve each version even after source edit',async()=>{
 const f=await fixture(),a=await f.capture('版本一'),b=await f.capture('版本二',{path:a.path});await writeFile(a.path,'外部应用版本');
 let s=await f.other().list('pixel');assert.equal(s.totalVersions,2);assert.equal(s.artifacts[0].version,2);assert.equal((await f.store.preview(a.id)).preview.content,'版本一');
 assert.equal((await f.store.download(b.id)).bytes.toString(),'版本二');assert.deepEqual((await f.store.detail(a.id)).versions.map(v=>v.version),[2,1]);
 const c=await f.capture('版本一',{path:a.path});s=await f.store.list('pixel');assert.equal(s.totalVersions,3);assert.equal(s.artifacts[0].version,3);assert.equal((await f.store.detail(c.id)).sha256,a.manifest.sha256);
});
test('same content does not duplicate versions and can belong to two projects with separate current pointers',async()=>{
 const f=await fixture(),a=(await f.create('项目A')).projects[0],one=await f.capture('相同内容',{projectId:a.id});await f.store.list('pixel');
 const b=(await f.create('项目B','origami')).projects.at(-1),two=await f.capture('相同内容',{path:one.path,theme:'origami',projectId:b.id});
 const result=await f.store.syncOperations([{status:'done',tool:'document_write',artifact:{id:two.id}}],{runId:two.runId});assert.equal(result.artifacts.length,1);assert.equal(result.artifacts[0].id,one.id);
 assert.equal((await f.store.list('origami')).projectArtifacts.length,1);assert.equal((await f.store.list('pixel')).projectArtifacts.length,1);assert.equal((await f.store.list('pixel')).totalVersions,1);
 const third=await f.capture('B修改',{path:one.path,theme:'origami',projectId:b.id});await f.store.list('origami');
 assert.equal((await f.store.context('pixel')).files[0].artifactId,one.id);assert.equal((await f.store.context('origami')).files[0].artifactId,third.id);
});
test('saved files recover after timeout and records only link to their actual manual run',async()=>{
 const f=await fixture(),a=await f.capture('已保存，随后请求超时',{phase:'timed_out'}),s=await f.other().list('pixel');assert.equal(s.artifacts[0].recovered,true);
 assert.equal((await f.store.syncOperations([{status:'done',tool:'document_write',artifact:{id:a.id}}],{runId:'another-run'})).artifacts.length,0);
 assert.equal((await f.store.syncOperations([{status:'done',tool:'document_write',artifact:{id:a.id}}],{runId:a.runId})).artifacts.length,1);
 assert.equal((await f.store.syncOperations([{status:'unconfirmed',tool:'document_write',artifact:{id:a.id}}],{runId:a.runId})).artifacts.length,0);
});
test('automatic or unstarted model records cannot attest a document result',async()=>{
 const f=await fixture();await f.capture('自动伪造',{kind:'steward',automatic:true});await f.capture('未启动伪造',{provider:false});const s=await f.store.list('pixel');assert.equal(s.artifacts.length,0);assert.equal(s.warnings.length,2);
 await assert.rejects(f.store.detail('capture-'+randomUUID().replaceAll('-','')),e=>e.code==='artifact_missing');
});
test('snapshot tampering stops preview and download; index corruption preserves original bytes',async()=>{
 const f=await fixture(),a=await f.capture('不可篡改');await f.store.list('pixel');await writeFile(join(f.root,'captures',a.id+'.md'),'tampered');
 await assert.rejects(f.store.preview(a.id),e=>e.code==='artifact_corrupt');await assert.rejects(f.store.download(a.id),e=>e.code==='artifact_corrupt');
 await writeFile(join(f.root,'current.json'),'{broken');await assert.rejects(f.store.list('pixel'),e=>e.code==='workbench_corrupt');assert.equal(await readFile(join(f.root,'current.json'),'utf8'),'{broken');assert.equal(await readFile(a.path,'utf8'),'不可篡改');
});
test('long-term context caps file pointers at six and notes history at thirty-two',async()=>{
 const f=await fixture(),first=await f.create(),p=first.projects[0];for(let i=0;i<8;i++)await f.capture('文件'+i,{projectId:p.id,path:join(f.directory,'文件'+i+'.txt')});await f.store.list('pixel');
 for(let i=0;i<35;i++){const s=await f.store.list('pixel'),v=s.projects[0];await f.store.project('pixel',{action:'update',id:p.id,expectedVersion:v.version,requestId:'edit-'+i,name:p.name,goal:'阶段'+i,notes:'纪要'+i})}
 const c=await f.other().context('pixel');assert.equal(c.files.length,6);assert(!('history' in c));assert.equal((await f.store.list('pixel')).projects[0].history.length,32);
});
test('two processes stores serialize project creation and keep per-theme choices',async()=>{
 const f=await fixture();await Promise.all([f.store.project('pixel',{action:'create',requestId:'pixel-create',name:'像素项目'}),f.other().project('origami',{action:'create',requestId:'origami-create',name:'折纸项目'})]);
 assert.equal((await f.store.list('pixel')).projects.length,2);assert.equal((await f.store.context('pixel')).name,'像素项目');assert.equal((await f.store.context('origami')).name,'折纸项目');
});
test('archive retains notes, files and versions; invalid changes do not create projects',async()=>{
 const f=await fixture(),s=await f.create(),p=s.projects[0],a=await f.capture('归档成果',{projectId:p.id});await f.store.list('pixel');
 await f.store.project('pixel',{action:'archive',id:p.id,expectedVersion:1,requestId:'archive'});assert.equal(await f.store.context('pixel'),null);assert.equal((await f.store.download(a.id)).bytes.toString(),'归档成果');
 const q=(await f.store.list('pixel')).projects[0];await f.store.project('pixel',{action:'reopen',id:q.id,expectedVersion:q.version,requestId:'reopen'});assert.equal(await f.store.context('pixel'),null);
 const v=(await f.store.list('pixel')).projects[0];await f.store.project('pixel',{action:'select',id:v.id,expectedVersion:v.version,requestId:'select'});assert.equal((await f.store.context('pixel')).name,p.name);
 await assert.rejects(f.store.project('pixel',{action:'create',requestId:'invalid',name:'',notes:'x'.repeat(4001)}),e=>e.code==='project_invalid');assert.equal((await f.store.list('pixel')).projects.length,1);
});
