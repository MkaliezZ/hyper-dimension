import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {CROPS} from '../src/farming.js';
import {CROP_HARVEST,cropHarvestProfile} from '../src/cropHarvest.js';
import {resolveHarvestTool} from '../src/equipmentRules.js';
import {harvestStroke,harvestArmOffset} from '../src/toolMotion.js';
import {availableQuantity} from '../src/resourceLedger.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {validFarmTicket,applyFarmCommand} from '../server/farmActions.mjs';
const expected={wheat:'cut',rice:'cut',flax:'cut',carrot:'root',potato:'root',sweet_potato:'root',daikon:'root',tomato:'pick',corn:'pick',strawberry:'pick',cotton:'pick',pea:'pick',cucumber:'pick',eggplant:'pick',blueberry:'pick',herb:'leaf',cabbage:'leaf',kale:'leaf',pumpkin:'lift'};
await mkdir('qa/v176',{recursive:true});
test('every old and new crop has a truthful harvesting action and tool',()=>{
 assert.deepEqual(Object.keys(CROPS).sort(),Object.keys(expected).sort());
 for(const [crop,mode] of Object.entries(expected)){assert.equal(CROP_HARVEST[crop].mode,mode);const s=createZeroState();s.inventory.hoe=1;s.inventory.sickle=1;const t=resolveHarvestTool(s,crop);assert.equal(t?.id||null,mode==='cut'?'sickle':mode==='root'?'hoe':null);if(t)assert.equal(t.source,'owned');}
 assert.equal(cropHarvestProfile('missing'),null);assert.equal(resolveHarvestTool(createZeroState(),'missing'),null);
});
test('root work loosens then grasps and lifts; hand-picked crops never swing a tool',()=>{
 assert.equal(harvestStroke(.15,'root').phase,'loosen');assert.equal(harvestStroke(.15,'root').showTool,true);
 assert.equal(harvestStroke(.48,'root').phase,'grasp');assert.equal(harvestStroke(.48,'root').showTool,false);assert.equal(harvestStroke(.48,'root').showCrop,false);
 assert.equal(harvestStroke(.74,'root').phase,'lift');assert.equal(harvestStroke(.74,'root').showCrop,true);
 for(const mode of ['cut','root','pick','leaf','lift']){assert.equal(harvestArmOffset(harvestStroke(0,mode)),0);assert.equal(Math.abs(harvestArmOffset(harvestStroke(1,mode))),0);assert.equal(harvestStroke(1,mode).cropOpacity,0);let previous=null;for(let i=0;i<=1000;i++){const pose=harvestStroke(i/1000,mode),arm=harvestArmOffset(pose);assert(Number.isFinite(arm));assert(Math.abs(arm)<6);if(previous!=null)assert(Math.abs(arm-previous)<.12,mode+' sleeve continuity');previous=arm;if(['pick','leaf','lift'].includes(mode))assert.equal(pose.showTool,false);}}
});
const finish=r=>({kind:'farm',operation:'finish',requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence,expectedVersion:r.document.version});
async function fixture(crop,actor,theme){let now=1000000;const directory=await mkdtemp(resolve('qa/v176/crop-'));const store=createSaveStore({directory,now:()=>now});const s=hydrateTown(createZeroState());s.freshStartPending=false;s.journey={completed:{harvest:true}};s.inventory.hoe=1;s.inventory.sickle=1;s.plots[1]={stage:4,growth:CROPS[crop].seconds,crop};const d=(await store.open(theme,{legacyState:s})).document;const r=await store.action(theme,{kind:'farm',operation:'begin',requestId:randomUUID(),index:1,step:'harvest',actor,...(actor==='npc'?{actorId:1}:{}),expectedVersion:d.version,expectedSequence:d.actions?.sequence||0,epoch:d.actions?.epoch||null});return {store,r,advance:()=>now+=Math.ceil(r.ticket.duration*1000)};}
for(const theme of ['pixel','origami'])test(theme+' actual server receipts: 8 new crops, player and NPC tools, exact yield, replay-safe',async()=>{
 for(const crop of ['cabbage','pea','cucumber','eggplant','blueberry','sweet_potato','daikon','kale'])for(const actor of ['player','npc']){
  const f=await fixture(crop,actor,theme),r=f.r,root=expected[crop]==='root';assert.equal(r.ticket.step,'harvest');assert.equal(r.ticket.action,'harvest');assert.equal(r.ticket.harvestMode,expected[crop]);assert(validFarmTicket(r.ticket));assert.equal(r.ticket.tool?.id||null,root?'hoe':null);
  assert.deepEqual(r.ticket.reservedItems,root&&actor==='player'?{hoe:1}:{});assert.equal(availableQuantity(r.document.state,'sickle'),1);
  if(actor==='npc')assert.equal(r.ticket.duration,20);f.advance();const done=await f.store.action(theme,finish(r));assert.equal(done.document.state.inventory[crop],CROPS[crop].yield);assert.equal(done.document.state.inventory.seed,1);assert.equal(done.document.state.plots[1].stage,0);assert.equal(availableQuantity(done.document.state,'hoe'),1);assert.equal(done.document.state.economy.playerGoods[crop]||0,actor==='player'?CROPS[crop].yield:0);
  const again=await f.store.action(theme,finish(r));assert(again.replayed);assert.equal(again.document.state.inventory[crop],CROPS[crop].yield);
 }
});
test('pre-upgrade harvest leases without presentation metadata remain completable once',async()=>{
 const f=await fixture('wheat','player','pixel'),r=f.r;const state=structuredClone(r.document.state),book=structuredClone(r.document.actions),ticket=book.active;delete ticket.harvestMode;assert(validFarmTicket(ticket));
 const done=applyFarmCommand(state,book,finish(r),ticket.readyAt);assert.equal(done.receipt.gain.wheat,2);assert.equal(availableQuantity(state,'sickle'),1);
 assert.equal(validFarmTicket({...r.ticket,harvestMode:'root'}),false);
});
