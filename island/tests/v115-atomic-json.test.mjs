import test from 'node:test';import assert from 'node:assert/strict';import{mkdir,mkdtemp,readFile,readdir,writeFile}from'node:fs/promises';import{resolve,join}from'node:path';import{replaceAtomicFile,atomicJSON}from'../server/atomicJson.mjs';
test('temporary Windows replacement conflict retries the same paths without removing destination',async()=>{
 const calls=[],waits=[];await replaceAtomicFile('temporary','destination',{platform:'win32',replace:async(...paths)=>{calls.push(paths);if(calls.length<4)throw Object.assign(Error('occupied'),{code:'EPERM'})},wait:async ms=>waits.push(ms)});assert.deepEqual(waits,[20,40,80]);assert.equal(calls.length,4);assert(calls.every(c=>c[0]==='temporary'&&c[1]==='destination'));
});
test('persistent Windows permission errors are bounded and retain the original error',async()=>{
 const error=Object.assign(Error('access denied'),{code:'EACCES'}),waits=[];let count=0;await assert.rejects(replaceAtomicFile('temporary','destination',{platform:'win32',replace:async()=>{count++;throw error},wait:async ms=>waits.push(ms)}),e=>e===error);assert.equal(count,7);assert.equal(waits.reduce((a,b)=>a+b,0),680);
});
test('disk errors and non-Windows failures are not concealed by retry',async()=>{
 for(const [platform,code]of[['win32','ENOSPC'],['linux','EPERM'],['darwin','EACCES']]){let calls=0;const waits=[];await assert.rejects(replaceAtomicFile('temporary','destination',{platform,replace:async()=>{calls++;throw Object.assign(Error(code),{code})},wait:async x=>waits.push(x)}),e=>e.code===code);assert.equal(calls,1);assert.deepEqual(waits,[])}
});
test('normal publication is durable JSON and leaves no temporary files after success or serialization failure',async()=>{
 await mkdir(resolve('qa'),{recursive:true});const directory=await mkdtemp(resolve('qa/v115-json-')),file=join(directory,'current.json');await atomicJSON(file,{revision:1});await atomicJSON(file,{revision:2,items:[1,2]});assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{revision:2,items:[1,2]});const recursive={};recursive.self=recursive;await assert.rejects(atomicJSON(file,recursive));assert.equal(JSON.parse(await readFile(file,'utf8')).revision,2);assert.deepEqual(await readdir(directory),['current.json']);
});
