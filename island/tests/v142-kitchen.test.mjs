import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorkshopLevel,createWorkshopState,workshopAction as act,stepWorkshop as step} from '../src/workshopRules.js';
import {kitchenTarget,kitchenRunQuality} from '../src/kitchenCutting.js';
import {neutralCraftGame,applyCraftEvent} from '../src/craftGameReplay.js';
const advance=(s,n)=>{for(let i=0;i<Math.ceil(n/.05);i++)step(s,.05)};
function prep(old=false){const l=makeWorkshopLevel(2,231,2);if(old)delete l.schemaVersion;const s=createWorkshopState(l);act(s,{type:'start'});advance(s,.1);for(const index of l.orders[0].ingredients)act(s,{type:'ingredient',index});return s;}
function stroke(s,offset=0){const p=kitchenTarget(s);act(s,{type:'down',x:p.x+offset,y:286});advance(s,.1);act(s,{type:'point',x:p.x+offset,y:356});act(s,{type:'up'});}
test('native cutting requires a real downwards crossing and cannot gain repeated cuts from one stroke',()=>{
 const s=prep(),p=kitchenTarget(s);act(s,{type:'down',x:p.x,y:356});advance(s,.1);act(s,{type:'point',x:p.x,y:286});assert.equal(s.jobs[0].cuts,0);
 stroke(s,40);assert.equal(s.jobs[0].cuts,0);stroke(s);assert.equal(s.jobs[0].cuts,1);assert.equal(s.jobs[0].cutQuality[0],100);
 for(let n=0;n<40;n++)act(s,{type:'point',x:p.x,y:360});assert.equal(s.jobs[0].cuts,1);
 stroke(s);assert.equal(s.jobs[0].cuts,1,'knife must recover');advance(s,.4);stroke(s);assert.equal(s.jobs[0].cuts,2);assert.equal(kitchenTarget(s).index,1);
});
test('space and button cuts are accessible but do not permit same-frame auto completion',()=>{
 const s=prep();for(let i=0;i<100;i++)act(s,{type:'cut'});assert.equal(s.jobs[0].cuts,1);
 advance(s,.4);act(s,{type:'cut'});assert.equal(s.jobs[0].cuts,2);
 while(kitchenTarget(s)){advance(s,.4);act(s,{type:'cut'});}act(s,{type:'cook'});assert.equal(s.jobs[0].state,'cooking');assert(s.jobs[0].cutQuality.every(n=>n===100));
});
test('neutral checkpoint discards a held knife while preserving legal cut progress across JSON reload',()=>{
 const s=prep();stroke(s);advance(s,.4);const p=kitchenTarget(s);act(s,{type:'down',x:p.x,y:286});
 const game=JSON.parse(JSON.stringify({engine:'workshop',state:s,elapsed:s.t}));neutralCraftGame(game);assert.equal(game.state.kitchenStroke,null);assert.equal(game.state.holding,false);
 applyCraftEvent(game,{dt:.05});applyCraftEvent(game,{action:{type:'point',x:p.x,y:360}});assert.equal(game.state.jobs[0].cuts,1);
 advance(game.state,.4);stroke(game.state);assert.equal(game.state.jobs[0].cuts,2);
});
test('real cut precision contributes to dish review; clearing or rejecting prep removes old prep quality',()=>{
 const s=prep();stroke(s,20);assert.equal(s.jobs[0].cutQuality[0],75);act(s,{type:'clearPrep'});assert.deepEqual(s.jobs[0].cutQuality,[]);assert.equal(s.jobs[0].cuts,0);
 for(const index of s.level.orders[0].ingredients)act(s,{type:'ingredient',index});while(kitchenTarget(s)){advance(s,.4);stroke(s,20);}act(s,{type:'cook'});const j=s.jobs[0];advance(s,j.cook+.1);act(s,{type:'serve',station:j.station});assert(j.quality<94&&j.quality>85);assert.equal(kitchenRunQuality(s),j.quality);
});
test('old kitchen snapshots retain their original rapid-cut and quality rules',()=>{
 const s=prep(true);for(let i=0;i<4;i++)act(s,{type:'cut'});assert.equal(s.jobs[0].cuts,4);assert.equal(s.jobs[0].cutQuality,undefined);act(s,{type:'cook'});assert.equal(s.jobs[0].state,'cooking');
 advance(s,s.jobs[0].cook+.1);act(s,{type:'serve',station:0});assert.equal(s.served,1);assert.equal(s.jobs[0].quality,undefined);
});

test('a quick physical swipe remains valid when the browser has not produced another game frame',()=>{
 const s=prep(),p=kitchenTarget(s);act(s,{type:'down',x:p.x,y:286});act(s,{type:'point',x:p.x,y:356});act(s,{type:'up'});assert.equal(s.jobs[0].cuts,1);
 act(s,{type:'down',x:p.x,y:286});act(s,{type:'point',x:p.x,y:356});act(s,{type:'up'});assert.equal(s.jobs[0].cuts,1,'a second instant stroke cannot bypass knife recovery');
});
