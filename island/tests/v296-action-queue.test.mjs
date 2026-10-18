import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionQueue} from '../src/actionQueue.js';

const gate=()=>{let release;const waiting=new Promise(resolve=>release=resolve);return {waiting,release};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('normal authoritative work remains serial FIFO and returns its own result',async()=>{
 const queue=createActionQueue(),held=gate(),order=[];
 const first=queue.enqueue(async()=>{order.push('first');await held.waiting;return 'first-result';});
 const second=queue.enqueue(()=>{order.push('second');return 'second-result';});
 await tick();assert.deepEqual(order,['first']);held.release();
 assert.deepEqual(await Promise.all([first,second]),['first-result','second-result']);assert.deepEqual(order,['first','second']);
});

test('a foreground setting cannot interrupt a started job and can pass queued background work',async()=>{
 const queue=createActionQueue(),held=gate(),order=[];
 const first=queue.enqueue(async()=>{order.push('active');await held.waiting;});await tick();
 const background=queue.enqueue(()=>order.push('background'));
 const setting=queue.enqueue(()=>order.push('setting'),{foreground:true});
 assert.deepEqual(order,['active']);held.release();await Promise.all([first,background,setting]);assert.deepEqual(order,['active','setting','background']);
});

test('explicit checkpoints form an ordering barrier for later foreground settings',async()=>{
 const queue=createActionQueue(),held=gate(),order=[];
 const jobs=[queue.enqueue(async()=>{order.push('active');await held.waiting;})];await tick();
 jobs.push(queue.enqueue(()=>order.push('earlier-work')));
 jobs.push(queue.enqueue(()=>order.push('checkpoint'),{barrier:true}));
 jobs.push(queue.enqueue(()=>order.push('later-work')));
 jobs.push(queue.enqueue(()=>order.push('setting'),{foreground:true}));
 held.release();await Promise.all(jobs);assert.deepEqual(order,['active','earlier-work','checkpoint','setting','later-work']);
});

test('a succession of foreground settings does not starve older background work',async()=>{
 const queue=createActionQueue(),held=gate(),order=[];
 const jobs=[queue.enqueue(async()=>{order.push('active');await held.waiting;})];await tick();
 jobs.push(queue.enqueue(()=>order.push('background')));
 for(let n=0;n<4;n++)jobs.push(queue.enqueue(()=>order.push('setting-'+n),{foreground:true}));
 held.release();await Promise.all(jobs);assert.deepEqual(order.slice(0,3),['active','setting-0','background']);assert.equal(order.length,6);
});

test('rejected jobs preserve their error and do not suppress queued work',async()=>{
 const queue=createActionQueue(),error=Error('fictional definite rejection'),order=[];
 const rejected=queue.enqueue(()=>{throw error;});const next=queue.enqueue(()=>order.push('next'));
 await assert.rejects(rejected,e=>e===error);await next;assert.deepEqual(order,['next']);
});

test('work enqueued by a completing job is still serialized and executed exactly once',async()=>{
 const queue=createActionQueue(),order=[];let appended;
 const first=queue.enqueue(()=>{order.push('first');appended=queue.enqueue(()=>order.push('appended'));});
 const second=queue.enqueue(()=>order.push('second'));await Promise.all([first,second]);await appended;assert.deepEqual(order,['first','second','appended']);
});
