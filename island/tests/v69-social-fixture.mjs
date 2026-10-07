import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import {createLanHttpServer} from '../server/lanServer.mjs';import {worldWalkableForTheme} from '../src/world.js';
async function fixture(theme='pixel',gate=async()=>{}){
 await mkdir('qa/v68',{recursive:true});const directory=await mkdtemp(resolve('qa/v68/social-'));let now=Date.now(),service;const calls=[];
 const factory=()=>({documents:'fixture',async call(method,payload){if(method==='status')return {hermes:{configured:true}};assert.equal(method,'conversations');calls.push(payload);await gate();return {source:'deepseek',model:'deepseek-flash',ledgerRunId:'run-'+randomUUID(),type:'dispute',summary:'对布置方式有不同看法，愿意继续了解',lines:[{speaker:0,text:'我更看重实用，摆放时还要留出通道。'},{speaker:1,text:'我喜欢漂亮的陈列，但可以试试你的间距。'},{speaker:0,text:'刚才有些着急，我想先把顾虑讲清。'},{speaker:1,text:'我们还没完全一致，下次一起看实际效果。'}],changes:[{from:0,to:1,affinity:-2,trust:1,tension:6},{from:1,to:0,affinity:3,trust:2,tension:1}]};},async close(){}});
 const open=()=>createLanHttpServer({directory,port:0,enrollmentKey:'SOCIAL-FIXTURE-KEY',now:()=>now,agentRuntimeFactory:factory});service=await open();const accounts=[];
 for(let n=0;n<2;n++){const a=await service.identities.register({login:'social_'+n,password:'fixture-password',name:'相遇岛主'+n,islandName:'相遇小岛'+n,avatar:'male_'+n,theme});await service.tenants.open(a.token,theme,{});accounts.push(a);}
 const action=(n,operation,args={})=>service.identities.action(accounts[n].token,{operation,requestId:randomUUID(),...args});
 await action(1,'travel_invite',{npcId:0});const room=await action(0,'room_create',{title:'居民相遇测试',maxPlayers:2});await action(1,'room_join',{code:room.view.room.code});
 return {get service(){return service},accounts,calls,directory,roomId:room.roomId,action,async restart(){await service.close();service=await open()},async step(ms=1000){now+=ms;await service.identities.view(accounts[0].token);await service.identities.view(accounts[1].token)},advance(ms){now+=ms}};
}
async function meet(f){for(let i=0;i<170;i++){await f.step();await f.service.social.tick(f.accounts[0].token);const v=await f.service.social.view(f.accounts[0].token);if(v.task?.status==='thinking'||v.events.length)return v;await new Promise(r=>setTimeout(r,1));}throw Error('meeting did not arrive: '+JSON.stringify(await f.service.social.view(f.accounts[0].token)));}
async function complete(f){await meet(f);for(let i=0;i<100;i++){const v=await f.service.social.view(f.accounts[0].token);if(v.events.length)return v.events[0];await new Promise(r=>setTimeout(r,10));}throw Error('dialogue not completed');}

export {fixture,complete,meet};
