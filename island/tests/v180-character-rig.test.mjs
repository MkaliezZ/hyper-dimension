import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpriteMesh,spriteMeshPoint,spriteMeshHands,drawConnectedSprite} from '../src/characterRig.js';
const area=([a,b,c])=>(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);

test('narrow and broad original sprites stay connected and never fold inside out during work or walking',()=>{
 for(const width of [22,38,60,75])for(const garment of [false,true])for(const action of [null,'hoe','pickaxe','axe','water','sow','fertilize','celebrate'])for(let i=0;i<=80;i++){
  const t=i/80,mesh=createSpriteMesh({width,height:garment?52:96,garment,action,t,gait:Math.sin(t*Math.PI*2),work:Math.sin(t*Math.PI*2)}),vertices=new Set(mesh.vertices.flat());
  for(const triangle of mesh.triangles){assert(triangle.every(v=>vertices.has(v)),'a cut piece must not own independent boundary vertices');const original=(triangle[1].u-triangle[0].u)*(triangle[2].v-triangle[0].v)-(triangle[2].u-triangle[0].u)*(triangle[1].v-triangle[0].v);assert(area(triangle)>=original*width*mesh.pose.height*.19999,'surface collapsed at a joint');}
 }
});
test('neighbouring UV regions meet at the same shoulder, elbow, waist and knee positions',()=>{
 const mesh=createSpriteMesh({width:48,height:96,action:'hoe',t:.56,gait:.7});
 for(const v of mesh.rows.slice(1,-1))for(const u of mesh.columns){const p=spriteMeshPoint(mesh,u,v),above=spriteMeshPoint(mesh,u,v-1e-7),below=spriteMeshPoint(mesh,u,v+1e-7);assert(Math.hypot(p.x-above.x,p.y-above.y)<.0001);assert(Math.hypot(p.x-below.x,p.y-below.y)<.0001);}
});
test('tool and glove hands use the rendered surface for all eight views, including mirrored sleeves',()=>{
 for(const garment of [false,true])for(let heading=0;heading<8;heading++)for(const flip of [false,true]){
  const mesh=createSpriteMesh({width:40,height:garment?52:96,garment,action:'water',t:.55});
  for(const hand of spriteMeshHands(mesh,heading,flip)){const p=spriteMeshPoint(mesh,hand.u,hand.v);assert.equal(hand.x,p.x*(flip?-1:1));assert.equal(hand.y,p.y);assert(Number.isFinite(hand.angle));}
 }
});
test('a completed work gesture returns continuously to its original pose',()=>{
 for(const action of ['hoe','pickaxe','axe','water','sow','fertilize','celebrate']){
  const idle=createSpriteMesh({width:30,height:96}),end=createSpriteMesh({width:30,height:96,action,t:1}),near=createSpriteMesh({width:30,height:96,action,t:.9999});
  for(const row of idle.vertices)for(const p of row){const e=spriteMeshPoint(end,p.u,p.v),n=spriteMeshPoint(near,p.u,p.v);assert(Math.hypot(e.x-p.x,e.y-p.y)<1e-7);assert(Math.hypot(n.x-e.x,n.y-e.y)<.0001);}
 }
});
test('idle characters paint their original complete artwork in one call',()=>{
 const mesh=createSpriteMesh({width:40,height:96}),calls=[];
 drawConnectedSprite({drawImage:(...args)=>calls.push(args)}, {}, {x:10,y:20,w:200,h:480},mesh);
 assert.equal(calls.length,1);assert.deepEqual(calls[0].slice(1),[10,20,200,480,-20,-96,40,96]);
});
