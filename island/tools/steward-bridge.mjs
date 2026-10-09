#!/usr/bin/env node
import {createDeviceBridgeClient} from '../server/deviceBridgeClient.mjs';
import {resolve} from 'node:path';import {createHash} from 'node:crypto';import {setTimeout as delay} from 'node:timers/promises';
const value=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
if(process.argv.includes('--help')){console.log('node tools/steward-bridge.mjs --server=https://GAME --workspace=YOUR_FOLDER --pair-code=HD-CODE [--state-dir=PRIVATE_FOLDER] [--name=DEVICE_NAME]\nAfter the first pairing, omit --pair-code and reuse the same state directory. Trusted local LAN demos may explicitly add --allow-insecure-lan.');process.exit(0);}
const server=value('server'),workspace=value('workspace');if(!server||!workspace){console.error('请提供 --server 和 --workspace；首次连接同时提供游戏内配对码 --pair-code。');process.exit(2);}
const suffix=createHash('sha256').update(server+'\n'+resolve(workspace)).digest('hex').slice(0,20),directory=resolve(value('state-dir')||resolve(import.meta.dirname,'../data/device-clients',suffix));let client,stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stopping=true;});
try{
 client=await createDeviceBridgeClient({server,workspace,directory,pairCode:value('pair-code'),name:value('name'),allowInsecureLAN:process.argv.includes('--allow-insecure-lan')});
 console.log(JSON.stringify({message:'请在游戏中核对确认标记，并批准这台原机。',device:client.info.name,verification:client.info.verification,workspace:client.info.workspace}));let previous='';
 while(!stopping){try{const status=await client.tick();if(status.phase!==previous){previous=status.phase;console.log(JSON.stringify({status:status.phase,...(status.jobId?{request:status.jobId}:{})}));}}catch(e){if(['bridge_revoked','bridge_credential','bridge_client_receipt','bridge_job_fingerprint'].includes(e.code))throw e;const message=e.code||'connection_retry';if(previous!==message){previous=message;console.log(JSON.stringify({status:message,message:e.message}));}}await delay(2000);}
}catch(e){console.error(JSON.stringify({error:e.message,code:e.code||null}));process.exitCode=1;}finally{await client?.close();}
