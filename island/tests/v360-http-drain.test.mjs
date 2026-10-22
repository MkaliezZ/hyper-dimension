import test from 'node:test';
import assert from 'node:assert/strict';
import {Agent,get,request} from 'node:http';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createDrainingHttpServer} from '../server/httpDrain.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',r));

test('shutdown drains an accepted response while a browser keeps polling its old connection',{timeout:3000},async()=>{
 const entered=deferred(),agent=new Agent({keepAlive:true,maxSockets:1});let polling=true,requests=0;
 const {server,close}=createDrainingHttpServer(async(req,res)=>{requests++;entered.resolve();await delay(15);res.writeHead(200,{'Cache-Control':'no-store'}).end('accepted response');});
 await listen(server);const port=server.address().port,first=deferred();
 function poll(){if(!polling)return;get({host:'127.0.0.1',port,path:'/',agent},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>{first.resolve(text);if(polling)setTimeout(poll,10);});}).on('error',()=>{});}
 try{poll();await entered.promise;const result=await Promise.race([close().then(()=>true),delay(250).then(()=>false)]);assert(result,'an old keep-alive browser must not hold shutdown open');assert.equal(await first.promise,'accepted response');assert(requests>=1);}
 finally{polling=false;agent.destroy();server.closeAllConnections();await close();}
});

test('a disconnected response cannot release shutdown before its accepted disk write finishes',{timeout:3000},async()=>{
 await mkdir('qa/v360',{recursive:true});const directory=await mkdtemp(resolve('qa/v360/drain-')),file=join(directory,'accepted.txt'),entered=deferred(),commit=deferred();let closed=false;
 const {server,close}=createDrainingHttpServer(async(req,res)=>{entered.resolve();await commit.promise;await writeFile(file,'committed exactly once');res.end('saved');});await listen(server);
 const client=request({host:'127.0.0.1',port:server.address().port,method:'POST',path:'/'},res=>res.resume());client.on('error',()=>{});client.end('accepted');await entered.promise;client.destroy();await delay(15);
 const done=close().then(()=>closed=true);
 try{await delay(30);assert.equal(closed,false,'the accepted handler still owns its pending write');commit.resolve();await done;assert.equal(await readFile(file,'utf8'),'committed exactly once');}
 finally{commit.resolve();client.destroy();server.closeAllConnections();await done;}
});

test('repeated shutdown calls share one drain and keep a complete response',{timeout:3000},async()=>{
 const {server,close}=createDrainingHttpServer((req,res)=>res.end('ok'));await listen(server);const port=server.address().port;
 assert.equal(await new Promise((resolve,reject)=>get('http://127.0.0.1:'+port,res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve(text));}).on('error',reject)),'ok');
 const first=close();assert.equal(close(),first);await first;assert.equal(server.listening,false);
});
