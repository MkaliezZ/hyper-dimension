import {createPortfolioStore} from './server/portfolioStore.mjs';
import {servePortfolio} from './server/portfolioHttp.mjs';
import {createEnvironmentService} from './server/environmentService.mjs';
import {createWorldSession,bindWorldStore} from './server/worldSession.mjs';
import {createResidentChatStore} from './server/residentChatStore.mjs';
import {manualPartyContext} from './server/manualPartyContext.mjs';
import {acquireDataLease} from './server/dataLease.mjs';
import {readJsonBody} from './server/httpBody.mjs';
import {createCoCreationStore} from './server/cocreationStore.mjs';
import {CO_CREATION_EXAMPLES} from './src/cocreation.js';
import {createSaveStore,MAX_SAVE_BYTES,MAX_IMPORT_BYTES} from './server/saveStore.mjs';
import {createPartyPlanningService} from './server/partyPlanningService.mjs';
import {createRecruitmentService} from './server/recruitmentService.mjs';
import {allowLocalAgentRequest} from './server/localAgentAccess.mjs';
import {runLedger} from './server/runLedger.mjs';
import {workbench} from './server/workbenchService.mjs';
import {DEEPSEEK_MODEL} from './server/modelPolicy.mjs';
import {agentStatus,decideBatch,converse,chatWithResident,steward,recruitmentRun,cancelRecruitmentRun,suggestParty,legacyDecision,stopAgentWorkers} from './server/agentService.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve(import.meta.dirname);
const dataLease=await acquireDataLease({directory:process.env.HD_SAVE_DIR||resolve(root,'data/saves'),mode:'runtime',sharedRuntime:true});
const environmentService=await createEnvironmentService({directory:process.env.HD_ENVIRONMENT_DIR||(process.env.HD_SAVE_DIR?resolve(process.env.HD_SAVE_DIR,'environment'):resolve(root,'data/environment'))});
const rawSaves=createSaveStore({directory:process.env.HD_SAVE_DIR||resolve(root,'data/saves')});
const worldSession=createWorldSession({directory:rawSaves.directory,saves:rawSaves}),saves=bindWorldStore(rawSaves,worldSession);
const portfolio=createPortfolioStore({directory:rawSaves.directory});
const residentChat=createResidentChatStore({directory:process.env.HD_SAVE_DIR||resolve(root,'data/saves'),saves,run:chatWithResident});
const cocreation=createCoCreationStore({directory:process.env.HD_SAVE_DIR||resolve(root,'data/saves'),worldExists:async(style,key)=>{const d=await saves.current(style);return !!d&&key===(d.state.saveSlot||'legacy-'+style);}});
const recruitment=createRecruitmentService({directory:process.env.HD_SAVE_DIR||resolve(root,'data/saves'),saves,run:recruitmentRun,cancel:cancelRecruitmentRun});
const partyPlanning=createPartyPlanningService({saves,suggest:suggestParty});
const port=Number(process.argv.find(x=>x.startsWith('--port='))?.split('=')[1]??process.env.PORT??4173);
const theme=process.argv.find(x=>x.startsWith('--theme='))?.split('=')[1]??'pixel';
const mime={'.md':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.txt':'text/plain; charset=utf-8'};
let key=process.env.DEEPSEEK_API_KEY;
try{const env=await readFile(resolve(root,'.env.local'),'utf8');key||=env.match(/^DEEPSEEK_API_KEY=(.+)$/m)?.[1]?.trim()}catch{}
const goals=new Set(['farm','mine','plaza','workshop','tea','gallery']);
function sendAgentError(res,e){return sendJSON(res,e.code?.startsWith('automatic_')?429:(e.status||503),{error:String(e.message).slice(0,180),code:e.code||'provider_error',retryAfter:e.retryAfter||0})}
function sendJSON(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(data))}
async function readJSON(req,limit=90000){return readJsonBody(req,limit)}
async function decideNPC(data){return legacyDecision(data)}
async function askHermes(data){
 const message=String(data.message||'').trim().slice(0,1000);if(!message)throw Error('empty message');
 // Legacy callers share the isolated, pinned Hermes worker rather than CLI defaults.
 return manualSteward({...data,message});
}
async function manualSteward(data){const style=['pixel','origami'].includes(data.theme)?data.theme:theme;const doc=await saves.current(style);return steward({...data,...manualPartyContext(doc?.state,style,{saveSlot:data.saveSlot}),theme:style,automatic:false});}
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,`http://${req.headers.host}`).pathname);
  if(pathname.startsWith('/api/')&&!allowLocalAgentRequest(req,port))return sendJSON(res,403,{error:'本机代理接口只接受当前小岛页面的 JSON 请求'});
  if(await servePortfolio({req,res,pathname,store:portfolio,owner:true,authorId:'local-owner',authorName:'本岛岛主',readJSON,sendJSON}))return;
  if(pathname==='/api/world/session'&&req.method==='GET')return sendJSON(res,200,await worldSession.open(theme));
  if(pathname==='/api/status'&&req.method==='GET'){try{const runs=await runLedger.snapshot(),agents=agentStatus();agents.automaticRequests=runs.channels;return sendJSON(res,200,{deepseek:!!key,hermes:agents.hermes.configured,theme,agents,saveProtocol:{initialAuthority:1,importPreview:1,signedExport:1,personal:1,planningTransactions:1,planningAuthority:1,inventoryAuthoritative:true,gather:1,craft:1,craftInputReplay:true,craftCheckpointSeconds:5,farm:1,farmActiveClock:true,field:1,fieldInputReplay:true,resident:1,visitor:1,commerce:1,dayActiveClock:true,party:1,nightPlanning:1,stewardPartyTemplates:['fishing','night','market','couture','fireworks'],festival:1,marketInputReplay:true,couture:1,fireworks:1,coutureInputReplay:true,partyInputReplay:true,hire:1,fishing:1,fishingInputReplay:true,facility:1,facilityActiveClock:true,placement:1,cocreation:1,cocreationInputReplay:true}})}catch(e){return sendAgentError(res,e)}}
  if(pathname==='/api/admin/runtime'&&req.method==='GET'){try{return sendJSON(res,200,await runLedger.snapshot())}catch(e){return sendAgentError(res,e)}}
  if(pathname==='/api/admin/policy'&&req.method==='POST'){try{return sendJSON(res,200,await runLedger.setPolicy(await readJSON(req,4096)))}catch(e){return sendAgentError(res,e)}}
  if(pathname==='/api/world/environment')return sendJSON(res,req.method==='GET'?200:405,req.method==='GET'?environmentService.view():{error:'世界时钟为只读接口'});
  const workRoute=pathname.match(/^\/api\/workbench\/(pixel|origami)(?:\/(project|artifact\/capture-[a-f0-9]{32}(?:\/(preview|download))?))?$/);
  if(workRoute){
   const style=workRoute[1],part=workRoute[2];
   try{
    if(req.method==='GET'&&!part)return sendJSON(res,200,await workbench.list(style));
    if(req.method==='POST'&&part==='project')return sendJSON(res,200,await workbench.project(style,await readJSON(req,18000)));
    if(req.method==='GET'&&part?.startsWith('artifact/')){
     const id=part.split('/')[1],operation=part.split('/')[2];
     if(operation==='download'){const d=await workbench.download(id);res.writeHead(200,{'Content-Type':'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(d.metadata.name)}).end(d.bytes);return}
     const result=operation==='preview'?await workbench.preview(id,Number(new URL(req.url,'http://localhost').searchParams.get('offset')||1)):await workbench.detail(id);
     if(result.metadata)delete result.metadata.snapshotPath;else delete result.snapshotPath;
     return sendJSON(res,200,result);
    }
    return sendJSON(res,405,{error:'不支持此成果操作'});
   }catch(e){return sendAgentError(res,e)}
  }
  const coRoute=pathname.match(/^\/api\/cocreation\/(pixel|origami)(?:\/(action|examples|export\/opc-[a-z0-9-]+\/\d+))?$/);
  if(coRoute){const [,style,operation]=coRoute;try{if(req.method==='GET'&&operation==='examples')return sendJSON(res,200,{examples:CO_CREATION_EXAMPLES});if(req.method==='GET'&&!operation)return sendJSON(res,200,{document:await cocreation.current(style)});if(req.method==='POST'&&operation==='action')return sendJSON(res,200,await cocreation.action(style,await readJSON(req,220000)));if(req.method==='GET'&&operation?.startsWith('export/')){const[,id,n]=operation.split('/'),data=await cocreation.export(style,id,Number(n));return sendJSON(res,200,data);}return sendJSON(res,405,{error:'不支持此共创操作'});}catch(e){return sendJSON(res,e.status||500,{error:String(e.message).slice(0,400),code:e.code||'cocreation_unavailable'});}}
  const saveRoute=pathname.match(/^\/api\/saves\/(pixel|origami)(?:\/(open|save|action|appearance|backups|backup|restore|restart|import|import-preview|migration-export|export))?$/);
  if(saveRoute){
   const [,style,operation='current']=saveRoute;
   try{
    if(req.method==='GET'&&operation==='current')return sendJSON(res,200,{document:await saves.current(style)});
    if(req.method==='GET'&&operation==='backups')return sendJSON(res,200,{backups:await saves.backups(style)});
    if(req.method==='GET'&&operation==='export'){
     const document=await saves.export(style);
     res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="hyper-dimension-'+style+'-day-'+document.state.day+'.json"','Cache-Control':'no-store'}).end(JSON.stringify(document,null,2));return;
    }
    if(req.method==='GET'&&operation==='migration-export'){const data=await saves.migrationExport(style);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="hyper-dimension-'+style+'-browser-legacy.json"','Cache-Control':'no-store'}).end(JSON.stringify(data));return;}
    if(req.method==='POST'&&['open','save','action','appearance','backup','restore','restart','import','import-preview'].includes(operation)){const method=({open:'openClient',restore:'restoreClient',restart:'restartClient',import:'importClient','import-preview':'previewImport'})[operation]||operation;return sendJSON(res,200,await saves[method](style,await readJSON(req,operation==='import-preview'?MAX_IMPORT_BYTES+32768:MAX_SAVE_BYTES+32768)));}
    return sendJSON(res,405,{error:'不支持此存档操作'});
   }catch(error){return sendJSON(res,error.status||503,{error:error.status?error.message:'存档服务暂不可用，现有文件已保留',code:error.code||'save_unavailable'})}
  }
  const recruitRoute=pathname.match(/^\/api\/recruitment\/(pixel|origami)\/(status|hire|retry|cancel|activate|departed|profile|candidate|candidate_manage|recall|renew|policy)$/);
  if(recruitRoute){
   const [,style,operation]=recruitRoute;
   try{
    if(req.method==='GET'&&operation==='status')return sendJSON(res,200,await recruitment.status(style));
    if(req.method==='POST'&&operation!=='status')return sendJSON(res,200,await recruitment[operation](style,await readJSON(req,4096)));
    return sendJSON(res,405,{error:'不支持此招聘操作'});
   }catch(e){return sendJSON(res,e.status||503,{error:e.status?e.message:'招聘服务暂不可用，记录已保留',code:e.code||'recruitment_unavailable'})}
  }
  const partyRoute=pathname.match(/^\/api\/parties\/(pixel|origami)\/suggest$/);
  if(partyRoute){
   if(req.method!=='POST')return sendJSON(res,405,{error:'请提交主题描述'});
   try{return sendJSON(res,200,await partyPlanning.propose(partyRoute[1],await readJSON(req,4096)));}
   catch(e){return sendJSON(res,e.status||503,{error:e.status?e.message:'主题建议暂不可用，可以先发布基础方案',code:e.code||'party_planning_unavailable'});}
  }
  const chatRoute=pathname.match(/^\/api\/residents\/(pixel|origami)\/(\d+)\/chat$/);
  if(chatRoute){const [,style,id]=chatRoute;try{if(req.method==='GET')return sendJSON(res,200,await residentChat.history(style,Number(id),{saveSlot:new URL(req.url,'http://localhost').searchParams.get('saveSlot')}));if(req.method==='POST')return sendJSON(res,200,await residentChat.send(style,Number(id),await readJSON(req,12000)));return sendJSON(res,405,{error:'不支持此聊天操作'});}catch(e){return sendAgentError(res,e)}}
  const actions={'/api/npc/tick':decideBatch,'/api/npc/interact':converse,'/api/hermes/plan':async data=>{const observation=await recruitment.autonomy_observe(data.theme);const result=await steward({...data,recruitment:{eligible:observation.eligible,reason:observation.reason,stats:observation.stats,policy:{enabled:observation.policy.enabled,dailyBudget:observation.policy.dailyBudget,maxContractsPerDay:observation.policy.maxContractsPerDay,coinFloor:observation.policy.coinFloor},opportunities:observation.opportunities.slice(0,12).map(o=>({...o,steps:o.steps.slice(0,6)}))},automatic:true});const decision=await recruitment.autonomy_decide(data.theme,result);return{...result,recruitmentOffers:decision.offers,recruitmentReason:decision.reason||null};},'/api/hermes/command':data=>manualSteward(data)};
  if(req.method==='POST'&&actions[pathname]){try{return sendJSON(res,200,await actions[pathname](await readJSON(req)))}catch(e){return sendAgentError(res,e)}}
  if(pathname==='/api/npc/decide'&&req.method==='POST'){try{return sendJSON(res,200,await decideNPC(await readJSON(req)))}catch(e){return sendAgentError(res,e)}}
  if(pathname==='/api/hermes/ask'&&req.method==='POST'){try{return sendJSON(res,200,await askHermes(await readJSON(req)))}catch(e){return sendAgentError(res,e)}}
  if(req.method!=='GET'||!(pathname==='/'||pathname==='/index.html'||pathname.startsWith('/src/')||pathname.startsWith('/assets/'))){res.writeHead(404).end('Not found');return}
  const route=pathname.startsWith('/assets/')?'/public'+pathname:(pathname==='/'?'/index.html':pathname),file=resolve(root,'.'+route);
  if(!file.startsWith(root+sep)||file.includes('..')){res.writeHead(403).end();return}
  const info=await stat(file);if(!info.isFile()){res.writeHead(404).end();return}
  let data=await readFile(file);if(pathname==='/')data=Buffer.from(data.toString().replace('__DEFAULT_THEME__',theme));
  res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-cache'}).end(data);
 }catch{res.writeHead(404).end('Not found')}
}).listen(port,'127.0.0.1',()=>console.log(`Hyper Dimension ${theme}: http://127.0.0.1:${port}`));



let shutdown;const stop=()=>shutdown??=(async()=>{try{await new Promise(r=>{server.close(r);server.closeIdleConnections();});await environmentService.close();await recruitment.close();await stopAgentWorkers();}finally{await dataLease.release();}})();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stop().then(()=>{process.exitCode=0;},()=>{process.exitCode=1;});});
server.once('error',()=>{stop().finally(()=>{process.exitCode=1;});});
