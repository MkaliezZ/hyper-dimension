import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {request} from 'playwright-core';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {postLanFixture} from './lanRequest.mjs';

async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;}
async function close(server){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}

test('a reset after durable room creation replays one immutable command and returns the same room',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'hd-lan-lost-reply-'));
 const service=await createLanHttpServer({directory,port:0,enrollmentKey:'FICTIONAL-RESET-TEST'}),base='http://127.0.0.1:'+service.port;
 const account=await service.identities.register({login:'lost_reply_fixture',password:'fictional-reset-password',name:'测试岛主',islandName:'断线测试岛',avatar:'female_1',theme:'pixel'});
 const received=[],results=[],proxy=createServer(async(req,res)=>{
  try{let body='';for await(const b of req)body+=b;
   received.push(JSON.parse(body));
   const response=await fetch(base+'/api/lan/action',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'hd_lan_session='+account.token},body}),text=await response.text();
   assert.equal(response.status,200,text);results.push(JSON.parse(text));
   if(results.length===1){req.socket.destroy();return;}
   res.writeHead(response.status,{'Content-Type':'application/json'}).end(text);
  }catch(e){res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message}));}
 });
 let client;
 try{const url=await listen(proxy);client=await request.newContext();const data={operation:'room_create',requestId:randomUUID(),title:'丢失回包之后的同一房间',maxPlayers:4};
  const {response,trace}=await postLanFixture(client,url,{data});const result=await response.json();
  assert.deepEqual(trace,[]);assert.equal(received.length,2);assert.deepEqual(received,[data,data]);
  assert.equal(results[0].replayed,false);assert.equal(result.replayed,true);assert.equal(result.roomId,results[0].roomId);
  const view=await service.identities.view(account.token);assert.equal(view.room.id,result.roomId);
 }finally{await client?.dispose();await close(proxy);await service.close();}
});

test('authentication, invalid input and unknown server errors fail on their first HTTP response',async()=>{
 const calls=[],server=createServer(async(req,res)=>{for await(const b of req){}calls.push(req.url);const status=Number(req.url.slice(1));res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify({code:status===503?'unexpected_failure':'lan_invalid',error:'explicit fixture rejection'}));});
 const base=await listen(server),client=await request.newContext();
 try{for(const status of [401,403,400,503]){await assert.rejects(postLanFixture(client,base+'/'+status,{data:{requestId:randomUUID()}}),e=>e.message.includes('explicit fixture rejection')&&e.message.includes('"status":'+status));}
  assert.deepEqual(calls,['/401','/403','/400','/503']);
 }finally{await client.dispose();await close(server);}
});
