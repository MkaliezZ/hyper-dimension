import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {personalSnapshot,syncPersonalState} from '../server/personalActions.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');await mkdir('qa/v165',{recursive:true});
for(const theme of ['pixel','origami'])test(`${theme}: canonical discovery repair retains inventory, clocks, identities and live work; creates one backup only`,async()=>{
 let now=1000000;const directory=await mkdtemp(resolve('qa/v165/discovery-')),store=createSaveStore({directory,now:()=>now});const s=hydrateTown(createZeroState());s.freshStartPending=false;s.inventory.ore=2;s.inventory.stone=1;s.inventory.unknown_future_item=1;s.discovered.wood=true;
 let d=(await store.open(theme,{legacyState:s,protect:true})).document;
 const resident=await store.action(theme,{kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',action:'work',resource:'wood'},requestId:crypto.randomUUID(),expectedVersion:d.version,expectedSequence:d.actions.sequence,epoch:d.actions.epoch});d=resident.document;
 const player=await store.action(theme,{kind:'farm',operation:'begin',actor:'player',index:0,step:'hoe',requestId:crypto.randomUUID(),expectedVersion:d.version,expectedSequence:d.actions.sequence,epoch:d.actions.epoch});d=player.document;
 // Reproduce an old, internally valid canonical save created before V164.
 delete d.state.discovered.ore;d.state.discovered.stone=false;syncPersonalState(d.state,d.actions);d.checksum=hash(d.state);d.actionsChecksum=hash(d.actions);await writeFile(join(directory,theme,'current.json'),JSON.stringify(d));
 assert.deepEqual((await store.current(theme)).state,d.state);assert.notDeepEqual(personalSnapshot(hydrateTown(structuredClone(d.state))),d.actions.personal.snapshot);
 const forged=structuredClone(d.state);forged.inventory.wood=999;forged.coins=999999;forged.discovered.fish=true;
 const repaired=(await store.openClient(theme,{legacyState:forged})).document;
 assert.equal(repaired.reason,'discovery-repair');assert.equal(repaired.revision,d.revision+1);assert.deepEqual(repaired.state,{...d.state,discovered:{...d.state.discovered,ore:true,stone:true}});
 const expectedActions=structuredClone(d.actions);syncPersonalState(repaired.state,expectedActions);assert.deepEqual(repaired.actions,expectedActions);assert.deepEqual(personalSnapshot(hydrateTown(structuredClone(repaired.state))),repaired.actions.personal.snapshot);
 assert.equal(repaired.state.discovered.unknown_future_item,undefined);assert.equal(repaired.state.discovered.fish,undefined);assert.equal(repaired.state.discovered.wood,true);
 const files=await readdir(join(directory,theme,'history'));const backups=await Promise.all(files.map(f=>readFile(join(directory,theme,'history',f),'utf8').then(JSON.parse)));const backup=backups.filter(x=>x.reason==='before-discovery-repair');assert.equal(backup.length,1);assert.deepEqual(backup[0].state,d.state);assert.deepEqual(backup[0].actions,d.actions);
 assert.equal((await store.openClient(theme,{legacyState:forged})).document.version,repaired.version);assert.deepEqual(await readdir(join(directory,theme,'history')),files);
 const tampered=structuredClone(repaired.state);tampered.inventory.wood=999;await assert.rejects(store.save(theme,{state:tampered,expectedVersion:repaired.version,saveId:crypto.randomUUID(),activeSeconds:0}),e=>['personal_state_conflict','resource_state_conflict'].includes(e.code));
 now+=Math.ceil(player.ticket.duration*1000);const finished=await store.action(theme,{kind:'farm',operation:'finish',requestId:player.ticket.requestId,epoch:player.ticket.epoch,sequence:player.ticket.sequence,expectedVersion:repaired.version});assert.equal(finished.receipt.outcome,'finished');assert.deepEqual(finished.document.actions.resident.leases,resident.document.actions.resident.leases);
 const reopened=createSaveStore({directory,now:()=>now});assert.equal((await reopened.openClient(theme)).document.version,finished.document.version);
});
