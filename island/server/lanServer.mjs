import {createDeviceBridgeStore,BRIDGE_BODY_BYTES} from './deviceBridgeStore.mjs';
import {deviceAwareRuntimeFactory} from './deviceBridgeRuntime.mjs';
import {createPortfolioStore} from './portfolioStore.mjs';
import {servePortfolio} from './portfolioHttp.mjs';
import {createEnvironmentService} from './environmentService.mjs';
import {acquireDataLease} from './dataLease.mjs';
import {resolveTravelRecruitment} from './lanTravelParty.mjs';
import {createLanHomeServices} from './lanHomeServices.mjs';
import {createLanSocialStore} from './lanSocialStore.mjs';
import {readJsonBody,MANUAL_STEWARD_BODY_BYTES} from './httpBody.mjs';
import {createLanCollaborationStore} from './lanCollaborationStore.mjs';
import {NPC_CADENCE} from '../src/npcCadence.js';
import {createLanAgentService} from './lanAgentService.mjs';
import {createLanActivityStore} from './lanActivityStore.mjs';
import {createServer} from 'node:http';import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {networkInterfaces,hostname} from 'node:os';import {randomBytes,timingSafeEqual} from 'node:crypto';import {createLanIdentityStore} from './lanIdentityStore.mjs';import {createLanTenantServices} from './lanTenantServices.mjs';import {MAX_SAVE_BYTES,MAX_IMPORT_BYTES} from './saveStore.mjs';import {CO_CREATION_EXAMPLES} from '../src/cocreation.js';
const root=resolve(import.meta.dirname,'..'),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
const err=(message,code,status)=>Object.assign(Error(message),{code,status}),json=(res,status,data,headers={})=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}).end(JSON.stringify(data));
async function body(req,limit=12000){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw err('请使用小岛页面提交JSON请求','lan_content_type',415);try{return await readJsonBody(req,limit)}catch(e){if(e.code==='body_too_large')throw err('请求内容过大','lan_body_size',413);throw err('请求格式无效','lan_invalid',400);}}
function token(req){const cookies=String(req.headers.cookie||'').split(';').map(x=>x.trim().split('=')),found=cookies.find(([k])=>k==='hd_lan_session');return found?.[1]||'';}
const cookie=t=>'hd_lan_session='+t+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=259200',forgetCookie='hd_lan_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';
const interfaces=()=>Object.values(networkInterfaces()).flat().filter(a=>a&&a.family==='IPv4').map(a=>a.address);
export async function createLanHttpServer({environmentClockProvider,environmentDirectory,directory=resolve(root,'data'),host='127.0.0.1',port=4175,enrollmentKey=null,now=()=>Date.now(),agentRuntimeFactory,collaborationFault,socialFault}={}){
 if(!['127.0.0.1','0.0.0.0'].includes(host))throw Error('LAN listener requires an explicit loopback or all-interface address');
 const dataLease=await acquireDataLease({directory:resolve(directory,'_lan'),mode:'runtime'}),cleanup=[];try {
 const identities=createLanIdentityStore({directory,now,personalRuntime:true,resolveTravel:async account=>resolveTravelRecruitment(directory,account,await tenants.readIslandForServer(account.id,account.profile.theme))}),tenants=createLanTenantServices({directory,identities,now}),knownHosts=new Set(['127.0.0.1','localhost',hostname().toLowerCase(),...interfaces()]),rate=new Map();
 if(!enrollmentKey){const dir=resolve(directory,'_lan');await mkdir(dir,{recursive:true});const file=resolve(dir,'enrollment.json');try{enrollmentKey=JSON.parse(await readFile(file,'utf8')).key}catch(e){if(e.code!=='ENOENT')throw e;enrollmentKey=randomBytes(6).toString('hex').toUpperCase();await writeFile(file,JSON.stringify({key:enrollmentKey},null,2)+'\n',{mode:0o600});}}
 if(typeof enrollmentKey!=='string'||enrollmentKey.length<8||enrollmentKey.length>80)throw Error('Invalid enrollment key');
 function allowed(req){let h;try{h=new URL('http://'+req.headers.host)}catch{return false;}if(!knownHosts.has(h.hostname.toLowerCase())||Number(h.port||80)!==server.address()?.port||req.headers['sec-fetch-site']==='cross-site')return false;if(req.headers.origin){try{if(new URL(req.headers.origin).origin!==h.origin)return false;}catch{return false;}}return true;}
 function throttle(req,type){const key=(req.socket.remoteAddress||'unknown')+':'+type+(type==='normal'?':'+token(req):''),entry=rate.get(key)||{at:now(),count:0};if(now()-entry.at>60000){entry.at=now();entry.count=0;}entry.count++;rate.set(key,entry);if(entry.count>(type==='auth'?12:240))throw err('请求过于频繁，请稍后再试','lan_rate',429);if(rate.size>512)for(const[k,v]of rate)if(now()-v.at>60000)rate.delete(k);}
 const environmentService=await createEnvironmentService({directory:environmentDirectory||process.env.HD_ENVIRONMENT_DIR||resolve(directory,'environment'),now,...(environmentClockProvider===undefined?{}:{centralClockProvider:environmentClockProvider})});cleanup.push(()=>environmentService.close());
 const activities=createLanActivityStore({directory,identities,tenants,now});
 const bridge=createDeviceBridgeStore({directory,identities,now});cleanup.push(()=>bridge.close());
 const agents=createLanAgentService({directory,identities,tenants,now,runtimeFactory:deviceAwareRuntimeFactory(bridge,agentRuntimeFactory),socialContext:(...args)=>social.contextForOwner(...args)});
 cleanup.push(()=>agents.close());
 const collaboration=createLanCollaborationStore({directory,identities,tenants,activities,agents,now,fault:collaborationFault});
 cleanup.push(()=>collaboration.close());
 const social=createLanSocialStore({directory,identities,tenants,agents,now,fault:socialFault});
 cleanup.push(()=>social.close());
 const socialRecovery={ready:true,code:null};
 const homeServices=createLanHomeServices({identities,tenants,agents,now});
 cleanup.push(()=>homeServices.close());
 agents.setRecruitmentHooks({observe:(...args)=>homeServices.recruitmentObservation(...args),decide:(...args)=>homeServices.recruitmentDecision(...args)});
 const server=createServer(async(req,res)=>{try{
 if(!allowed(req))return json(res,403,{error:'只接受当前联机小岛页面的同源请求',code:'lan_origin'});
 const pathname=decodeURIComponent(new URL(req.url,'http://'+req.headers.host).pathname);
 if(pathname==='/api/world/environment')return json(res,req.method==='GET'?200:405,req.method==='GET'?environmentService.view():{error:'世界时钟为只读接口'});
 if(pathname==='/api/lan/status'&&req.method==='GET')return json(res,200,{mode:'local-lan-alpha',maxPlayers:4,identityRequired:true,sharedRoomMovement:'server-path',agentTools:true,agentScope:'owner-workspace',homeServices:{recruitment:true,partyPlanning:true,ownerScoped:true,candidateChoices:4,customCandidatesPerIsland:3,candidateManagement:true,recall:true,inPlaceRenewal:true,renewalLimit:3,autonomousRecruitment:true,autonomyPolicy:true},automaticModels:{available:true,scope:'per-owner',plansSeconds:NPC_CADENCE.planSeconds,conversationsSeconds:NPC_CADENCE.conversationSeconds,stewardSeconds:NPC_CADENCE.stewardSeconds},travel:{recruitedCompanions:true,contractScopedHistory:true,requiredButler:true,maxResidents:2,homeProductionPaused:true,personalAgentRuntime:true,deviceBridge:true,deviceBridgePairing:"owner-confirmed",a2a:true,a2aProtocol:'hyper-dimension-v1',a2aCapabilities:['event.checkin','island.information'],residentEncounters:true,residentCooperation:true,socialRecovery,guestWorkshopCooperation:true,guestWorkContractPins:true,guestWorkMaterialEscrow:true,cooperationReceipts:true,homeSocialMemories:true,socialCadenceSeconds:NPC_CADENCE.conversationSeconds,socialHistory:'server-owner-world'},activities:{invitation:true,preparation:true,carryCheck:true,wardrobeCheck:true,inputReplay:true,verifiedRating:true,subscribe:true,crossIslandCurrency:true,escrow:true,delivery:true,escrowRefunds:true,qualityReward:true},scope:'Separate island saves; invitations, carry/wardrobe admission, input-replayed event challenges, verified reviews and host subscriptions. Funded events settle reserved materials and fees with budgeted quality rewards and refunds. Physical-device verification remains pending.'});
 if(pathname==='/api/lan/register'&&req.method==='POST'){throttle(req,'auth');const data=await body(req),key=String(data.enrollmentKey||''),left=Buffer.from(key),right=Buffer.from(enrollmentKey);if(left.length!==right.length||!timingSafeEqual(left,right))throw err('加入码错误，请向主办岛主获取当前加入码','lan_enrollment',403);delete data.enrollmentKey;const result=await identities.register(data);return json(res,200,{view:result.view},{'Set-Cookie':cookie(result.token)});}
 if(pathname==='/api/lan/login'&&req.method==='POST'){throttle(req,'auth');const result=await identities.login(await body(req));return json(res,200,{view:result.view},{'Set-Cookie':cookie(result.token)});}
 if(pathname==='/api/lan/bridge/enroll'&&req.method==='POST'){throttle(req,'auth');return json(res,200,await bridge.enroll(await body(req,4096)));}
 if(['/api/lan/bridge/heartbeat','/api/lan/bridge/next','/api/lan/bridge/claim','/api/lan/bridge/complete'].includes(pathname)){
  if(req.method!=='POST')throw err('原机接口需要提交请求','bridge_method',405);
  const secret=String(req.headers.authorization||'').replace(/^Bearer /,'');
  const deviceId=await bridge.authenticate(secret,pathname.endsWith('/heartbeat'));throttle(req,'device-'+deviceId);
  const data=await body(req,pathname.endsWith('/complete')?BRIDGE_BODY_BYTES:12000);
  const operation=pathname.split('/').at(-1);return json(res,200,await bridge[operation](secret,data));
 }
 if(pathname.startsWith('/api/')&& !['/api/lan/register','/api/lan/login','/api/lan/status'].includes(pathname)){const a=await identities.authorize(token(req)),scope=req.headers['x-hd-island'];if(scope&&scope!==a.id||!pathname.startsWith('/api/lan/')&&scope!==a.id)throw err('岛主身份已变化，请重新打开自己的小岛','lan_scope_changed',409);}
 if(/^\/api\/lan\/portfolio(?:\/|$)/.test(pathname)){throttle(req,'normal');const account=await identities.authorize(token(req)),presence=await identities.presence(token(req)),ownerId=presence?.owner||account.id;if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(ownerId))throw err('岛主身份无效','portfolio_owner',403);const store=createPortfolioStore({directory:resolve(tenants.root,ownerId),now});if(await servePortfolio({req,res,pathname,store,owner:ownerId===account.id,authorId:account.id,authorName:account.profile.name,readJSON:body,sendJSON:json}))return;}
 if(pathname==='/api/lan/bridge'&&req.method==='GET'){throttle(req,'normal');return json(res,200,await bridge.view(token(req)));}
 if(['/api/lan/bridge/pair','/api/lan/bridge/approve','/api/lan/bridge/revoke'].includes(pathname)&&req.method==='POST'){throttle(req,'normal');return json(res,200,await bridge[pathname.split('/').at(-1)](token(req),await body(req,4096)));}
 if(pathname==='/api/lan/logout'&&req.method==='POST'){await body(req);await identities.logout(token(req));await social.reconcileRooms();return json(res,200,{ok:true},{'Set-Cookie':forgetCookie});}
 if(pathname==='/api/lan/collaboration'&&req.method==='GET'){throttle(req,'normal');return json(res,200,await collaboration.view(token(req)));}
 if(pathname==='/api/lan/collaboration/action'&&req.method==='POST'){throttle(req,'normal');return json(res,200,await collaboration.action(token(req),await body(req,16000)));}
 if(pathname==='/api/lan/presence'&&req.method==='GET')return json(res,200,{presence:await identities.presence(token(req))});
 if(pathname==='/api/lan/steward'&&req.method==='GET'){throttle(req,'normal');return json(res,200,await agents.view(token(req),new URL(req.url,'http://local').searchParams.get('theme'),new URL(req.url,'http://local').searchParams.get('contractId')));}
 if(pathname==='/api/lan/steward'&&req.method==='POST'){throttle(req,'normal');return json(res,202,{job:await agents.submit(token(req),await body(req,90000))});}
 if(pathname==='/api/lan/me'&&req.method==='GET')return json(res,200,{account:await identities.authorize(token(req))});
 if(pathname==='/api/lan/social/cooperate'&&req.method==='POST'){throttle(req,'normal');return json(res,200,await social.cooperate(token(req),await body(req,4000)));}
 if(pathname==='/api/lan/social'&&req.method==='GET'){throttle(req,'normal');return json(res,200,await social.view(token(req)));}
 if(pathname==='/api/lan/social/tick'&&req.method==='POST'){throttle(req,'normal');await body(req);await social.tick(token(req));return json(res,200,await social.view(token(req)));}
 if(pathname.startsWith('/api/lan/social/history/')&&req.method==='GET'){throttle(req,'normal');return json(res,200,await social.history(token(req),Number(pathname.split('/').at(-1)),new URL(req.url,'http://local').searchParams.get('theme')));}
 if(pathname==='/api/lan/view'&&req.method==='GET'){throttle(req,'normal');return json(res,200,{view:await identities.view(token(req))});}
 if(pathname==='/api/lan/activities'&&req.method==='GET'){throttle(req,'normal');return json(res,200,{view:await activities.view(token(req))});}
 if(pathname==='/api/lan/activities/action'&&req.method==='POST'){throttle(req,'normal');return json(res,200,await activities.action(token(req),await body(req,220000)));}
 if(pathname==='/api/lan/action'&&req.method==='POST'){throttle(req,'normal');const input=await body(req);if(['room_create','room_join','travel_invite','travel_remove'].includes(input.operation)){const a=await identities.authorize(token(req));if(!await tenants.readIslandForServer(a.id,a.profile.theme))await tenants.open(token(req),a.profile.theme,{});}const result=await identities.action(token(req),input);if(['room_leave','room_close'].includes(input.operation))await social.reconcileRooms();return json(res,200,result);}
 const stewardReceipt=pathname.match(/^\/api\/hermes\/requests\/([-A-Za-z0-9]{8,100})$/);
 if(stewardReceipt){if(req.method!=='GET')return json(res,405,{error:'委托回执只支持读取'});throttle(req,'normal');return json(res,200,{request:await agents.receipt(token(req),stewardReceipt[1],new URL(req.url,'http://local').searchParams.get('theme'))});}
 if(pathname.startsWith('/api/')){
 const context=await tenants.get(token(req));
 if(pathname==='/api/world/session'&&req.method==='GET')return json(res,200,await context.worldSession.open(context.account.profile.theme));
 if(pathname==='/api/status'&&req.method==='GET'){const status=await agents.status(token(req));return json(res,200,{mode:'local-lan-alpha',deepseek:!!status.deepseek?.configured,hermes:status.hermes.configured,theme:context.account.profile.theme,agents:{...status,deepseek:status.deepseek,hermes:{...status.hermes,manualAvailable:true,automaticAvailable:true}},saveProtocol:{initialAuthority:1,importPreview:1,signedExport:1,personal:1,planningTransactions:1,planningAuthority:1,inventoryAuthoritative:true,gather:1,craft:1,craftInputReplay:true,craftCheckpointSeconds:5,farm:1,farmActiveClock:true,field:1,fieldInputReplay:true,resident:1,visitor:1,commerce:1,dayActiveClock:true,party:1,nightPlanning:1,stewardPartyTemplates:['fishing','night','market','couture','fireworks'],festival:1,marketInputReplay:true,couture:1,fireworks:1,coutureInputReplay:true,partyInputReplay:true,hire:1,fishing:1,fishingInputReplay:true,facility:1,facilityActiveClock:true,placement:1,cocreation:1,cocreationInputReplay:true,lanEconomy:1}});}
 const saveRoute=pathname.match(/^\/api\/saves\/(pixel|origami)(?:\/(open|save|action|appearance|backups|backup|restore|restart|import|import-preview|export))?$/);
 if(saveRoute){await activities.reconcile();const[,theme,op='current']=saveRoute,saves=context.saves;if(req.method==='GET'&&op==='current')return json(res,200,{document:await saves.current(theme)});if(req.method==='GET'&&op==='backups')return json(res,200,{backups:await saves.backups(theme)});if(req.method==='GET'&&op==='export'){const d=await saves.export(theme);return json(res,200,d,{'Content-Disposition':'attachment; filename="hyper-dimension-'+theme+'-island.json"'});}if(req.method==='POST'&&op==='open')return json(res,200,await tenants.open(token(req),theme,await body(req,MAX_SAVE_BYTES+32768)));if(req.method==='POST'&&['save','action','appearance','backup','restore','restart','import','import-preview'].includes(op)){const input=await body(req,op==='import-preview'?MAX_IMPORT_BYTES+32768:MAX_SAVE_BYTES+32768),method=({restore:'restoreClient',restart:'restartClient',import:'importClient','import-preview':'previewImport'})[op]||op;return json(res,200,op==='action'&&input.kind==='cross-social'?await social.queueCooperation(token(req),theme,input):await saves[method](theme,input));}throw err('不支持此联机存档操作','lan_method',405);}
 const co=pathname.match(/^\/api\/cocreation\/(pixel|origami)(?:\/(action|examples|export\/opc-[a-z0-9-]+\/\d+))?$/);if(co){const[,theme,op]=co;if(req.method==='GET'&&op==='examples')return json(res,200,{examples:CO_CREATION_EXAMPLES});if(req.method==='GET'&&!op)return json(res,200,{document:await context.cocreation.current(theme)});if(req.method==='POST'&&op==='action')return json(res,200,await context.cocreation.action(theme,await body(req,220000)));if(req.method==='GET'&&op?.startsWith('export/')){const[,id,n]=op.split('/');return json(res,200,await context.cocreation.export(theme,id,Number(n)));}throw err('不支持此共创操作','lan_method',405);}
 const recruitmentRoute=pathname.match(/^\/api\/recruitment\/(pixel|origami)\/(status|hire|retry|cancel|activate|departed|profile|candidate|candidate_manage|recall|renew|policy)$/);
 if(recruitmentRoute){const[,theme,operation]=recruitmentRoute;throttle(req,'normal');if(req.method==='GET'&&operation==='status')return json(res,200,await homeServices.recruitment(token(req),theme,operation));if(req.method==='POST'&&operation!=='status')return json(res,200,await homeServices.recruitment(token(req),theme,operation,await body(req,4096)));throw err('招聘请求方式无效','lan_method',405);}
 const planningRoute=pathname.match(/^\/api\/parties\/(pixel|origami)\/suggest$/);
 if(planningRoute){if(req.method!=='POST')throw err('请提交活动主题','lan_method',405);throttle(req,'normal');return json(res,200,await homeServices.propose(token(req),planningRoute[1],await body(req,4096)));}
 const chatRoute=pathname.match(/^\/api\/residents\/(pixel|origami)\/(\d+)\/chat$/);
 if(chatRoute){throttle(req,'normal');const [,theme,id]=chatRoute;if(!['GET','POST'].includes(req.method))throw err('不支持此聊天操作','resident_chat_method',405);const input=req.method==='GET'?{saveSlot:new URL(req.url,'http://localhost').searchParams.get('saveSlot')}:await body(req,12000);return json(res,200,await agents.residentChat(token(req),req.method==='GET'?'residentChatHistory':'residentChatSend',{theme,npcId:Number(id),input}));}
 const automaticRoute={'/api/npc/tick':'plans','/api/npc/interact':'conversations','/api/hermes/plan':'steward'}[pathname];
 if(automaticRoute&&req.method==='POST'){throttle(req,'normal');return json(res,200,await agents.automatic(token(req),automaticRoute,await body(req,90000)));}
 if(pathname==='/api/admin/runtime'&&req.method==='GET')return json(res,200,await agents.work(token(req),'ledger',{}));
 if(pathname==='/api/admin/policy'&&req.method==='POST'){throttle(req,'normal');return json(res,200,await agents.work(token(req),'policy',await body(req,4096)));}
 if(pathname==='/api/hermes/command'&&req.method==='POST'){throttle(req,'normal');return json(res,200,await agents.wait(token(req),await body(req,MANUAL_STEWARD_BODY_BYTES)));}
 const workRoute=pathname.match(/^\/api\/workbench\/(pixel|origami)(?:\/(project|artifact\/capture-[a-f0-9]{32}(?:\/(preview|download))?))?$/);
 if(workRoute){const[,theme,part]=workRoute;let method,args={theme};
  if(!part&&req.method==='GET')method='list';
  else if(part==='project'&&req.method==='POST'){method='project';args.input=await body(req,18000);}
  else if(part?.startsWith('artifact/')&&req.method==='GET'){const[,id,op]=part.split('/');method=op||'detail';args={id,offset:Number(new URL(req.url,'http://local').searchParams.get('offset')||1)};}
  else throw err('不支持此成果操作','lan_method',405);
  const result=await agents.work(token(req),method,args);
  if(method==='download')return res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(result.metadata.name)}).end(Buffer.from(result.base64,'base64'));
  if(result?.metadata)delete result.metadata.snapshotPath;else if(result)delete result.snapshotPath;
  return json(res,200,result);
 }
 // Bound owners use their confirmed original-device runtime; AI residents retain server-owner authority.
 throw err('联机预览暂未开放此功能，请使用本机单机入口','lan_feature_pending',503);
 }
 if(req.method!=='GET')throw err('不支持此请求','lan_method',405);
 if(pathname==='/'){const file=resolve(root,'src/lan.html');return res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-cache'}).end(await readFile(file));}
 if(pathname==='/play'){const account=await identities.authorize(token(req));if(await identities.presence(token(req)))return res.writeHead(303,{'Location':'/?resume=travel','Cache-Control':'no-store'}).end();let html=await readFile(resolve(root,'index.html'),'utf8');html=html.replace('__DEFAULT_THEME__',account.profile.theme).replace('<script type="module" src="/src/app.js"></script>','<script type="module" src="/src/lan-main.js"></script>');return res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-cache'}).end(html);}
 if(!(pathname.startsWith('/src/')||pathname.startsWith('/assets/')))throw err('页面不存在','lan_missing',404);const route=pathname.startsWith('/assets/')?'/public'+pathname:pathname,file=resolve(root,'.'+route);if(!file.startsWith(root+sep)||file.includes('..'))throw err('文件路径无效','lan_missing',404);const info=await stat(file);if(!info.isFile())throw err('文件不存在','lan_missing',404);return res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(await readFile(file));
 }catch(e){json(res,e.status||503,{error:e.status?e.message:'联机服务暂不可用，现有档案已保留',code:e.code||'lan_unavailable',retryAfter:e.retryAfter||0});}});
 await social.reconcileRooms().catch(e=>{socialRecovery.ready=false;socialRecovery.code=e.code||'lan_social_recovery';});
 await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,host,accept);});
 let closePromise;const close=()=>closePromise??=(async()=>{const errors=[];await bridge.close();await new Promise(r=>{server.close(r);server.closeIdleConnections();});for(const stop of [()=>environmentService.close(),()=>social.close(),()=>collaboration.close(),()=>homeServices.close(),()=>bridge.close(),()=>agents.close()])try{await stop()}catch(e){errors.push(e)}if(errors.length)throw new AggregateError(errors,'运行端未全部停止，数据运行锁保留');await dataLease.release();})();
 return{server,environmentService,identities,tenants,activities,agents,bridge,collaboration,social,homeServices,enrollmentKey,port:server.address().port,host,close};
 }catch(e){for(const close of cleanup.reverse())await close().catch(()=>{});await dataLease.release();throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){const host=process.argv.find(x=>x.startsWith('--host='))?.slice(7)||'127.0.0.1',port=Number(process.argv.find(x=>x.startsWith('--port='))?.slice(7)||4175),service=await createLanHttpServer({host,port});console.log('Hyper Dimension LAN preview: http://127.0.0.1:'+service.port+'/');console.log('New-islander enrollment code: '+service.enrollmentKey);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{service.close().then(()=>{process.exitCode=0;},()=>{process.exitCode=1;});});}
