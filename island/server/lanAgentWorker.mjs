// One process per authenticated island owner; singleton services stay inside it.
import {agentStatus,steward,decideBatch,converse,collaborate,recruitmentRun,cancelRecruitmentRun,suggestParty,stopAgentWorkers} from './agentService.mjs';
import {workbench} from './workbenchService.mjs';
import {runLedger} from './runLedger.mjs';
const methods={
 status:async()=>({...agentStatus(),automaticRequests:(await runLedger.snapshot()).channels}), command:args=>steward({...args,automatic:false}),
 recruit:args=>recruitmentRun(args.context,args.id),cancelRecruit:args=>cancelRecruitmentRun(args.id),suggestParty:args=>suggestParty(args),
 a2a:args=>collaborate(args),plans:args=>decideBatch(args),conversations:args=>converse(args),steward:args=>steward({...args,automatic:true}),policy:args=>runLedger.setPolicy(args),
 list:args=>workbench.list(args.theme), project:args=>workbench.project(args.theme,args.input),
 detail:args=>workbench.detail(args.id), preview:args=>workbench.preview(args.id,args.offset||1),
 download:async args=>{const r=await workbench.download(args.id);return {metadata:r.metadata,base64:r.bytes.toString('base64')}},
 ledger:()=>runLedger.snapshot()
};
let closing=false;
process.on('message',async m=>{
 if(m.method==='close'){closing=true;await stopAgentWorkers();process.exit(0);}
 if(closing)return;
 try{if(!Object.hasOwn(methods,m.method))throw Error('Unsupported runtime operation');const value=await methods[m.method](m.args||{});process.send?.({id:m.id,value})}
 catch(e){process.send?.({id:m.id,error:{message:e.message,code:e.code,status:e.status,retryAfter:e.retryAfter}})}
});
process.on('disconnect',async()=>{await stopAgentWorkers();process.exit(0)});
