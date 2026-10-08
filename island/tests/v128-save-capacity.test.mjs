import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore,validateState,MAX_SAVE_BYTES,MAX_IMPORT_BYTES} from '../server/saveStore.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {createState} from '../src/world.js';
import {isSaveCapacityError} from '../src/saveLimits.js';
const bytes=x=>Buffer.byteLength(JSON.stringify(x));
test('UTF-8 state capacity is bounded, exceeds the old 2 MiB, and has a distinct recoverable error',()=>{
 const s=createState();s.syntheticHistory='虚构回执'.repeat(250000);assert(bytes(s)>2*1024*1024);assert.equal(validateState(s),s);
 s.syntheticHistory='x'.repeat(MAX_SAVE_BYTES);assert.throws(()=>validateState(s),e=>e.status===413&&isSaveCapacityError(e));assert(MAX_IMPORT_BYTES>MAX_SAVE_BYTES*2);
});
for(const theme of ['pixel','origami'])test(theme+' large history survives save, restart, signed export/import; failed oversized save keeps the winner',async()=>{
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-v128-save-')),store=createSaveStore({directory});
 let d=(await store.openClient(theme)).document;const s=structuredClone(d.state);s.syntheticHistory='虚构历史'.repeat(260000);s.player.x+=4;
 d=(await store.save(theme,{state:s,expectedVersion:d.version})).document;assert(bytes(d.state)>2*1024*1024);const oldVersion=d.version;
 const reopened=await createSaveStore({directory}).current(theme);assert.equal(reopened.version,oldVersion);assert.equal(reopened.state.syntheticHistory,s.syntheticHistory);assert.deepEqual(reopened.state.inventory,s.inventory);
 const exported=await store.export(theme);assert(exported.exportProof);const preview=await store.previewImport(theme,{data:exported,expectedVersion:d.version,requestId:randomUUID()});assert(preview.preview.allowed);
 d=(await store.importClient(theme,{previewId:preview.preview.id,expectedVersion:d.version})).document;assert.equal(d.state.syntheticHistory,s.syntheticHistory);
 await assert.rejects(store.save(theme,{state:{...d.state,syntheticHistory:'x'.repeat(MAX_SAVE_BYTES)},expectedVersion:d.version}),e=>e.code==='save_too_large');assert.equal((await store.current(theme)).version,d.version);
 await assert.rejects(store.previewImport(theme,{data:{padding:'x'.repeat(MAX_IMPORT_BYTES)},expectedVersion:d.version,requestId:randomUUID()}),e=>e.code==='import_too_large');assert.equal((await store.current(theme)).version,d.version);
});
test('authenticated LAN request accepts a >2 MiB state and signed restore through the actual HTTP limits',async()=>{
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-v128-http-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-CAPACITY'}),base='http://127.0.0.1:'+service.port;
 try{const registered=await service.identities.register({login:'capacity_demo',password:'isolated-capacity-password',name:'演示岛主',islandName:'隔离容量岛',theme:'pixel',avatar:'female_0'});
 const call=async(path,data)=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Cookie:'hd_lan_session='+registered.token,'X-HD-Island':registered.view.me.id,Origin:base,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json()};};
 let r=await call('/api/saves/pixel/open',{});assert.equal(r.status,200,JSON.stringify(r.body));let d=r.body.document;const state={...d.state,syntheticHistory:'容量测试'.repeat(260000)};
 r=await call('/api/saves/pixel/save',{state,expectedVersion:d.version});assert.equal(r.status,200,JSON.stringify(r.body));d=r.body.document;assert(bytes(d.state)>2*1024*1024);
 r=await call('/api/saves/pixel/export');assert.equal(r.status,200,JSON.stringify(r.body));const exported=r.body;
 r=await call('/api/saves/pixel/import-preview',{data:exported,expectedVersion:d.version,requestId:randomUUID()});assert.equal(r.status,200,JSON.stringify(r.body));assert(r.body.preview.allowed);
 r=await call('/api/saves/pixel/import',{previewId:r.body.preview.id,expectedVersion:d.version});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.document.state.syntheticHistory,state.syntheticHistory);
 }finally{await service.close();}
});
