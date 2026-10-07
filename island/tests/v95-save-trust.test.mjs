import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';import {serverZeroState} from '../server/saveBootstrap.mjs';import {validActionBook} from '../server/playerActions.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';import {createDataBackup,verifyDataBackup,restoreDataBackup} from '../server/dataBackup.mjs';
const out=resolve('qa/v95/rules');await mkdir(out,{recursive:true});const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function fixture(){const directory=await mkdtemp(join(out,'store-'));let clock=Date.now();return{directory,store:createSaveStore({directory,now:()=>clock}),advance:n=>clock+=n};}
const mature=theme=>{const s=serverZeroState(theme);s.day=8;s.coins=500;s.inventory.wood=20;s.playerProfile.name='旧岛主';return s;};
const preview=(store,theme,d,data,extra={})=>store.previewImport(theme,{data,expectedVersion:d.version,clientId:'trust-fixture',requestId:randomUUID(),...extra});
const confirm=(store,theme,p)=>store.importClient(theme,{previewId:p.id,expectedVersion:p.expectedVersion,clientId:p.clientId});
for(const theme of ['pixel','origami']){
 test(theme+' public first open creates zero authority, retains legacy bytes and only allows identity fields',async()=>{
  const {store}=await fixture(),legacy=mature(theme);legacy.playerProfile.name='雨';legacy.playerProfile.research=900;legacy.npcAffinity[0]=99;
  const r=await store.openClient(theme,{legacyState:legacy,clientId:'first'}),d=r.document;
  assert(r.initialCreated&&!r.migrated);assert.equal(d.state.day,1);assert.equal(d.state.coins,0);assert.equal(d.state.playerProfile.name,'雨');assert.equal(d.state.playerProfile.research,0);assert(Object.values(d.state.inventory).every(n=>n===0));assert.deepEqual(d.state.npcAffinity,{});assert(validActionBook(d.actions));assert.equal(d.state.personalControl.version,1);assert.equal(d.provenance.origin,'server-new');
  for(const key of ['farm','field','resident','visitor','commerce','facility','party','hire','fishing','festival','couture','fireworks','planning','personal'])assert(d.actions[key],key);
  assert.deepEqual(await store.migrationExport(theme),legacy);assert.equal(r.migration.summary.goods,20);assert.equal((await store.current(theme)).version,d.version);
  await assert.rejects(store.save(theme,{state:{...d.state,coins:999},expectedVersion:d.version}),e=>e.status===409);assert.equal((await store.current(theme)).state.coins,0);
 });
 test(theme+' migration requires preview, explicit confirm, fresh epoch and idempotent replay',async()=>{
  const {directory,store}=await fixture(),legacy=mature(theme),r=await store.openClient(theme,{legacyState:legacy});
  await assert.rejects(store.importClient(theme,{data:mature(theme),expectedVersion:r.document.version}),e=>e.code==='import_preview_required');
  const {preview:p}=await preview(store,theme,r.document,null,{migrationId:r.migration.id});assert.equal(p.summary.day,8);assert(p.allowed);assert.equal((await store.current(theme)).state.day,1);
  const d=(await confirm(store,theme,p)).document;assert.equal(d.state.coins,500);assert.equal(d.actions.epoch===r.document.actions.epoch,false);assert.equal(d.provenance.origin,'legacy-browser');assert(!((await store.openClient(theme)).migration));
  assert.deepEqual(await store.migrationExport(theme),legacy);
  const next={...d.state,player:{...d.state.player,x:d.state.player.x+1}};const saved=(await store.save(theme,{state:next,expectedVersion:d.version,clientId:'after-import'})).document;
  const replay=await confirm(createSaveStore({directory}),theme,p);assert(replay.replayed);assert.equal(replay.document.version,saved.version);assert.equal(replay.document.state.player.x,next.player.x);
  assert((await store.backups(theme)).some(b=>b.reason==='before-import'));assert.equal((await store.export(theme)).exportProof.version,1);
 });
 test(theme+' signed content tampering, altered metadata and preview binding never overwrite current state',async()=>{
  const {store}=await fixture(),d=(await store.openClient(theme)).document,exported=await store.export(theme),bad=structuredClone(exported);bad.state.coins=999;bad.checksum=hash(bad.state);
  await assert.rejects(preview(store,theme,d,bad),e=>e.code==='import_signature');
  const forged=structuredClone(exported);forged.provenance.origin='fake';forged.metadataChecksum=hash([forged.provenance,forged.importReceipts||[]]);await assert.rejects(preview(store,theme,d,forged),e=>e.code==='import_signature');
  const {preview:p}=await preview(store,theme,d,exported);
  await assert.rejects(store.importClient(theme,{previewId:p.id,expectedVersion:p.expectedVersion,clientId:'other'}),e=>e.code==='import_preview_conflict');
  assert.equal((await store.current(theme)).version,d.version);
 });
 test(theme+' two confirmations serialize to one commit; stale candidate and expiry reject',async()=>{
  const {directory,store,advance}=await fixture(),d=(await store.openClient(theme)).document,{preview:p}=await preview(store,theme,d,mature(theme));
  const results=await Promise.all([confirm(store,theme,p),confirm(createSaveStore({directory}),theme,p)]);assert.equal(results.filter(r=>r.replayed).length,1);
  const fresh=await store.current(theme),{preview:expired}=await preview(store,theme,fresh,mature(theme));advance(15*60*1000+1);await assert.rejects(confirm(store,theme,expired),e=>e.code==='import_preview_expired');
  const {preview:stale}=await preview(store,theme,fresh,mature(theme));await store.save(theme,{state:fresh.state,expectedVersion:fresh.version});await assert.rejects(confirm(store,theme,stale),e=>e.code==='save_conflict');
 });
 test(theme+' protected restart and local restore keep all authority enabled',async()=>{
  const {store}=await fixture(),d=(await store.openClient(theme)).document,b=await store.backup(theme,{expectedVersion:d.version}),restarted=(await store.restartClient(theme,{requestId:randomUUID(),expectedVersion:d.version,protect:false})).document;
  assert.equal(restarted.state.day,1);assert(validActionBook(restarted.actions));assert.equal(restarted.state.personalControl.version,1);
  const restored=(await store.restoreClient(theme,{id:b.id,expectedVersion:restarted.version,protect:false})).document;assert(validActionBook(restored.actions));assert(restored.actions.personal);assert.equal(restored.provenance.origin,'local-checkpoint');
 });
}
test('offline full backup preserves private signing key, preview and original legacy source; restored export still verifies',async()=>{
 const f=await fixture(),legacy=mature('pixel'),r=await f.store.openClient('pixel',{legacyState:legacy}),signed=await f.store.export('pixel'),{preview:p}=await preview(f.store,'pixel',r.document,signed),backup=f.directory+'-backup',target=f.directory+'-restored';
 const made=await createDataBackup({directory:f.directory,output:backup,legacyCheck:false});assert(made.files>=4);await verifyDataBackup(backup);await restoreDataBackup({backup,directory:target,legacyCheck:false});
 const restored=createSaveStore({directory:target}),d=await restored.current('pixel'),{preview:q}=await preview(restored,'pixel',d,signed);assert.equal(q.origin.signature,'local');assert.deepEqual(await restored.migrationExport('pixel'),legacy);
 for(const name of ['save-export-key.json','pixel/imports/'+p.id+'.json','pixel/imports/browser-migration.json'])assert.equal(await readFile(join(target,name),'utf8'),await readFile(join(f.directory,name),'utf8'));
 const file=join(f.directory,'pixel/imports',p.id+'.json'),broken=JSON.parse(await readFile(file,'utf8'));broken.data.state.coins=800;await writeFile(file,JSON.stringify(broken));await assert.rejects(confirm(f.store,'pixel',p),e=>e.code==='import_record_corrupt');
});
test('LAN HTTP canonical initialization ignores browser progress; own signed export allowed, raw and other-account export denied',async()=>{
 const directory=await mkdtemp(join(out,'lan-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-TRUST'}),base='http://127.0.0.1:'+service.port;
 try{const a=await service.identities.register({login:'trust_a',password:'isolated-trust-pass',theme:'pixel',avatar:'male_0',name:'甲岛主',islandName:'甲岛'}),b=await service.identities.register({login:'trust_b',password:'isolated-trust-pass',theme:'pixel',avatar:'male_0',name:'乙岛主',islandName:'乙岛'});
 const call=async(user,path,body)=>{const r=await fetch(base+'/api/saves/pixel'+path,{method:body?'POST':'GET',headers:{Cookie:'hd_lan_session='+user.token,'X-HD-Island':user.view.me.id,Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};};
 const da=(await call(a,'/open',{legacyState:mature('pixel')})).data.document,db=(await call(b,'/open',{legacyState:da.state})).data.document;assert.equal(da.state.coins,0);assert.equal(db.state.coins,0);assert(da.actions.personal&&db.actions.personal);assert.equal(db.state.playerProfile.name,'乙岛主');
 const exported=(await call(a,'/export')).data,prepare=data=>({data,expectedVersion:db.version,clientId:'lan-trust',requestId:randomUUID()});
 const foreign=(await call(b,'/import-preview',prepare(exported))).data.preview;assert.equal(foreign.allowed,false);assert.equal(foreign.origin.signature,'foreign');
 const raw=(await call(b,'/import-preview',prepare(mature('pixel')))).data.preview;assert.equal(raw.allowed,false);
 const signedB=(await call(b,'/export')).data,own=(await call(b,'/import-preview',prepare(signedB))).data.preview;assert.equal(own.allowed,true);assert.equal(own.origin.signature,'local');
 const denied=await call(b,'/import',{previewId:foreign.id,expectedVersion:foreign.expectedVersion,clientId:foreign.clientId});assert.equal(denied.status,409);assert.equal(denied.data.code,'import_not_allowed');
 const result=await call(b,'/import',{previewId:own.id,expectedVersion:own.expectedVersion,clientId:own.clientId});assert.equal(result.status,200);assert.equal(result.data.document.state.coins,0);
 }finally{await service.close();}
});

test('crash after current commit repairs import completion using durable receipt without replacing newer progress',async()=>{
 const directory=await mkdtemp(join(out,'cut-'));let cut=true;const store=createSaveStore({directory,importFault:async stage=>{if(stage==='committed'&&cut){cut=false;throw Object.assign(Error('Injected crash after commit'),{status:503,code:'injected_cut'});}}}),legacy=mature('pixel'),r=await store.openClient('pixel',{legacyState:legacy}),{preview:p}=await preview(store,'pixel',r.document,null,{migrationId:r.migration.id});
 await assert.rejects(confirm(store,'pixel',p),e=>e.code==='injected_cut');const committed=await store.current('pixel');assert.equal(committed.state.coins,500);assert.equal(committed.importReceipts.length,1);
 const retry=await confirm(createSaveStore({directory}),'pixel',p);assert(retry.replayed);assert.equal(retry.document.version,committed.version);assert.equal((await createSaveStore({directory}).openClient('pixel')).migration,null);
 const disk=JSON.parse(await readFile(join(directory,'pixel/imports',p.id+'.json'),'utf8'));assert.equal(disk.completed,true);
});
