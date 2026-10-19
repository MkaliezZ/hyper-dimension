import test from 'node:test';
import assert from 'node:assert/strict';

async function fixture(run,{hidden=false,missing=false,throws=false}={}){
 const names=['requestAnimationFrame','cancelAnimationFrame','document'],saved=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]),frames=[],cancelled=[];
 try{
  Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden}});
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:missing?undefined:fn=>{if(throws)throw Error('unavailable');frames.push(fn);return frames.length;}});
  Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:id=>cancelled.push(id)});
  const api=await import('../src/saveScheduler.js?fixture='+crypto.randomUUID());
  await run({...api,frames,cancelled});
 }finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
}

test('idle drawing is never deferred by the save scheduler',()=>fixture(async({deferSavePaint})=>{
 for(let i=0;i<5;i++)assert.equal(deferSavePaint(),false);
}));
test('durable preparation can defer one frame but the next frame must paint',()=>fixture(async({yieldForSave,deferSavePaint,frames})=>{
 let completed=false;const copy=yieldForSave().then(()=>completed=true);
 assert.equal(deferSavePaint(),true);assert.equal(deferSavePaint(),false);
 assert.equal(deferSavePaint(),true);assert.equal(deferSavePaint(),false);
 assert.equal(completed,false);frames[0]();assert.equal(completed,false);
 await copy;assert.equal(completed,true);assert.equal(deferSavePaint(),false);
}));
test('one finished capture cannot release another waiting capture',()=>fixture(async({yieldForSave,deferSavePaint,frames,cancelled})=>{
 const first=yieldForSave(),second=yieldForSave();frames[0]();await first;
 assert.equal(deferSavePaint(),true);assert.equal(deferSavePaint(),false);
 frames[1]();await second;assert.equal(deferSavePaint(),false);assert.deepEqual(cancelled,[1,2]);
}));
test('a visible lost RAF releases preparation under the original 100 ms fallback',()=>fixture(async({yieldForSave,deferSavePaint,cancelled})=>{
 const copy=yieldForSave();assert.equal(deferSavePaint(),true);assert.equal(deferSavePaint(),false);
 let timer;try{await Promise.race([copy,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('capture stayed blocked')),500))]);}finally{clearTimeout(timer);}
 assert.equal(deferSavePaint(),false);assert.deepEqual(cancelled,[1]);
}));
for(const mode of [{hidden:true},{missing:true},{throws:true}])test('fallback '+Object.keys(mode)[0]+' leaves no stale paint priority',()=>fixture(async({yieldForSave,deferSavePaint,frames})=>{
 const copy=yieldForSave();assert.equal(deferSavePaint(),false);await copy;
 assert.equal(deferSavePaint(),false);assert.equal(frames.length,0);
},mode));
