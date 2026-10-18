import test from 'node:test';
import assert from 'node:assert/strict';
import {browserProcessIds,parseBrowserProcessRss,observeOwnedBrowserProcesses} from './nativeBrowserResources.mjs';

test('native process readings reject invalid or unrelated process identities',()=>{
 for(const id of ['2;bad',-1,0,Infinity,1.5])assert.throws(()=>browserProcessIds([{id}]),/Invalid/);
 assert.deepEqual(browserProcessIds([{id:41},{id:41},{id:42}]),[41,42]);
 assert.throws(()=>parseBrowserProcessRss('99 500 0.0 S',[41]),/Unexpected process/);
 assert.throws(()=>parseBrowserProcessRss('41 invalid 0.0 S',[41]),/Invalid/);
});
test('macOS memory observations request only CDP-owned PIDs and convert KiB correctly',async()=>{
 const calls=[],session={send:async method=>{assert.equal(method,'SystemInfo.getProcessInfo');return{processInfo:[{id:41,type:'renderer',cpuTime:12},{id:42,type:'GPU',cpuTime:3}]};}};
 const result=await observeOwnedBrowserProcesses(session,{platform:'darwin',run:async(file,args,options)=>{calls.push({file,args,options});return{stdout:'41 1024 4.5 S\n42 2048 1.2 R\n'};}});
 assert.equal(calls.length,1);assert.deepEqual(calls[0].args,['-o','pid=,rss=,pcpu=,stat=','-p','41,42']);assert.equal(calls[0].options.timeout,2000);assert.equal(result[0].rssBytes,1048576);assert.equal(result[1].type,'GPU');
});
test('Windows observations cannot return a process outside the owned browser',async()=>{
 const session={send:async()=>({processInfo:[{id:41,type:'renderer'}]})};
 await assert.rejects(observeOwnedBrowserProcesses(session,{platform:'win32',run:async()=>({stdout:'[{"Id":99,"WorkingSet64":1}]'})}),/Unexpected process/);
 const rows=await observeOwnedBrowserProcesses(session,{platform:'win32',run:async()=>({stdout:'[{"Id":41,"WorkingSet64":1024,"PrivateMemorySize64":512}]'})});assert.equal(rows[0].privateBytes,512);
});
