import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {ALL_RECIPES} from '../src/contentCatalog.js';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {followPath} from '../src/movement.js';
import {HARBOR,setWorldTheme} from '../src/world.js';

// Domain fixture with declared stock and server clock control, never native,
// zero-start or human acceptance. Transfer poses cannot create sale proceeds.
async function fixture(theme,returning=false,early=false){
 let clock=100000,view;const calls=[],errors=[];
 const store=createSaveStore({directory:await mkdtemp(join(tmpdir(),'hd-v272-transfer-')),now:()=>clock});
 const seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.coins=100;
 for(const recipe of ALL_RECIPES)seed.inventory[recipe.item]=4;
 await store.open(theme,{legacyState:seed,protect:true});
 const current=()=>store.current(theme);
 const send=async(operation,args={})=>{
  const result=await store.action(theme,{kind:'visitor',operation,requestId:randomUUID(),expectedVersion:(await current()).version,...args});
  view=result.document.state;return result;
 };
 // Match saves.action: one island journal dispatches commands in order and
 // reads each expected version after the previous response is accepted.
 let commandTail=Promise.resolve();
 const command=(...args)=>{const run=()=>send(...args),result=commandTail.then(run,run);commandTail=result.catch(()=>{});return result;};
 await command('enable',{theme});
 for(const seconds of [15,5]){clock+=seconds*1000;const doc=await current();await store.save(theme,{state:structuredClone(doc.state),expectedVersion:doc.version,activeSeconds:seconds,saveId:randomUUID()});}
 const arrival=await command('arrive'),guest=arrival.receipt.accepted[0];assert(guest);
 const saved=()=>current().then(d=>d.actions.visitor.guests[guest.id]);
 if(!early)clock=(await saved()).landReadyAt;
 if(returning){
  await command('land',{guestId:guest.id});
  for(let stop=0;stop<guest.itinerary.length;stop++){
   const state=await saved(),begin=await command('begin',{guestId:guest.id,stop,buildingId:state.itinerary[stop]}),ticket=begin.ticket;
   clock=ticket.readyAt;await command('finish',{requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence});
  }
  await command('review',{guestId:guest.id,queue:0});clock=(await saved()).boardReadyAt;
 }
 const before=await current();view=before.state;
 const remote={ready:()=>true,settling:()=>true,ensure(){},recover(){throw Error('Unexpected transfer recovery');},
  async command(operation,args){calls.push({operation,guestId:args.guestId});try{return await command(operation,args);}catch(e){errors.push(e.code);throw e;}},
  finish(){throw Error('A pending transfer cannot sell goods');},cancel(){throw Error('Unexpected service cancellation');}};
 const runtime=createVisitorRuntime({getState:()=>view,followPath,remote,onEvent(){},onChange(){}});
 if(returning)runtime.boats.push({id:42,phase:'moored',t:0,...HARBOR.berth,pending:false,inbound:[],outbound:[guest.id],activePassenger:null});
 runtime.update(0,0,0);
 return{runtime,current,before,calls,errors,id:guest.id,idle:()=>commandTail};
}
const drain=()=>new Promise(resolve=>setImmediate(resolve));
for(const theme of ['pixel','origami'])for(const returning of [false,true])test(theme+' '+(returning?'boarding':'landing')+' reaches canonical confirmation during unrelated pending receipts',async()=>{
 setWorldTheme(theme);const f=await fixture(theme,returning);
 try{
  for(let i=0;i<220;i++){f.runtime.animatePending(.1,.1);await drain();}
  const ownCalls=()=>f.calls.filter(c=>c.guestId===f.id).map(c=>c.operation);
  const deadline=Date.now()+5000;while(!ownCalls().length&&Date.now()<deadline)await drain();
  assert.deepEqual(ownCalls(),[returning?'depart':'land'],'An unrelated receipt must not strand the passenger at the last painted waypoint');
  const guest=f.runtime.guests.find(g=>g.id===f.id);while(guest.remotePending&&Date.now()<deadline)await drain();
  await f.idle();assert.deepEqual(f.errors,[]);
  const after=await f.current();assert.equal(after.state.coins,f.before.state.coins);assert.deepEqual(after.state.inventory,f.before.state.inventory);
  if(returning){assert.equal(guest.stage,'departed');assert.equal(after.actions.visitor.guests[f.id],undefined);}
  else{assert.equal(guest.stage,'walking');assert.equal(after.actions.visitor.guests[f.id].phase,'landed');}
  for(let i=0;i<30;i++){f.runtime.animatePending(.1,.1);await drain();}
  assert.equal(ownCalls().length,1,'The same crossing cannot confirm twice');
 }finally{f.runtime.reset();setWorldTheme('pixel');}
});
test('arrival presentation cannot bypass the canonical boat landing time',async()=>{
 const f=await fixture('pixel',false,true);
 try{
  for(let i=0;i<220;i++){f.runtime.animatePending(.1,.1);await drain();}
  const guest=f.runtime.guests.find(g=>g.id===f.id),deadline=Date.now()+5000;while(guest.remotePending&&Date.now()<deadline)await drain();
  await f.idle();assert.deepEqual(f.errors,['visitor_early']);const after=await f.current();assert.equal(after.actions.visitor.guests[f.id].phase,'onboard');assert.equal(after.state.coins,f.before.state.coins);assert.deepEqual(after.state.inventory,f.before.state.inventory);
 }finally{f.runtime.reset();}
});
