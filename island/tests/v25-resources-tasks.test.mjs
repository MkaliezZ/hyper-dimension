import {validateState} from '../server/saveStore.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,RESIDENTS} from '../src/world.js';
import {hydrateTown,commitWork,settleVisit} from '../src/townSimulation.js';
import {DEFAULT_RECIPES,commitRecipe,giftItem,giftPreview,itemUse} from '../src/contentCatalog.js';
import {recordPlayerGoods,deliverTownOrder,transact,upgradeFacility} from '../src/economy.js';
import {availableQuantity,reservedQuantity,reserveResources,releaseResources,commitResources} from '../src/resourceLedger.js';
import {queueTask,nextTask,beginTaskStep,recordTaskStep,controlTask,restoreTasks,taskOwner} from '../src/taskBoard.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
const fresh=()=>hydrateTown(createState());
test('last ingredients have one owner across player, autonomous crafts, gifts, upgrades and orders',()=>{
 const s=fresh();s.inventory.ore=1;s.inventory.wood=3;s.inventory.lantern=1;recordPlayerGoods(s,'wood',3);
 assert(reserveResources(s,'task:party',{wood:3,ore:1,lantern:1}).ok);
 assert.equal(availableQuantity(s,'wood'),0);assert.equal(reservedQuantity(s,'wood'),3);
 assert.equal(reserveResources(s,'player:craft',{wood:1}).ok,false);
 assert.equal(commitRecipe(DEFAULT_RECIPES[0],s),false);
 assert.equal(giftItem('lantern',s,0).ok,false);assert.equal(itemUse('lantern',s).ok,false);
 assert.equal(upgradeFacility(s,0),false);assert.equal(deliverTownOrder(s,0),false);
 assert.equal(commitRecipe(DEFAULT_RECIPES[0],s,{owner:'task:party',commandId:'party:lamp'}),true);
 assert.equal(s.inventory.wood,1);assert.equal(s.inventory.lantern,2);
 assert.equal(reservedQuantity(s,'wood'),1);assert.equal(reservedQuantity(s,'lantern'),1);
});
test('save boundary rejects corrupted reservations instead of persisting unavailable stock',()=>{
 const s=fresh();reserveResources(s,'task:wood',{wood:4});assert.equal(validateState(s),s);
 const bad=structuredClone(s);bad.inventory.wood=3;assert.throws(()=>validateState(bad),/预留/);
 const malformed=structuredClone(s);malformed.resourceLedger.receipts=3;assert.throws(()=>validateState(malformed),/预留/);
});
test('same command repeated ten times and after reload produces exactly once; changed payload conflicts',()=>{
 let s=fresh();s.inventory.ore=20;
 const cmd={id:'craft:stable',cost:{wood:2,ore:1},gain:{lantern:1},category:'craft'};
 for(let i=0;i<10;i++)assert(commitResources(s,cmd).ok);
 assert.equal(s.inventory.lantern,1);assert.equal(s.inventory.wood,10);
 s=JSON.parse(JSON.stringify(s));assert(commitResources(s,cmd).replayed);
 assert.equal(commitResources(s,{...cmd,gain:{lantern:2}}).reason,'command_conflict');
 assert.equal(s.inventory.lantern,1);
});
test('reservation replacement is atomic; partial preparation and cancellation release only their own stock',()=>{
 const s=fresh();
 reserveResources(s,'task:a',{wood:8});reserveResources(s,'task:b',{wood:4});
 assert.equal(reserveResources(s,'task:a',{wood:9}).ok,false);
 assert.equal(s.resourceLedger.reservations['task:a'].items.wood,8);
 const held=reserveResources(s,'task:a',{wood:20,ore:3},{partial:true});
 assert.equal(held.complete,false);assert.equal(held.held.wood,8);
 assert.deepEqual(releaseResources(s,'task:a'),{wood:8});
 assert.equal(reservedQuantity(s,'wood'),4);assert.equal(availableQuantity(s,'wood'),8);
});
test('reserved meals cannot be eaten or sold; a service still earns legitimate net income from zero cash',()=>{
 const s=fresh();s.coins=0;s.inventory.meal=1;reserveResources(s,'party:supper',{meal:1});
 const hunger=s.npcNeeds[0]={energy:70,hunger:10,social:50,rations:0};
 assert.match(commitWork(0,{action:'eat',foodId:'meal'},s,0),/预留/);
 assert.equal(hunger.hunger,10);assert.equal(s.inventory.meal,1);
 assert.equal(settleVisit(s,{name:'测试游客',budget:30},2,'visit:food',0).paid,0);
 assert(settleVisit(s,{name:'测试游客',budget:30},5,'visit:stars',0).paid>0);
 assert(s.coins>0);assert.equal(s.inventory.meal,1);
});
test('coins reserved for a task survive income and cannot be spent elsewhere',()=>{
 const s=fresh();s.coins=8;reserveResources(s,'party:fee',{coins:8});
 assert.equal(transact(s,{cost:1,category:'other'}),false);
 assert(transact(s,{income:4,cost:2,category:'visitor',receipt:'positive'}));
 assert.equal(s.coins,10);assert.equal(availableQuantity(s,'coins'),2);
});
test('same gift diminishes, no-reward gift stays in bag, daily cap and next day are explicit',()=>{
 const s=fresh();s.inventory.lantern=20;
 assert.equal(giftPreview('lantern',s,0).gain,2);
 assert(giftItem('lantern',s,0).ok);assert.equal(giftPreview('lantern',s,0).gain,1);
 assert(giftItem('lantern',s,0).ok);const stock=s.inventory.lantern;
 assert.equal(giftItem('lantern',s,0).ok,false);assert.equal(s.inventory.lantern,stock);
 assert.equal(s.npcAffinity[0],23);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(giftPreview('lantern',restored,0).gain,0);
 restored.day++;assert.equal(giftPreview('lantern',restored,0).gain,2);
 for(const id of ['hoe','pickaxe','axe','sickle','watering_can']){restored.inventory[id]=3;giftItem(id,restored,11)}
 assert.equal((restored.npcAffinity[11]??20)-20,8);
});
test('persistent task dependency, progress and cancellation retain real output and reject replay',()=>{
 let s=fresh();
 const a={id:'a',npcId:1,goal:'forest',resource:'wood',quantity:4,intent:'四份木材'};
 assert(queueTask(s,a,{targetItem:'wood'}).ok);
 assert(queueTask(s,a).replayed);
 assert.equal(queueTask(s,{...a,quantity:40}).reason,'command_conflict');
 queueTask(s,{id:'b',npcId:2,goal:'workshop',dependsOn:['a'],intent:'后续制作'},{targetItem:'lantern'});
 assert.equal(nextTask(s,2),null);
 const op=beginTaskStep(s,'a');assert(recordTaskStep(s,'a',{operationId:op,result:'木材 ×2',delta:{wood:2}}).ok);
 assert.equal(recordTaskStep(s,'a',{operationId:op,result:'replay',delta:{wood:2}}).ok,false);
 reserveResources(s,taskOwner('a'),{wood:2});
 s=JSON.parse(JSON.stringify(s));restoreTasks(s);assert.equal(nextTask(s,1).completed,2);
 const before=s.inventory.wood;assert(controlTask(s,'a','pause').ok);assert.equal(nextTask(s,1),null);
 assert(controlTask(s,'a','resume').ok);assert(controlTask(s,'a','cancel').ok);
 assert.equal(s.inventory.wood,before);assert.equal(reservedQuantity(s,'wood'),0);
 assert.equal(nextTask(s,2),null);assert.equal(s.agentTaskLedger[1].status,'waiting');
});
test('only the requested mined output advances a task; actual action receipt survives duplicate completion',()=>{
 const s=fresh();queueTask(s,{id:'ore',npcId:11,goal:'mine',quantity:2},{targetItem:'ore'});
 let d={goal:'mine',action:'work',resource:'ore',mineIndex:0,assignmentId:'ore',operationId:beginTaskStep(s,'ore')};
 const result=commitWork(11,d,s,1),receipt=s.taskActionReceipts[d.operationId];
 recordTaskStep(s,'ore',{operationId:d.operationId,result,delta:receipt.delta});
 assert.equal(s.agentTaskLedger[0].completed,0);assert.equal(s.oreNodes[0].hp,2);
 commitWork(11,d,s,2);assert.equal(s.oreNodes[0].hp,2);
 for(let i=0;i<2;i++){d={...d,operationId:beginTaskStep(s,'ore')};const result=commitWork(11,d,s,3+i);recordTaskStep(s,'ore',{operationId:d.operationId,result,delta:s.taskActionReceipts[d.operationId].delta})}
 assert.equal(s.agentTaskLedger[0].completed,2);assert.equal(s.agentTaskLedger[0].status,'done');
});
test('runtime executes physical movement, resumes a partly completed multi-unit task after reload, and cancels without late reward',async()=>{
 let s=fresh();const npcs=RESIDENTS.map((r,npcId)=>({npcId,x:780,y:465,path:[],phase:0,walkMix:0}));
 const original=globalThis.fetch;let payload={commands:[{id:'runtime-wood',npcId:11,goal:'forest',resource:'wood',quantity:6,intent:'收集六份木材'}],source:'hermes'};
 globalThis.fetch=async route=>new Response(JSON.stringify(String(route).includes('/command')?payload:{error:'isolated test'}),{status:String(route).includes('/command')?200:503,headers:{'Content-Type':'application/json'}});
 try{
  const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
  const parkOthers=()=>{for(const n of npcs)if(n.npcId!==11)n.manualUntil=1e6};
  parkOthers();await runtime.steward('收集六份木材');let clock=0;
  const step=()=>{clock+=.2;runtime.update(.2,clock)};
  for(let i=0;i<1500&&s.agentTaskLedger[0].completed<2;i++)step();
  assert.equal(s.agentTaskLedger[0].completed,2);assert.notEqual(s.agentTaskLedger[0].status,'done');
  s=JSON.parse(JSON.stringify(s));runtime.reset();parkOthers();
  for(let i=0;i<2000&&s.agentTaskLedger[0].status!=='done';i++)step();
  assert.equal(s.agentTaskLedger[0].status,'done');assert.equal(s.agentTaskLedger[0].completed,6);
  assert.equal(s.agentTaskLedger[0].evidence.length,3);assert.equal(s.inventory.wood,18);
  await new Promise(resolve=>setImmediate(resolve));
  payload={commands:[{id:'runtime-cancel',npcId:11,goal:'forest',resource:'wood',quantity:6,intent:'取消测试'}],source:'hermes'};
  await runtime.steward('收集后取消');for(let i=0;i<5;i++)step();
  assert((await runtime.manageTask('runtime-cancel','cancel')).ok);
  npcs[11].manualUntil=1e6;const stock=s.inventory.wood;
  for(let i=0;i<300;i++)step();assert.equal(s.inventory.wood,stock);
  assert.equal(s.agentTaskLedger[1].status,'cancelled');
 }finally{globalThis.fetch=original}
});
