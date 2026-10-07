import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createProject} from '../src/projectPlans.js';
import {recruitmentContext,validateRecruitmentRun} from '../server/recruitmentStore.mjs';
await mkdir('qa/v28',{recursive:true});
const directory=await mkdtemp(resolve('qa/v28/hermes-live-'));
process.env.HD_HERMES_HOME=resolve(directory,'home');process.env.HD_STEWARD_WORKDIR=resolve(directory,'documents');
const {recruitmentRun}=await import('../server/agentService.mjs');
const report={directory,kind:'actual Hermes parent and child planning; game arrival is a separate acceptance gate'};
try{
 const s=hydrateTown(createState());for(const id of Object.keys(s.inventory))s.inventory[id]=0;
 s.saveSlot='recruitment-live-test';
 const p=createProject(s,{id:'live-welcome',title:'码头迎宾灯',targets:{lantern:1}});assert(p.ok,p.reason);
 const context=recruitmentContext({theme:'pixel',state:s},p.project.id);
 const run=await recruitmentRun(context,'live-recruitment');
 validateRecruitmentRun(run,context);
 assert(run.parent.usage.total>0);assert(run.child.usage.total>0);
 report.run=run;report.passed=true;
 console.log(JSON.stringify({passed:true,model:run.model,parent:run.parent.id,child:run.child.id,accepted:run.child.acceptedSteps,parentTokens:run.parent.usage,childTokens:run.child.usage,tools:run.tools}));
}catch(e){report.failure=e.message;process.exitCode=1;console.log(JSON.stringify({passed:false,error:e.message}))}
finally{await writeFile(resolve(directory,'result.json'),JSON.stringify(report,null,2));await writeFile('qa/v28/hermes-live.json',JSON.stringify(report,null,2));process.exit(process.exitCode||0)}
