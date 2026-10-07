import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import {createLanHttpServer} from '../server/lanServer.mjs';
async function fixture(){
 await mkdir('qa/v66',{recursive:true});const directory=await mkdtemp(resolve('qa/v66/authority-')),calls=[];let release=null,entered=null;
 const s=await createLanHttpServer({directory,port:0,enrollmentKey:'AUTOMATIC-FIXTURE',agentRuntimeFactory:({ownerId})=>({documents:'fixture',async call(method,args){if(method==='status')return{deepseek:{configured:true},hermes:{configured:true}};calls.push({ownerId,method,args});if(release)await new Promise(r=>{entered?.();release=r;});return{source:method==='steward'?'hermes':'deepseek',decisions:[],commands:[]};},async close(){}})}),accounts=[];
 for(let n=0;n<2;n++){const a=await s.identities.register({login:'auto_'+n,password:'fixture-password',name:'自动岛主'+n,islandName:'自动逻辑岛'+n,avatar:'male_'+n,theme:n?'origami':'pixel'});await s.tenants.open(a.token,n?'origami':'pixel',{});accounts.push(a);}
 const command=(n,operation,args={})=>s.identities.action(accounts[n].token,{operation,requestId:randomUUID(),...args});
 const payload=async n=>({theme:n?'origami':'pixel',saveSlot:(await s.tenants.readIslandForServer(accounts[n].view.me.id,n?'origami':'pixel')).state.saveSlot,residents:[],message:'不应传给自动模式的私人委托',history:[{role:'user',content:'private history'}],includeWorkProject:true,directory:'other-account'});
 return{s,accounts,calls,directory,command,payload,hold:()=>new Promise(r=>{release=()=>{};entered=r;}),release:()=>{const done=release;release=null;done?.();}};
}
test('automatic routes use authenticated owner and discard all personal-command/history fields',async()=>{
 const f=await fixture();try{
 for(let n=0;n<2;n++)for(const kind of ['plans','conversations','steward'])await f.s.agents.automatic(f.accounts[n].token,kind,await f.payload(n));
 assert.equal(f.calls.length,6);for(const call of f.calls){assert.equal(call.args.automatic,true);assert.deepEqual(call.args.history,[]);assert.equal(call.args.includeWorkProject,false);assert.equal(call.args.message,undefined);assert.equal(call.args.directory,undefined);assert(call.args.butler.actorId.startsWith(call.ownerId+':'));}
 await assert.rejects(f.s.agents.automatic(f.accounts[0].token,'plans',{...await f.payload(1)}),e=>e.code==='lan_save_missing'||e.code==='lan_agent_stale');
 const room=await f.command(0,'room_create',{title:'自动暂停验证',maxPlayers:2});await assert.rejects(f.s.agents.automatic(f.accounts[0].token,'steward',await f.payload(0)),e=>e.code==='lan_travel_active');assert.equal(f.calls.length,6);
 }finally{await f.s.close();}
});
test('inflight result cannot cross a complete leave/return cycle; repeated inflight requests do not reach runtime',async()=>{
 const f=await fixture();try{const entered=f.hold(),payload=await f.payload(0),run=f.s.agents.automatic(f.accounts[0].token,'plans',payload);await entered;
 await assert.rejects(f.s.agents.automatic(f.accounts[0].token,'plans',payload),e=>e.code==='automatic_cooldown'&&e.retryAfter===30);
 const r=await f.command(0,'room_create',{title:'旧安排失效验证',maxPlayers:2});await f.command(0,'room_close',{roomId:r.view.room.id,expectedRevision:r.view.room.revision});
 f.release();await assert.rejects(run,e=>e.code==='lan_agent_stale');assert.equal(f.calls.length,1);
 const state=await f.s.identities.homeAgentContext(f.accounts[0].token);assert.equal(state.travelEpoch,2);
 }finally{f.release();await f.s.close();}
});
test('guest return caused by host close also invalidates prior home epoch; duplicate join does not advance it twice',async()=>{
 const f=await fixture();try{const host=await f.command(0,'room_create',{title:'返程代次验证',maxPlayers:2}),before=await f.s.identities.homeAgentContext(f.accounts[1].token),i={operation:'room_join',requestId:randomUUID(),code:host.view.room.code};
 await f.s.identities.action(f.accounts[1].token,i);await f.s.identities.action(f.accounts[1].token,i);
 const r=(await f.s.identities.view(f.accounts[0].token)).room;await f.command(0,'room_close',{roomId:r.id,expectedRevision:r.revision});
 assert.equal((await f.s.identities.homeAgentContext(f.accounts[1].token)).travelEpoch,before.travelEpoch+2);
 }finally{await f.s.close();}
});

test('manual requests wait for an existing patrol and suppress another patrol without duplicate model work',async()=>{
 const f=await fixture();try{
 const entered=f.hold(),input=await f.payload(0),patrol=f.s.agents.automatic(f.accounts[0].token,'steward',input);await entered;
 const request={theme:'pixel',requestId:randomUUID(),message:'请继续我的手动委托'};await f.s.agents.submit(f.accounts[0].token,request);
 await new Promise(r=>setTimeout(r,30));assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,'steward');
 await assert.rejects(f.s.agents.automatic(f.accounts[0].token,'steward',input),e=>e.code==='automatic_cooldown'&&e.retryAfter===60);
 f.release();await patrol;await f.s.agents.wait(f.accounts[0].token,request);assert.equal(f.calls.length,2);assert.equal(f.calls[1].method,'command');
 }finally{f.release();await f.s.close();}
});
