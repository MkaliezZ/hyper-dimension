import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
if(process.env.HD_QA_REAL_SOCIAL!=='1')throw Error('Explicitly set HD_QA_REAL_SOCIAL=1 for real paid provider verification.');
await import('../server/runtimeConfig.mjs');assert(process.env.DEEPSEEK_API_KEY,'Configure your private provider key before this verification.');
const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/real-travel-social');await mkdir(out,{recursive:true});
const {createLanHttpServer}=await import('../server/lanServer.mjs');
const report={sourceRelease:JSON.parse(await readFile(join(root,'release-manifest.json'),'utf8')).release,scope:'Two fictional zero-resource accounts per style, required personal stewards and a consenting permanent resident. Canonical server harbor/roads and resident meeting; actual owner-routed Flash conversation, origin-bound history, return and service restart. Transport time is an explicit injected clock held while the real provider responds; not real-time cadence, physical devices, human acceptance or a recruitment proof. No original browser/save/documents. Credentials and raw provider replies are never published by this runner; an operator may configure a private capture endpoint separately.',clockInjected:true,initialResourcesSynthetic:false,modelsCalled:true,modelResponsesSynthetic:false,humanAcceptance:false,cases:[],passed:false};
const save=()=>writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
try{
 for(const theme of ['pixel','origami']){
  let now=Date.now(),service;const directory=await mkdtemp(join(out,theme+'-fictional-')),row={theme,passed:false};report.cases.push(row);
  const start=()=>createLanHttpServer({directory,port:0,enrollmentKey:'FICTIONAL-SOCIAL-ONLY',now:()=>now});
  try{
   service=await start();const users=[];
   for(let n=0;n<2;n++){const u=await service.identities.register({login:'social_'+n,password:'fictional-social-password',name:'虚构访客'+n,islandName:'虚构交流岛'+n,theme,avatar:'female_'+n});users.push({...u,id:u.view.me.id});await service.tenants.open(u.token,theme,{});const c=await service.tenants.get(u.token),d=await c.saves.current(theme);assert.equal(d.state.coins,0);assert(Object.values(d.state.inventory).every(n=>n===0));}
   const action=(n,operation,args={})=>service.identities.action(users[n].token,{operation,requestId:randomUUID(),...args});
   await action(1,'travel_invite',{npcId:0});const room=(await action(0,'room_create',{title:'来访居民交流验证',maxPlayers:2})).view.room;await action(1,'room_join',{code:room.code});
   const v=await service.identities.view(users[0].token),guest=v.room.members.find(m=>m.id===users[1].id);assert.equal(guest.travel.members[0].kind,'hermes');assert(guest.travel.members.some(p=>p.kind==='ai'&&p.npcId===0));row.requiredStewardAndConsentingResident=true;
   let event;const deadline=Date.now()+180000;
   for(let i=0;i<240&&Date.now()<deadline;i++){
    const current=await service.social.view(users[0].token);
    if(current.events.length){event=current.events[0];break;}
    if(current.task?.status==='failed')throw Error('Real social generation failed: '+current.task.error);
    if(current.task?.status!=='thinking'){now+=1000;for(const u of users)await service.identities.view(u.token);await service.social.tick(users[0].token);}
    else {i--;await new Promise(r=>setTimeout(r,250));}
   }
   assert(event,'Actual visitor/host conversation did not finish');assert.equal(event.source,'deepseek');assert.equal(event.model,'deepseek-flash');assert(event.ledgerRunId);assert.equal(new Set(event.people.map(p=>p.ownerAccountId)).size,2);assert.equal(event.people.length,2);assert(event.lines.length>=2);assert(event.lines.every(l=>event.people.some(p=>p.actorId===l.actorId)));
   row.event={id:event.id,type:event.type,summary:event.summary,people:event.people.map(p=>({npcId:p.npcId,ownerIndex:users.findIndex(u=>u.id===p.ownerAccountId),homeTheme:p.homeTheme,actorId:p.actorId})),lineCount:event.lines.length,changes:event.changes,source:event.source,model:event.model,ledgerRunId:event.ledgerRunId};
   for(const person of event.people){const n=users.findIndex(u=>u.id===person.ownerAccountId),h=await service.social.history(users[n].token,person.npcId,person.homeTheme);assert(h.events.some(e=>e.id===event.id));const c=await service.tenants.get(users[n].token),d=await c.saves.current(person.homeTheme);assert.equal(d.state.coins,0);assert(Object.values(d.state.inventory).every(n=>n===0));}
   const ledger=await service.agents.work(users[0].token,'ledger',{}),run=ledger.runs.find(r=>r.id===event.ledgerRunId);assert(run&&run.phase==='completed'&&run.model==='deepseek-flash');row.actualOwnerLedgerMatched=true;
   const leave=await service.identities.view(users[1].token);await action(1,'room_leave',{roomId:room.id,expectedRevision:leave.room.revision});await service.close();service=await start();
   for(const person of event.people){const n=users.findIndex(u=>u.id===person.ownerAccountId);assert((await service.social.history(users[n].token,person.npcId,person.homeTheme)).events.some(e=>e.id===event.id));}
   row.originHistorySurvivesReturnAndRestart=true;row.passed=true;
  }catch(error){row.failure=error.stack;throw error;}
  finally{await service?.close();await save();}
 }
 report.passed=report.cases.length===2&&report.cases.every(c=>c.passed);
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{report.completedOwnerRuns=report.cases.filter(c=>c.actualOwnerLedgerMatched).length;await save();console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,failure})=>({theme,passed,failure})),completedOwnerRuns:report.completedOwnerRuns}));}
