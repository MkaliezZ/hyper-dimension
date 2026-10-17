import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCurrentFarmIntent} from '../src/farmIntent.js';

const book=(stage,crop='wheat')=>({farm:{plots:[{stage,crop}]}});
const input=(step,crop='wheat')=>({kind:'farm',operation:'begin',actor:'player',index:0,step,crop});
test('new player farm intents must match the acknowledged phase and crop',()=>{
 for(const[step,stage]of Object.entries({hoe:0,sow:1,water:2,harvest:4})){
  assert.doesNotThrow(()=>assertCurrentFarmIntent(book(stage),input(step)));
  for(const changed of [0,1,2,3,4].filter(x=>x!==stage))assert.throws(()=>assertCurrentFarmIntent(book(changed),input(step)),e=>e.code==='farm_intent_changed');
 }
 assert.throws(()=>assertCurrentFarmIntent(book(2,'tomato'),input('water')),e=>e.code==='farm_intent_changed');
 assert.throws(()=>assertCurrentFarmIntent(book(4,'tomato'),input('harvest')),e=>e.code==='farm_intent_changed');
 assert.doesNotThrow(()=>assertCurrentFarmIntent(book(1),input('sow','tomato')),'A selected new crop need not equal the old empty plot crop');
 assert.doesNotThrow(()=>assertCurrentFarmIntent(book(2),{...input('water'),crop:undefined}),'The server can derive the current crop for an omitted crop selector');
});
test('the new-intent check leaves settlement, cancellation and other action authorities intact',()=>{
 for(const extra of [{operation:'finish'},{operation:'cancel'},{actor:'npc'},{actor:'facility'},{kind:'craft'},{step:'fertilize'}])assert.doesNotThrow(()=>assertCurrentFarmIntent(book(3),{...input('water'),...extra}));
 assert.doesNotThrow(()=>assertCurrentFarmIntent(null,input('water')),'Legacy initialization remains server-validated');
 assert.throws(()=>assertCurrentFarmIntent(book(2),{...input('water'),index:99}),e=>e.code==='farm_intent_changed');
});
