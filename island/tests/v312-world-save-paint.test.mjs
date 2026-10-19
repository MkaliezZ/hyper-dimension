import test from 'node:test';
import assert from 'node:assert/strict';
async function fixture(run){
 const keys=['document','requestAnimationFrame','cancelAnimationFrame'],before=keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]),frames=[];
 try{globalThis.document={hidden:false};globalThis.requestAnimationFrame=fn=>(frames.push(fn),frames.length);globalThis.cancelAnimationFrame=()=>{};const api=await import('../src/saveScheduler.js?world-fixture='+crypto.randomUUID());await run({...api,frames});}
 finally{for(const[k,d]of before)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
}
test('a continuously waiting durable copy preserves at least six world paints in every eight-frame window',()=>fixture(async({yieldForSave,deferWorldSavePaint,frames})=>{
 const copy=yieldForSave(),painted=Array.from({length:40},()=>!deferWorldSavePaint());
 for(let start=0;start<=painted.length-8;start++)assert(painted.slice(start,start+8).filter(Boolean).length>=6,'world paint floor at offset '+start);
 frames[0]();await copy;for(let i=0;i<8;i++)assert.equal(deferWorldSavePaint(),false);
}));
test('finishing one overlapping copy retains the other without consuming the world paint floor',()=>fixture(async({yieldForSave,deferWorldSavePaint,frames})=>{
 const first=yieldForSave(),second=yieldForSave();assert.equal(deferWorldSavePaint(),true);frames[0]();await first;
 for(let i=0;i<3;i++)assert.equal(deferWorldSavePaint(),false);assert.equal(deferWorldSavePaint(),true);frames[1]();await second;
 for(let i=0;i<8;i++)assert.equal(deferWorldSavePaint(),false);
}));
test('a lost capture RAF keeps its original fallback and leaves no world paint deferral after release',()=>fixture(async({yieldForSave,deferWorldSavePaint})=>{
 const copy=yieldForSave();assert.equal(deferWorldSavePaint(),true);let timeout;
 try{await Promise.race([copy,new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('original save fallback stayed blocked')),500))]);}finally{clearTimeout(timeout);}
 for(let i=0;i<8;i++)assert.equal(deferWorldSavePaint(),false);
}));
