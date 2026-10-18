import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleLanMotion} from '../src/lanMotion.js';

for(const fps of [1,2,8,60])test(`a fresh confirmed receipt on every paint still advances the resident at ${fps} FPS`,()=>{
 const actor={x:0,y:0};
 const position=(x,updatedAt)=>({x,y:0,updatedAt,online:true,direction:0,speed:80,route:[{x:1000,y:0}]});
 sampleLanMotion(actor,position(0,1000),0,0,()=>true);
 for(let i=1;i<=fps*3;i++){
  const at=i*1000/fps,confirmed=80*i/fps,before=actor.x;
  sampleLanMotion(actor,position(confirmed,1000+at),1/fps,at,()=>true);
  assert(actor.x>=before-1e-8,'New receipts must not pull the actor backwards');
  assert(actor.x<=confirmed+1e-8,'Only the actually traversed part of the server route may be displayed');
  assert(actor.x-before<=80*1.5/fps+1e-8,'Confirmed interpolation must respect the real elapsed speed budget');
  if(actor.walking)assert(Math.abs(actor.direction)<1e-8,'Walking and facing must agree with the confirmed direction');
 }
 assert(actor.x>60,'Continuous receipts cannot indefinitely restart interpolation at zero');
});
