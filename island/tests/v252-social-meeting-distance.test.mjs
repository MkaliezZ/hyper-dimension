import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,setWorldTheme} from '../src/world.js';
import {hydrateTown,socialVenue,career} from '../src/townSimulation.js';

for(const theme of ['pixel','origami'])test(theme+' reconciliation chooses a balanced nearby shared venue before a distant habitual camp',()=>{
 setWorldTheme(theme);try{
  const s=hydrateTown(createState());assert.equal(socialVenue(0,8,s,'reconcile'),22,'Legacy states without usable positions retain their contextual venue');
  s.npcPresence=[{id:0,x:462,y:1008},{id:8,x:1995.65,y:1358.95}];career(8,s);const before=structuredClone(s);
  assert.equal(socialVenue(0,8,s,'reconcile'),9,'The shared market is accessible from both residents, instead of sending the farmer across the island');
  assert.equal(socialVenue(8,0,s,'reconcile'),9,'Who initiates must not change the balanced destination');assert.deepEqual(s,before,'Venue choice cannot fabricate conversations, memories or supplies');
  s.npcPresence.push(...Array.from({length:5},(_,i)=>({id:i+20,inside:9})));assert.notEqual(socialVenue(0,8,s,'reconcile'),9,'Travel convenience must still respect a crowded venue');
 }finally{setWorldTheme('pixel');}
});

test('missing or malformed resident positions do not change contextual social choices',()=>{
 const s=hydrateTown(createState()),expected=socialVenue(0,8,s,'reconcile');
 for(const rows of [[{id:0,x:462,y:1008}],[{id:0,x:NaN,y:1008},{id:8,x:1995,y:1359}],[{id:0,x:462,y:1008},{id:8,x:1995}]]){s.npcPresence=rows;assert.equal(socialVenue(0,8,s,'reconcile'),expected);}
});
