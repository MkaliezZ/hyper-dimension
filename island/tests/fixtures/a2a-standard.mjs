import assert from 'node:assert/strict';
import {mkdtemp,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../../server/lanServer.mjs';
import {A2A_EXTENSION} from '../../server/a2aGateway.mjs';
import {seedLegacyAuthority} from './trusted-initial-state.mjs';
import {DEFAULT_RECIPES} from '../../src/contentCatalog.js';
export async function standardFixture({gate=async()=>{},event=false}={}){
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-standard-a2a-')),calls=[];let clock=1800000000000,service;
 const runtime=({ownerId})=>({documents:'PRIVATE_DOCUMENT_DIRECTORY',async call(method,p){if(method==='status')return {hermes:{configured:true}};assert.equal(method,'a2a');calls.push({ownerId,p});await gate();return {source:'hermes',ledgerRunId:'run-'+randomUUID(),runId:'provider-'+randomUUID(),reply:{decision:p.stage==='exchange'?'share':p.stage==='offer'?'propose':p.stage==='confirm'?'confirm':p.preparation.ready?'accept':'clarify',message:p.stage==='exchange'?p.sharedContext.islandName+'正在邀请朋友认识本岛的职业和设施。':'管家按实际准备条件核对本次活动。'}};},async close(){}});
 const start=()=>createLanHttpServer({directory,port:0,enrollmentKey:'STANDARD-A2A-FIXTURE',agentRuntimeFactory:runtime,now:()=>clock});service=await start();const users=[];
 try{for(let n=0;n<3;n++){const theme=n===1?'origami':'pixel',a=await service.identities.register({login:'standard_'+n,password:'fictional-password',name:'协议岛主'+n,islandName:'协议小岛'+n,avatar:'male_'+n,theme});if(event)await seedLegacyAuthority(service.tenants,a.token,theme);await service.tenants.open(a.token,theme,{});
  if(event){const c=await service.tenants.get(a.token),d=await c.saves.current(theme),state=structuredClone(d.state);state.coins=100;state.inventory.wood=3;Object.assign(state.inventory,Object.fromEntries(Object.keys(DEFAULT_RECIPES[1].cost).map(k=>[k,10])));await c.saves.save(theme,{state,expectedVersion:d.version});}
  users.push({...a,id:a.view.me.id,theme});}
 const room=(await service.identities.action(users[0].token,{operation:'room_create',requestId:randomUUID(),title:'标准管家交流测试',maxPlayers:4})).view.room;await service.identities.action(users[1].token,{operation:'room_join',requestId:randomUUID(),code:room.code});
 let eventId;if(event){const r=await service.activities.action(users[0].token,{operation:'publish',requestId:randomUUID(),roomId:room.id,title:'标准协议茶会',kind:'tea',brief:'确认实际准备',invitees:[users[1].id],requirements:{items:[{item:'wood',quantity:2}],garment:null},prepareSeconds:60,difficulty:1,minQuality:55,economyMode:'funded',deliveryMode:'transfer'});eventId=r.eventId;await service.activities.action(users[1].token,{operation:'respond',requestId:randomUUID(),eventId,response:'accepted'});}
 return {directory,users,room,eventId,calls,get service(){return service;},get base(){return 'http://127.0.0.1:'+service.port;},advance:ms=>clock+=ms,async enable(operation='information_preference'){for(let n=0;n<2;n++)await service.collaboration.action(users[n].token,{operation,receive:true,requestId:randomUUID()});},async rpc(n,method,params={},headers={}){const response=await fetch('http://127.0.0.1:'+service.port+'/api/lan/a2a',{method:'POST',headers:{'Content-Type':'application/a2a+json','A2A-Version':'1.0',Authorization:'Bearer '+users[n].token,...headers},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});return {response,data:await response.json()};},async restart(){await service.close();service=await start();},close:()=>service.close()};
 }catch(e){await service.close();throw e;}
}
export function sendParams(f,{messageId=randomUUID(),taskId,contextId,text='请介绍本岛设施与同行居民。',recipient=1,capability='island.information',action,configuration}={}){return {message:{messageId,role:'ROLE_USER',parts:[{text}],...(taskId?{taskId}:{}),...(contextId?{contextId}:{}),metadata:{[A2A_EXTENSION]:taskId?(action?{action}:{}):{recipientId:f.users[recipient].id,capability,...(capability==='event.checkin'?{eventId:f.eventId}:{})}}},...(configuration?{configuration}:{})};}
export async function successful(f,n,method,params){const {response,data}=await f.rpc(n,method,params);assert.equal(response.status,200);assert.equal(data.error,undefined,JSON.stringify(data.error));return data.result;}
