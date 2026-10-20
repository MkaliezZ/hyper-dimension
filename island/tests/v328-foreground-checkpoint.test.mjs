import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionQueue} from '../src/actionQueue.js';
const gate=()=>{let release;const waiting=new Promise(r=>release=r);return{waiting,release};};
const turn=()=>new Promise(r=>setImmediate(r));
test('a user checkpoint waits for active acceptance then passes unstarted background work',async()=>{
 const queue=createActionQueue(),active=gate(),order=[],jobs=[queue.enqueue(async()=>{order.push('active');await active.waiting;})];await turn();
 jobs.push(queue.enqueue(()=>order.push('background-1')));jobs.push(queue.enqueue(()=>order.push('background-2')));jobs.push(queue.enqueue(()=>order.push('user-checkpoint'),{barrier:true,foreground:true}));
 assert.deepEqual(order,['active']);active.release();await Promise.all(jobs);assert.deepEqual(order,['active','user-checkpoint','background-1','background-2']);
});
test('a user checkpoint cannot pass an earlier explicit checkpoint or its preceding work',async()=>{
 const queue=createActionQueue(),active=gate(),order=[],jobs=[queue.enqueue(async()=>{order.push('active');await active.waiting;})];await turn();
 jobs.push(queue.enqueue(()=>order.push('earlier-work')));jobs.push(queue.enqueue(()=>order.push('backup'),{barrier:true}));jobs.push(queue.enqueue(()=>order.push('later-work')));jobs.push(queue.enqueue(()=>order.push('user-checkpoint'),{barrier:true,foreground:true}));
 active.release();await Promise.all(jobs);assert.deepEqual(order,['active','earlier-work','backup','user-checkpoint','later-work']);
});
test('later foreground work cannot cross an earlier checkpoint even when another checkpoint is foreground',async()=>{
 const queue=createActionQueue(),active=gate(),order=[],jobs=[queue.enqueue(async()=>{order.push('active');await active.waiting;})];await turn();
 jobs.push(queue.enqueue(()=>order.push('background')));jobs.push(queue.enqueue(()=>order.push('older-checkpoint'),{barrier:true}));jobs.push(queue.enqueue(()=>order.push('user-checkpoint'),{barrier:true,foreground:true}));jobs.push(queue.enqueue(()=>order.push('setting'),{foreground:true}));
 active.release();await Promise.all(jobs);assert.deepEqual(order,['active','background','older-checkpoint','user-checkpoint','setting']);
});
test('foreground checkpoint failure preserves its exact rejection and does not erase background work',async()=>{
 const queue=createActionQueue(),active=gate(),order=[],error=Object.assign(Error('Original uncertain journal'),{code:'action_pending'}),jobs=[queue.enqueue(async()=>{await active.waiting;})];await turn();
 jobs.push(queue.enqueue(()=>order.push('background')));const checkpoint=queue.enqueue(()=>{order.push('checkpoint');throw error;},{barrier:true,foreground:true});checkpoint.catch(()=>{});
 active.release();await assert.rejects(checkpoint,e=>e===error);await Promise.all(jobs);assert.deepEqual(order,['checkpoint','background']);
});
