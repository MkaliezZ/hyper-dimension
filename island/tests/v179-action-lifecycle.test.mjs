import test from 'node:test';import assert from 'node:assert/strict';
import {advanceAcceptedWorkAction,advancePendingActionPose} from '../src/residentActivityControl.js';
import {visibleFrameSeconds,visibleNavigationSeconds} from '../src/frameClock.js';
import {followPath} from '../src/movement.js';
for(const [kind,key,done,type] of [['farm','serverFarmTicket','serverFarmFinished','water'],['field','serverFieldTicket','serverFieldFinished','pickaxe'],['resident','serverResidentTicket','serverResidentFinished','craft']]){
 test(kind+' approved animation finishes once while its real receipt is queued, clearing indoor pose too',()=>{
  let submissions=0;const a={type,t:0,duration:20,onDone:()=>submissions++},n={npcId:2,action:a,indoorActor:{action:a},intent:{[key]:{kind,actor:'npc',actorId:2,action:type}}};
  for(let i=0;i<161;i++)advanceAcceptedWorkAction(n,1/8);assert.equal(a.t,20);assert.equal(submissions,1);assert.equal(n.action,null);assert.equal(n.indoorActor.action,null);assert(!n.intent[done],'a submitted finish is not an acknowledged result');
 });
 test(kind+' mismatched, starting or already confirmed work cannot submit a completion',()=>{
  for(const edit of [n=>n.intent.starting=true,n=>n.intent[done]=true,n=>n.intent[key].actorId=9,n=>n.intent[key].kind='invalid',n=>n.intent[key].actor='player',n=>n.action.type='wrong']){let calls=0;const n={npcId:2,action:{type,t:0,duration:20,onDone:()=>calls++},intent:{[key]:{kind,actor:'npc',actorId:2,action:type}}};edit(n);assert.equal(advanceAcceptedWorkAction(n,30),false);assert.equal(calls,0);assert.equal(n.action.t,0);}
 });
}
test('an ungranted/local action stops its repeated pose but never runs contact, completion or material callbacks',()=>{
 for(const type of ['hoe','sow','water','pickaxe','craft','axe','rest','eat','talk']){let calls=0;const n={action:{type,t:0,duration:20,onContact:()=>calls++,onDone:()=>calls++}};for(let i=0;i<240;i++){assert.equal(advanceAcceptedWorkAction(n,1/8),false);advancePendingActionPose(n,1/8);}assert.equal(n.action.t,20);assert.equal(n.action.awaitingReceipt,true);assert.equal(calls,0);}
});
test('zero or invalid time does not advance approved or waiting action poses',()=>{
 for(const dt of [0,-1,NaN,Infinity]){const n={npcId:0,intent:{serverFarmTicket:{kind:'farm',actor:'npc',actorId:0,action:'water'}},action:{type:'water',t:0,duration:20,onDone:()=>assert.fail()}};assert.equal(advanceAcceptedWorkAction(n,dt),false);advancePendingActionPose(n,dt);assert.equal(n.action.t,0);}
});
test('slow visible navigation preserves its speed along bends without accelerating protected simulation time',()=>{
 const a={x:0,y:0,path:[{x:100,y:0},{x:100,y:100},{x:500,y:100}]};let at=0,distance=0,simulation=0;for(const ms of [300,200,450,600,250,500]){const next=at+ms,dt=visibleNavigationSeconds(next,at);followPath(a,dt,142);distance+=dt*142;simulation+=visibleFrameSeconds(next,at);at=next;}assert(Math.abs(a.x-(distance-100))<1e-8);assert.equal(a.y,100);assert.equal(simulation,.9);assert.equal(distance,326.6);
});
test('navigation has a bounded visible budget and no hidden catch-up while protected frames retain their original limit',()=>{
 assert.equal(visibleNavigationSeconds(650,0),.65);assert.equal(visibleFrameSeconds(650,0),.15);assert.equal(visibleNavigationSeconds(600000,0),.75);assert.equal(visibleNavigationSeconds(600000,0,true),0);assert.equal(visibleNavigationSeconds(10,20),0);assert.equal(visibleNavigationSeconds(NaN,0),0);
});
