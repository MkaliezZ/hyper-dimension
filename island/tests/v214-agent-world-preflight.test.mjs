import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';

for(const theme of ['pixel','origami'])test(theme+' an identity-less legacy world cannot strand a manual request before provider launch',async()=>{
 await mkdir('qa/v214',{recursive:true});const directory=await mkdtemp(resolve('qa/v214/preflight-')),calls=[];
 const service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-WORLD-PREFLIGHT',agentRuntimeFactory:({directory})=>({documents:resolve(directory,'documents'),async call(method,args){if(method==='command'){calls.push(args);return{source:'hermes',answer:'受控执行回复',commands:[],operations:[]};}return{hermes:{configured:true}};},async close(){}})});
 try{
  const account=await service.identities.register({login:'world_'+theme,password:'fictional-preflight-password',name:'异常档案测试岛主',islandName:'身份校验岛',avatar:'male_0',theme});
  const tenant=await service.tenants.get(account.token);
  // Deliberately bypass tenant bootstrap to represent a malformed legacy fixture.
  // Ordinary new islands must use service.tenants.open, which assigns their identity.
  await tenant.saves.open(theme,{});const original=await tenant.saves.current(theme);assert.equal(original.state.saveSlot,undefined);
  const input={theme,requestId:randomUUID(),message:'核对一项手动委托'};
  await assert.rejects(service.agents.submit(account.token,input),e=>e.code==='lan_travel_home');
  const file=resolve(directory,'_lan/agents',account.view.me.id,'conversation.json');
  let journal;try{journal=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;journal={jobs:[]};}
  assert.deepEqual(journal.jobs,[],'A failed preflight must not consume the request ID or leave a running journal');
  assert.equal(calls.length,0);assert.equal((await tenant.saves.current(theme)).version,original.version);
  // Explicitly restart only this disposable malformed fixture through the normal authority.
  const repaired=(await tenant.saves.restartClient(theme,{requestId:randomUUID(),expectedVersion:original.version})).document;assert.equal(typeof repaired.state.saveSlot,'string');
  const result=await service.agents.wait(account.token,{...input,saveSlot:repaired.state.saveSlot});assert.equal(result.source,'hermes');assert.equal(calls.length,1);assert.equal(calls[0].saveSlot,repaired.state.saveSlot);
  await service.agents.wait(account.token,{...input,saveSlot:repaired.state.saveSlot});assert.equal(calls.length,1);
  const saved=JSON.parse(await readFile(file,'utf8'));assert.equal(saved.jobs.length,1);assert.equal(saved.jobs[0].status,'completed');assert.equal(saved.jobs[0].worldKey,repaired.state.saveSlot);
 }finally{await service.close();}
});
