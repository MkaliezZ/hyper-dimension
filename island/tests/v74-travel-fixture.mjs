import {seedLegacyAuthority} from './fixtures/trusted-initial-state.mjs';

import assert from 'node:assert/strict';import {mkdir,mkdtemp} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';import {createRecruitmentStore} from '../server/recruitmentStore.mjs';import {createProject,controlProject} from '../src/projectPlans.js';import {bindRecruitment} from '../src/recruitment.js';import {proof} from './v72-recruitment-fixture.mjs';
import {RESIDENTS,setWorldTheme} from '../src/world.js';import {createResidentRuntime} from '../src/residentRuntime.js';import {createRecruitmentRuntime} from '../src/recruitmentRuntime.js';import {followPath} from '../src/movement.js';
export async function fixture(theme='pixel',options={}){
 await mkdir('qa/v74',{recursive:true});const directory=await mkdtemp(resolve('qa/v74/travel-'));let now=Date.now();const calls=[];
 const openService=()=>createLanHttpServer({directory,port:0,socialFault:options.socialFault,enrollmentKey:'TEMP-TRAVEL-FIXTURE',now:()=>now,agentRuntimeFactory:()=>({documents:'fixture',async call(method,payload){if(method==='status')return{hermes:{configured:true}};if(method==='recruit'){calls.push({method,context:payload.context});return proof(payload.context);}assert.equal(method,'conversations');calls.push(payload);return{source:'deepseek',model:'deepseek-flash',ledgerRunId:'run-'+randomUUID(),type:'friendship',summary:'交流木作并约好分享新的见闻',lines:[{speaker:0,text:'你这里的木作空间很有意思。'},{speaker:1,text:'我也想了解你岛上的制作习惯。'},{speaker:0,text:'回岛后我要先做完答应的筹备工作。'},{speaker:1,text:'当然，下次带着新见闻再来。'}],changes:[{from:0,to:1,affinity:2,trust:1,tension:0},{from:1,to:0,affinity:3,trust:2,tension:0}]};},async close(){}})});
 let service=await openService();
 const accounts=[];for(let i=0;i<2;i++){const a=await service.identities.register({login:'partner_'+i,password:'fixture-password',name:'同行岛主'+i,islandName:'同行小岛'+i,theme,avatar:'male_'+i});accounts.push(a);await seedLegacyAuthority(service.tenants,a.token,theme);await service.tenants.open(a.token,theme,{});}
 const context=await service.tenants.get(accounts[1].token),store=createRecruitmentStore({directory:context.directory,now:()=>now});
 const update=async(fn,i=1)=>{const c=await service.tenants.get(accounts[i].token),d=await c.saves.current(theme),s=structuredClone(d.state);await fn(s);return c.saves.save(theme,{state:s,expectedVersion:d.version});};
 let doc=(await update(s=>{s.coins=40;s.freshStartPending=false;assert(createProject(s,{id:'travel-plan',title:'旅途后的码头木料',targets:{wood:6}}).ok);})).document;
 const read=()=>service.tenants.get(accounts[1].token).then(c=>c.saves.current(theme));doc=await read();
 let contract=(await store.start(theme,doc,{requestId:randomUUID(),projectId:'travel-plan',candidateId:'yan'})).contract;
 await store.complete(theme,contract.id,contract.attempt,proof(contract.context));contract=(await store.activate(theme,doc,contract.id)).contract;
 await update(s=>{assert(bindRecruitment(s,contract,theme).ok);});
 // Run the actual inbound boat, bridge and landing paths; no model or production shortcuts.
 await update(s=>{setWorldTheme(theme);const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0})),profile=i=>i===16?s.recruitment.active.profile:RESIDENTS[i];
 const resident=createResidentRuntime({npcs,getState:()=>s,profile,followPath,onChange(){},onEvent(){}}),recruit=createRecruitmentRuntime({state:()=>s,npcs,followPath,resident:()=>resident,visitors:()=>({boats:[],guests:[]}),onChange(){},onEvent(){}});
 recruit.reset();for(let i=0;i<9000&&!s.recruitment.active.hasArrived;i++)recruit.update(.1);assert(s.recruitment.active.hasArrived);assert.equal(s.recruitment.active.phase,'working');assert(controlProject(s,'travel-plan','pause').ok);
 s.npcPresence=(s.npcPresence||[]).filter(n=>n.id!==16);
 });
 const action=(i,operation,args={})=>service.identities.action(accounts[i].token,{operation,requestId:randomUUID(),...args});
 return{get service(){return service;},async restart(){await service.close();service=await openService();return service;},accounts,directory,theme,store,contract,update,read,action,calls,advance:ms=>now+=ms,async step(){now+=1000;for(const a of accounts)await service.identities.view(a.token);}};
}
export async function meet(f){for(let i=0;i<180;i++){await f.step();await f.service.social.tick(f.accounts[0].token);const v=await f.service.social.view(f.accounts[0].token);if(v.events.length)return v.events[0];await new Promise(r=>setTimeout(r,1));}throw Error('Temporary companion meeting not completed');}
