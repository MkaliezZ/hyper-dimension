import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import {createLanHttpServer} from '../server/lanServer.mjs';import {spawnSync} from 'node:child_process';
async function fixture(){
 await mkdir('qa/v65',{recursive:true});const directory=await mkdtemp(resolve('qa/v65/authority-')),calls=[],runtimes=[];
 const factory=({directory,ownerId})=>{const runtime={documents:resolve(directory,'documents'),async call(method,args){if(method==='status')return{hermes:{configured:true,model:'fixture-only'}};if(method==='command'){calls.push({ownerId,directory,args});await new Promise(r=>setTimeout(r,50));return{source:'hermes',answer:'回复 '+args.message,operations:[],ledgerRunId:randomUUID()};}return{ownerId};},async close(){}};runtimes.push(runtime);return runtime;};
 const s=await createLanHttpServer({directory,port:0,enrollmentKey:'AGENT-FIXTURE',agentRuntimeFactory:factory}),accounts=[];
 for(let n=0;n<2;n++){const a=await s.identities.register({login:'agent_'+n,password:'fixture-password',name:'管家岛主'+n,islandName:'账号独立岛'+n,avatar:'male_'+n,theme:'pixel'});await s.tenants.open(a.token,'pixel',{});accounts.push(a);}
 const req=async(n,path,data,extra={})=>{const a=accounts[n],r=await fetch('http://127.0.0.1:'+s.port+path,{method:data?'POST':'GET',headers:{Cookie:'hd_lan_session='+a.token,'X-HD-Island':a.view.me.id,...(data?{'Content-Type':'application/json'}:{}),...extra},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};};
 return{s,accounts,calls,runtimes,req,directory};
}
test('two owners have independent runtimes, durable request replay and private history across visiting',async()=>{
 const f=await fixture();try{
 const a={theme:'pixel',requestId:randomUUID(),message:'我的私人便笺甲'};
 const [r,replay]=await Promise.all([f.req(0,'/api/lan/steward',a),f.req(0,'/api/lan/steward',a)]);assert.equal(r.status,202);assert.equal(replay.status,202);
 await f.s.agents.wait(f.accounts[0].token,a);assert.equal(f.calls.length,1);
 assert.equal((await f.req(0,'/api/lan/steward',{...a,message:'篡改'})).status,409);
 const b={theme:'pixel',requestId:randomUUID(),message:'我的私人便笺乙',history:[{role:'user',content:'伪造别人的历史'}],ownerId:f.accounts[0].view.me.id};
 await f.s.agents.wait(f.accounts[1].token,b);assert.equal(f.calls.length,2);assert.notEqual(f.calls[0].directory,f.calls[1].directory);assert.equal(f.calls[1].args.history.length,0);assert.equal(f.calls[1].args.ownerId,undefined);
 const aview=(await f.req(0,'/api/lan/steward?theme=pixel')).data,bview=(await f.req(1,'/api/lan/steward?theme=pixel')).data;
 assert.equal(aview.jobs.length,1);assert(!JSON.stringify(bview).includes(a.message));assert.notEqual(aview.documents,bview.documents);
 assert.equal((await f.req(0,'/api/lan/steward?theme=pixel',null,{'X-HD-Island':f.accounts[1].view.me.id})).status,409);
 const room=await f.s.identities.action(f.accounts[0].token,{operation:'room_create',title:'随行管家验证',maxPlayers:2,requestId:randomUUID()});
 await f.s.identities.action(f.accounts[1].token,{operation:'room_join',code:room.view.room.code,requestId:randomUUID()});
 await f.s.agents.wait(f.accounts[1].token,{theme:'pixel',message:'继续上一次的话题',requestId:randomUUID(),residents:[{id:0}],built:[{id:1}]});
 assert(f.calls[2].args.history.some(m=>m.content===b.message));assert.deepEqual(f.calls[2].args.residents,[]);assert.deepEqual(f.calls[2].args.built,[]);
 const roomView=await f.s.identities.view(f.accounts[0].token);assert(!JSON.stringify(roomView).includes(b.message));assert.equal((await f.s.agents.view(f.accounts[1].token,'pixel')).jobs.at(-1).location,'visit');
 const other=await f.req(1,'/api/workbench/pixel');assert.equal(other.data.ownerId,f.accounts[1].view.me.id);
 }finally{await f.s.close();}
});
test('restarted unconfirmed operation is retained and never automatically rerun',async()=>{
 const f=await fixture();let s2;try{
 const request={theme:'pixel',message:'记录重启之前的委托',requestId:randomUUID()};await f.s.agents.wait(f.accounts[0].token,request);await f.s.close();
 const file=resolve(f.directory,'_lan/agents',f.accounts[0].view.me.id,'conversation.json'),doc=JSON.parse(await readFile(file,'utf8'));doc.jobs[0].status='running';delete doc.jobs[0].result;await writeFile(file,JSON.stringify(doc));
 let calls=0;s2=await createLanHttpServer({directory:f.directory,port:0,enrollmentKey:'AGENT-FIXTURE',agentRuntimeFactory:()=>({documents:'fixture',async call(method){if(method==='command')calls++;return{hermes:{configured:true}};},async close(){}})});
 const login=await s2.identities.login({login:'agent_0',password:'fixture-password'}),job=await s2.agents.submit(login.token,request);
 assert.equal(job.status,'unconfirmed');assert.equal(calls,0);await assert.rejects(s2.agents.wait(login.token,request),e=>e.code==='lan_agent_unconfirmed');
 }finally{await s2?.close();}
});
test('real document worker enforces per-owner root for read, write, list and symlink targets',async()=>{
 await mkdir('qa/v65',{recursive:true});const dir=await mkdtemp(resolve('qa/v65/documents-')),a=resolve(dir,'alice'),b=resolve(dir,'bob');await mkdir(a);await mkdir(b);await writeFile(resolve(b,'private.txt'),'private peer data');
 const python=resolve(process.env.LOCALAPPDATA,'hermes/hermes-agent/venv/Scripts/python.exe');
 const call=(operation,args)=>{const r=spawnSync(python,['server/document_worker.py'],{input:JSON.stringify({operation,args}),encoding:'utf8',windowsHide:true,env:{...process.env,HD_DOCUMENT_ROOT:a,TERMINAL_CWD:a,HD_ARTIFACT_DIR:resolve(dir,'artifacts'),HD_DOCUMENT_MODE:'manual',PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 assert.equal(call('write',{path:'note.txt',content:'只属于甲的文档'}).success,true);
 assert.match(call('read',{path:'note.txt'}).content,/只属于甲/);
 for(const [op,args] of [['read',{path:resolve(b,'private.txt')}],['write',{path:'../bob/new.txt',content:'bad'}],['list',{path:b}]]){const r=call(op,args);assert.equal(r.success,false);assert.match(r.error,/工作区/);}
 const {symlink}=await import('node:fs/promises');await symlink(b,resolve(a,'linked'),'junction');
 assert.equal(call('read',{path:resolve(a,'linked/private.txt')}).success,false);
 assert(!JSON.stringify(call('list',{path:a,recursive:true})).includes('private.txt'));
});

test('a selected native session is part of the durable replay identity',async()=>{
 const f=await fixture();try{
  const request={theme:'pixel',requestId:'native-session-fixture',message:'继续此前选择的工作',resumeSessionId:'hd-island-'+ 'a'.repeat(32)};
  assert.equal((await f.req(0,'/api/lan/steward',request)).status,202);await new Promise(r=>setTimeout(r,100));
  assert.equal((await f.req(0,'/api/lan/steward',request)).status,202);
  assert.equal((await f.req(0,'/api/lan/steward',{...request,resumeSessionId:'hd-island-'+ 'b'.repeat(32)})).status,409);
  const own=f.calls.filter(c=>c.ownerId===f.accounts[0].view.me.id);assert.equal(own.length,1);assert.equal(own[0].args.resumeSessionId,request.resumeSessionId);
  assert.equal((await f.req(0,'/api/lan/steward',{...request,requestId:'invalid-context-fixture',resumeSessionId:{path:'outside'}})).status,400);
 }finally{await f.s.close();}
});
