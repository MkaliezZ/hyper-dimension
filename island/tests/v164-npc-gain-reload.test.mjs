import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';import {resolve} from 'node:path';
import {createSaveStore} from '../server/saveStore.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';
import {personalSnapshot} from '../server/personalActions.mjs';import {RAW_MATERIALS,resourceLoot} from '../src/contentCatalog.js';
await mkdir('qa/v164',{recursive:true});
for(const theme of ['pixel','origami'])for(const scenario of ['mine','farm','greenhouse','forest'])test(`${theme} first NPC ${scenario} gain survives hydration and protected disk reload without re-awarding`,async()=>{
 let clock=1000000;const directory=await mkdtemp(resolve('qa/v164/gain-')),store=createSaveStore({directory,now:()=>clock});const s=hydrateTown(createZeroState());s.freshStartPending=false;
 if(scenario==='mine')s.oreNodes[0].hp=1;if(scenario==='farm')Object.assign(s.plots[1],{stage:4,growth:180,crop:'wheat'});
 const d=(await store.open(theme,{legacyState:s,protect:true})).document;
 const input=scenario==='mine'?{kind:'field',field:'mine',actor:'npc',actorId:11,index:0,itemId:'ore'}:scenario==='farm'?{kind:'farm',actor:'npc',actorId:0,index:1,step:'harvest',crop:'wheat'}:{kind:'resident',actorId:scenario==='greenhouse'?4:5,intent:scenario==='greenhouse'?{goal:'greenhouse',buildingId:14,action:'work',activity:'herbs',resource:'herb'}:{goal:'forest',buildingId:null,action:'work',resource:'wood'}};
 const r=await store.action(theme,{...input,operation:'begin',requestId:crypto.randomUUID(),gameTime:100,expectedVersion:d.version,expectedSequence:d.actions.sequence,epoch:d.actions.epoch});clock+=Math.ceil(r.ticket.duration*1000);
 const command={kind:input.kind,operation:'finish',requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence,expectedVersion:r.document.version};const done=await store.action(theme,command);
 const expected=({mine:{stone:1,ore:2},farm:{wheat:2,seed:1},greenhouse:{herb:1,seed:1},forest:{wood:2}})[scenario];assert.deepEqual(done.receipt.gain,expected);
 for(const [id,n]of Object.entries(expected)){assert.equal(done.document.state.inventory[id],n);assert.equal(done.document.state.discovered[id],true);assert.equal(done.document.state.economy.playerGoods[id]||0,0);}
 const client=hydrateTown(structuredClone(done.document.state));assert.deepEqual(personalSnapshot(client),done.document.actions.personal.snapshot,'hydration must preserve the acknowledged personal snapshot');
 const saved=(await store.save(theme,{state:client,expectedVersion:done.document.version,activeSeconds:0,saveId:crypto.randomUUID()})).document;assert.deepEqual(saved.state.inventory,done.document.state.inventory);
 const other=createSaveStore({directory,now:()=>clock}),replayed=await other.action(theme,command);assert(replayed.replayed);assert.deepEqual(replayed.document.state.inventory,saved.state.inventory);assert.deepEqual(replayed.document.state.resourceLedger.events,saved.state.resourceLedger.events);
 const events=saved.state.resourceLedger.events.filter(e=>['resident_mine','farm_harvest','nursery_bonus','resource_gather'].includes(e.category));for(const [id,n]of Object.entries(expected))assert.equal(events.reduce((sum,e)=>sum+(e.delta[id]||0),0),n,'each gained item has one ledger contribution');
});
test('all raw-material gains use one journal event and invalid gains leave stock and counters unchanged',()=>{
 for(const item of RAW_MATERIALS){const s=hydrateTown(createZeroState());const events=s.resourceLedger?.events?.length||0;assert.deepEqual(resourceLoot(item.source,s,1,item.id),[{id:item.id,amount:1}]);assert.equal(s.inventory[item.id],1);assert.equal(s.discovered[item.id],true);assert.equal(s.resourceLedger.events.length,events+1);const before=structuredClone(s);assert.deepEqual(resourceLoot(item.source,s,-1,item.id),[]);assert.deepEqual(s,before);}
});
