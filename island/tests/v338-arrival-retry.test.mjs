import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
import {requestLanCommand} from '../src/lanCommandRetry.js';
const input=()=>({operation:'room_join',code:'FICTIONAL000',entry:'harbor',requestId:'original-arrival-request'});
test('arrival busy, transport loss and truncated JSON retry the identical durable arrival envelope',async()=>{
 for(const error of [Object.assign(Error('busy'),{status:503,code:'lan_busy'}),new TypeError('transport'),new SyntaxError('truncated'),Object.assign(Error('deadline'),{name:'TimeoutError'})]){
  const body=input(),calls=[],waits=[],receipt={replayed:true,view:{room:{id:'fictional-room'}}};
  const result=await requestLanCommand(async(path,value)=>{assert.equal(path,'action');assert.equal(value,body);calls.push(structuredClone(value));if(calls.length<3)throw error;return receipt;},body,{sleep:async ms=>waits.push(ms)});
  assert.equal(result,receipt);assert.equal(calls.length,3);assert(calls.every(call=>JSON.stringify(call)===JSON.stringify(body)));assert.deepEqual(waits,[300,800]);
 }
});
test('arrival exhaustion remains recoverable and invalid, full, expired or changed-room failures are not retried',async()=>{
 for(const[error,count]of [[new TypeError('offline'),3],[Object.assign(Error('invalid invitation'),{status:404,code:'lan_room_missing'}),1],[Object.assign(Error('full'),{status:409,code:'lan_room_full'}),1],[Object.assign(Error('expired'),{status:401,code:'lan_unauthorized'}),1],[Object.assign(Error('changed'),{status:409,code:'lan_id_conflict'}),1]]){
  let calls=0;const body=input();await assert.rejects(requestLanCommand(async()=>{calls++;throw error;},body,{sleep:async()=>{}}),e=>e===error);assert.equal(calls,count);assert.equal(body.requestId,'original-arrival-request');
 }
});
test('host creation and chat still require the original explicit recovery policy',async()=>{
 for(const operation of ['room_create','room_chat']){let calls=0;await assert.rejects(requestLanCommand(async()=>{calls++;throw new TypeError('offline');},{...input(),operation},{sleep:async()=>{}}));assert.equal(calls,1);}
});
test('actual HTTP arrival retries a busy writer and a lost post-commit reply without duplicating the guest or receipt',async()=>{
 const {createLanHttpServer}=await import(pathToFileURL(join(root,'server/lanServer.mjs'))),out=join(root,'qa/v338/arrival-retry');await mkdir(out,{recursive:true});
 const directory=await mkdtemp(join(out,'fictional-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ARRIVAL-RECEIPT-ONLY'}),base='http://127.0.0.1:'+service.port;
 const report={scope:'Real server HTTP transaction and lost-reply transport using fictional identities. No browser, model calls, physical devices or full four-map qualification.',attempts:[],passed:false,wholeGoalComplete:false};
 try{
  const accounts=[];for(let n=0;n<2;n++){const account=await service.identities.register({login:'arrival_'+n,password:'fictional-password-only',name:'虚构岛主'+n,islandName:'虚构测试岛'+n,avatar:'male_0',theme:'origami'});accounts.push(account);await service.tenants.open(account.token,'origami',{});}
  const host=await service.identities.action(accounts[0].token,{operation:'room_create',title:'虚构登岛回执测试',maxPlayers:4,requestId:'fictional-create-room'}),code=host.view.room.code;
  const before=service.identities.action.bind(service.identities);let attempt=0;
  const handlers=service.server.listeners('request');service.server.removeAllListeners('request');
  service.server.on('request',(req,res)=>{
   if(req.url==='/api/lan/action'&&req.method==='POST'){
    attempt++;
    if(attempt===1){req.resume();res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Fictional busy writer',code:'lan_busy'}));return;}
    if(attempt===2){res.end=function(chunk){assert.equal(this.statusCode,200);const bytes=Buffer.from(chunk);assert(bytes.length>32);this.write(bytes.subarray(0,16));this.flushHeaders();setTimeout(()=>this.destroy(),5);return this;};}
   }
   for(const listener of handlers)listener.call(service.server,req,res);
  });
  const body={operation:'room_join',code,entry:'harbor',requestId:'original-actual-arrival'},request=async(path,value)=>{
   const response=await fetch(base+'/api/lan/'+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:'hd_lan_session='+accounts[1].token},body:JSON.stringify(value),signal:AbortSignal.timeout(12000)});
   report.attempts.push({body:structuredClone(value),status:response.status});const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error),{code:result.code,status:response.status});return result;
  };
  const result=await requestLanCommand(request,body);assert.equal(result.replayed,true);assert.equal(attempt,3);assert.equal(result.view.room.members.length,2);assert.equal(result.view.room.members.filter(m=>m.id===accounts[1].view.me.id).length,1);assert(report.attempts.every(a=>JSON.stringify(a.body)===JSON.stringify(body)));
  const doc=JSON.parse(await readFile(join(directory,'_lan/identity.json'),'utf8'));assert.equal(doc.requests.filter(r=>r.id===body.requestId).length,1);assert.equal(doc.events.filter(e=>e.type==='room_join'&&e.accountId===accounts[1].view.me.id).length,1);
  const replay=await before(accounts[1].token,body);assert.equal(replay.replayed,true);assert.equal(replay.view.room.members.length,2);report.sameIdServerReplay=true;report.singleJournalReceipt=true;report.singleArrivalEvent=true;report.guestCount=2;report.passed=true;
 }finally{await service.close();await writeFile(join(directory,'transport-report.json'),JSON.stringify(report,null,2)+'\n');}
});
