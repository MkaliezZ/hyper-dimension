import {createHash} from 'node:crypto';

export const A2A_EXTENSION='https://mkaliezz.github.io/hyper-dimension/a2a/island-cooperation/v1';
export const A2A_VERSION='1.0';
const stateMap={thinking:'TASK_STATE_WORKING',executing:'TASK_STATE_WORKING',completed:'TASK_STATE_COMPLETED',declined:'TASK_STATE_REJECTED',cancelled:'TASK_STATE_CANCELED',expired:'TASK_STATE_FAILED'};
const knownStates=new Set(['TASK_STATE_UNSPECIFIED','TASK_STATE_SUBMITTED','TASK_STATE_WORKING','TASK_STATE_COMPLETED','TASK_STATE_FAILED','TASK_STATE_CANCELED','TASK_STATE_INPUT_REQUIRED','TASK_STATE_REJECTED','TASK_STATE_AUTH_REQUIRED']);
const terminal=new Set(['completed','declined','cancelled','expired']);
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const digest=v=>createHash('sha256').update(stable(v)).digest('hex');
function stable(v){return JSON.stringify(v,(_,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);}
const fail=(code,message,data)=>Object.assign(Error(message),{rpcCode:code,data});
const invalid=message=>fail(-32602,message);
function fields(v,keys,label){if(!obj(v)||Object.keys(v).some(k=>!keys.includes(k)))throw invalid('Invalid '+label);}
function id(v,label){if(typeof v!=='string'||(!v.length||v.length>255||/[\u0000-\u001f\u007f]/.test(v)))throw invalid('Invalid '+label);return v;}
function integer(v,label,min=0,max=2147483647){if(v!==undefined&&(!Number.isInteger(v)||v<min||v>max))throw invalid('Invalid '+label);}
const status=t=>stateMap[t.status]||'TASK_STATE_INPUT_REQUIRED';
const timestamp=t=>new Date(t.updatedAt||t.messages.at(-1)?.at||t.createdAt).toISOString();
function nextAction(t,owner){if(terminal.has(t.status)||['thinking','executing'].includes(t.status))return null;
 if(t.capability==='island.information')return t.status==='retry'?(t.turnOwnerId===owner?'retry':null):t.nextOwnerId===owner?'respond':null;
 const receiver=owner===t.recipient.ownerAccountId;
 if(t.status==='retry')return (t.stage==='review'?receiver:!receiver)?'retry':null;
 if(receiver&&['offered','needs_information'].includes(t.status))return 'review';
 if(receiver&&['accepted','execution_failed'].includes(t.status))return 'execute';
 if(!receiver&&t.receipt&&['executed','needs_information'].includes(t.status))return 'confirm';
 return null;
}
function taskMessage(t,m){return {messageId:m.messageId,contextId:t.roomId,taskId:t.id,role:'ROLE_AGENT',parts:[{text:m.text}],extensions:[A2A_EXTENSION],metadata:{[A2A_EXTENSION]:{speaker:m.senderActorId===t.sender.actorId?t.sender.name:t.recipient.name,decision:m.decision,ledgerRunId:m.ledgerRunId}}};}
function taskView(t,owner,historyLength){const history=[];
 // Inputs are inserted before the matching model turn, including equal timestamps.
 for(let n=0;n<=t.messages.length;n++){
  for(const input of (t.clientMessages||[]).filter(m=>m.beforeAgentCount===n))history.push({messageId:input.messageId,contextId:t.roomId,taskId:t.id,role:'ROLE_USER',parts:[{text:input.text}]});
  if(n<t.messages.length)history.push(taskMessage(t,t.messages[n]));
 }
 const metadata={capability:t.capability,status:t.status,stage:t.stage,nextAction:nextAction(t,owner),expiresAt:new Date(t.expiresAt).toISOString(),participants:[t.sender,t.recipient].map(p=>({ownerId:p.ownerAccountId,name:p.name})),...(t.eventId?{eventId:t.eventId}:{}),...(t.receipt?{receipt:{verified:!!t.receipt.verified,operation:t.receipt.operation,delivery:t.receipt.delivery,reserved:t.receipt.reserved,note:t.receipt.note}}:{})};
 const row={id:t.id,contextId:t.roomId,status:{state:status(t),timestamp:timestamp(t)},metadata:{[A2A_EXTENSION]:metadata}};
 const last=t.messages.at(-1);if(last)row.status.message=taskMessage(t,last);
 if(historyLength!==0&&history.length)row.history=historyLength===undefined?history:history.slice(-historyLength);
 return row;
}
function validateConfig(c){if(c===undefined)return {};fields(c,['acceptedOutputModes','taskPushNotificationConfig','historyLength','returnImmediately'],'configuration');integer(c.historyLength,'historyLength');
 if(c.returnImmediately!==undefined&&typeof c.returnImmediately!=='boolean')throw invalid('Invalid returnImmediately');
 if(c.taskPushNotificationConfig)throw fail(-32003,'Push notifications are not supported');
 if(c.acceptedOutputModes!==undefined&&(!Array.isArray(c.acceptedOutputModes)||c.acceptedOutputModes.some(x=>typeof x!=='string')))throw invalid('Invalid acceptedOutputModes');
 if(c.acceptedOutputModes?.length&&!c.acceptedOutputModes.some(x=>['text/plain','text/*','*/*'].includes(x)))throw fail(-32005,'Only text output is supported');return c;
}
function validateMessage(m){fields(m,['messageId','contextId','taskId','role','parts','metadata','extensions','referenceTaskIds'],'message');id(m.messageId,'messageId');if(m.role!=='ROLE_USER')throw invalid('Client messages must have ROLE_USER');
 if(m.contextId!==undefined)id(m.contextId,'contextId');if(m.taskId!==undefined)id(m.taskId,'taskId');
 if(!Array.isArray(m.parts)||!m.parts.length||m.parts.length>8)throw invalid('A message requires text parts');
 for(const part of m.parts){if(!obj(part))throw invalid('Invalid part');if('raw' in part||'url' in part||'data' in part)throw fail(-32005,'This interface accepts text only; files are not fetched');fields(part,['text','metadata','mediaType','filename'],'text part');if(typeof part.text!=='string')throw invalid('Invalid text');if(part.metadata!==undefined&&!obj(part.metadata))throw invalid('Invalid part metadata');if(part.mediaType&&!['text/plain','text/*'].includes(part.mediaType))throw fail(-32005,'Only text input is supported');}
 const text=m.parts.map(p=>p.text).join('\n').trim();if(!text||text.length>500)throw invalid('Text must contain 1 to 500 characters');
 if(m.metadata!==undefined&&!obj(m.metadata))throw invalid('Invalid message metadata');
 if(m.extensions!==undefined&&(!Array.isArray(m.extensions)||m.extensions.some(x=>typeof x!=='string')))throw invalid('Invalid message extensions');
 if(m.referenceTaskIds!==undefined&&(!Array.isArray(m.referenceTaskIds)||m.referenceTaskIds.some(x=>typeof x!=='string')))throw invalid('Invalid referenceTaskIds');
 if(m.referenceTaskIds?.length)throw fail(-32004,'Cross-task reference execution is not supported');
 return text;
}
export function createA2AGateway({identities,collaboration,now=Date.now}){
 let closing=false;
 function card(origin,extensionParams={}){return {
  name:'Hyper Dimension · Island Stewards',description:'Authenticated island steward correspondence and confirmed event preparation. Each owner retains their own Hermes runtime.',version:'160.0.0',
  supportedInterfaces:[{url:origin+'/api/lan/a2a',protocolBinding:'JSONRPC',protocolVersion:A2A_VERSION}],
  provider:{organization:'Hyper Dimension',url:'https://github.com/MkaliezZ/hyper-dimension'},documentationUrl:'https://github.com/MkaliezZ/hyper-dimension/blob/main/island/docs/a2a-standard-v158.md',
  capabilities:{streaming:false,pushNotifications:false,extendedAgentCard:true,extensions:[{uri:A2A_EXTENSION,required:false,description:'Same-room peer selection, consent, owner-confirmed event preparation and traceable correspondence.',params:{protocol:'hyper-dimension-v1',...extensionParams}}]},
  securitySchemes:{ownerSession:{httpAuthSecurityScheme:{scheme:'Bearer',bearerFormat:'Opaque owner session',description:'Use the authenticated owner session; device bridge credentials are not owner credentials.'}},ownerCookie:{apiKeySecurityScheme:{location:'cookie',name:'hd_lan_session',description:'Authenticated island owner session.'}}},
  securityRequirements:[{schemes:{ownerSession:{list:[]}}},{schemes:{ownerCookie:{list:[]}}}],defaultInputModes:['text/plain'],defaultOutputModes:['text/plain'],
  skills:[{id:'island.information',name:'Steward correspondence',description:'Exchange public island facts with another consenting same-room steward. No private documents or automatic resource spending.',tags:['island','hermes','correspondence']},{id:'event.checkin',name:'Event preparation',description:'Discuss preparation for the owner’s activity. Resource reservations require an explicit execute message from the invited owner.',tags:['island','event','confirmation']}]};}
 async function extendedCard(token,origin){const a=await identities.authorize(token),view=await collaboration.view(token),presence=await identities.presence(token);return card(origin,{ownerId:a.id,contextId:presence?.roomId||null,informationEnabled:view.informationEnabled,eventPreparationEnabled:view.enabled,peers:view.peers.map(p=>({recipientId:p.ownerAccountId,name:p.name,islandName:p.homeIslandName,informationEnabled:p.informationEnabled,eventPreparationEnabled:!!view.preferences[p.ownerAccountId]})),events:view.events.filter(e=>e.owner===a.id).map(e=>({eventId:e.eventId,title:e.title}))});}
 async function find(token,taskId){const task=(await collaboration.view(token)).tasks.find(t=>t.id===taskId);if(!task)throw fail(-32001,'Task not found');return task;}
 function contextMatch(t,contextId){if(contextId!==undefined&&contextId!==t.roomId)throw invalid('contextId does not match this task');}
 async function send(token,owner,p,signal){fields(p,['tenant','message','configuration','metadata'],'SendMessage parameters');if(p.tenant)throw invalid('This interface has no tenant routing value');const text=validateMessage(p.message),config=validateConfig(p.configuration);
  if(p.metadata!==undefined&&!obj(p.metadata))throw invalid('Invalid request metadata');
  const requestExtension=p.metadata?.[A2A_EXTENSION],messageExtension=p.message.metadata?.[A2A_EXTENSION];
  if(requestExtension!==undefined&&messageExtension!==undefined&&stable(requestExtension)!==stable(messageExtension))throw invalid('Conflicting island metadata');
  if(requestExtension!==undefined&&!obj(requestExtension)||messageExtension!==undefined&&!obj(messageExtension))throw invalid('Invalid island metadata');
  const extension={...(requestExtension??messageExtension??{})};fields(extension,['recipientId','capability','eventId','action'],'island cooperation metadata');
  const m=p.message,fingerprint=digest({message:m,metadata:p.metadata||{}});let command;
  const view=await collaboration.view(token),replay=view.tasks.find(t=>t.clientMessages?.some(x=>x.owner===owner&&x.messageId===m.messageId));
  async function answer(task){let t=task;while(!config.returnImmediately&&['thinking','executing'].includes(t.status)){if(closing||signal?.aborted)throw fail(-32603,'Request interrupted; query the original task before retrying');await new Promise(r=>setTimeout(r,250));t=await find(token,t.id);}return {task:taskView(t,owner,config.historyLength)};}
  if(replay){if(replay.clientMessages.find(x=>x.owner===owner&&x.messageId===m.messageId).fingerprint!==fingerprint)throw invalid('The same messageId cannot change content');return answer(replay);}
  if(m.taskId){const t=await find(token,m.taskId);contextMatch(t,m.contextId);if(extension.recipientId&&extension.recipientId!==t.recipient.ownerAccountId||extension.eventId&&extension.eventId!==t.eventId||extension.capability&&extension.capability!==t.capability)throw invalid('Task identity cannot be changed');
   const action=extension.action||nextAction(t,owner);if(action==='execute'&&extension.action!=='execute')throw invalid('The invited owner must explicitly specify action=execute');if(!['respond','review','confirm','retry','execute'].includes(action))throw invalid('No executable turn is available to this owner');
   command={operation:action,taskId:t.id,...(action==='respond'?{message:text}:{})};
  }else{const capability=extension.capability||'island.information';if(!['island.information','event.checkin'].includes(capability))throw invalid('Unknown island capability');if(extension.action)throw invalid('An action requires taskId');extension.recipientId??=view.peers.length===1?view.peers[0].ownerAccountId:undefined;id(extension.recipientId,'recipientId');const presence=await identities.presence(token);if(m.contextId&&m.contextId!==presence?.roomId)throw invalid('contextId must be the owner’s current room');
   command=capability==='island.information'?{operation:'exchange',recipientId:extension.recipientId,topic:text}:{operation:'offer',recipientId:extension.recipientId,eventId:id(extension.eventId,'eventId')};
  }
  command.requestId='rpc-'+digest([owner,m.messageId]);command.a2aMessage={messageId:m.messageId,text,fingerprint};
  const result=await collaboration.action(token,command);return answer(await find(token,result.taskId));

 }
 async function dispatch(token,owner,method,p,origin,signal){
  if(method==='GetExtendedAgentCard'){fields(p,['tenant'],'GetExtendedAgentCard parameters');if(p.tenant)throw invalid('Invalid tenant');return extendedCard(token,origin);}
  if(method==='SendMessage')return send(token,owner,p,signal);
  if(method==='GetTask'){fields(p,['tenant','id','historyLength'],'GetTask parameters');if(p.tenant)throw invalid('Invalid tenant');id(p.id,'task id');integer(p.historyLength,'historyLength');return taskView(await find(token,p.id),owner,p.historyLength);}
  if(method==='CancelTask'){fields(p,['tenant','id','metadata'],'CancelTask parameters');if(p.tenant)throw invalid('Invalid tenant');if(p.metadata!==undefined&&!obj(p.metadata))throw invalid('Invalid cancel metadata');id(p.id,'task id');let t=await find(token,p.id);if(t.status==='cancelled')return taskView(t,owner);if(terminal.has(t.status)||t.status==='executing')throw fail(-32002,'Task cannot be canceled');await collaboration.action(token,{operation:'cancel',taskId:p.id,requestId:'rpc-cancel-'+digest([owner,p.id])});t=await find(token,p.id);return taskView(t,owner);}
  if(method==='ListTasks'){fields(p,['tenant','contextId','status','pageSize','pageToken','historyLength','statusTimestampAfter','includeArtifacts'],'ListTasks parameters');if(p.tenant)throw invalid('Invalid tenant');if(p.contextId!==undefined)id(p.contextId,'contextId');if(p.status!==undefined&&!knownStates.has(p.status))throw invalid('Invalid task state');integer(p.pageSize,'pageSize',1,100);integer(p.historyLength,'historyLength');if(p.includeArtifacts!==undefined&&typeof p.includeArtifacts!=='boolean')throw invalid('Invalid includeArtifacts');
   let after=0;if(p.statusTimestampAfter!==undefined){if(typeof p.statusTimestampAfter!=='string'||!/^\d{4}-\d\d-\d\dT.*Z$/.test(p.statusTimestampAfter)||!Number.isFinite(after=Date.parse(p.statusTimestampAfter)))throw invalid('Invalid timestamp');}
   const pageSize=p.pageSize??50,query=digest([owner,p.contextId||null,p.status||null,p.statusTimestampAfter||null]);let cursor=null;if(p.pageToken!==undefined&&typeof p.pageToken!=='string')throw invalid('Invalid page token');
   if(p.pageToken){try{if(typeof p.pageToken!=='string'||p.pageToken.length>2048)throw Error();cursor=JSON.parse(Buffer.from(p.pageToken,'base64url').toString('utf8'));if(cursor.query!==query||!Number.isFinite(cursor.createdAt)||typeof cursor.id!=='string')throw Error();}catch{throw invalid('Invalid or mismatched page token');}}
   const all=(await collaboration.view(token)).tasks.filter(t=>(!p.contextId||t.roomId===p.contextId)&&(!p.status||p.status==='TASK_STATE_UNSPECIFIED'||status(t)===p.status)&&Date.parse(timestamp(t))>=after).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));
   const rest=cursor?all.filter(t=>t.createdAt<cursor.createdAt||t.createdAt===cursor.createdAt&&t.id.localeCompare(cursor.id)<0):all,rows=rest.slice(0,pageSize),last=rows.at(-1);
   return {tasks:rows.map(t=>taskView(t,owner,p.historyLength)),pageSize,totalSize:all.length,nextPageToken:rest.length>rows.length?Buffer.from(JSON.stringify({query,createdAt:last.createdAt,id:last.id})).toString('base64url'):''};
  }
  if(['SendStreamingMessage','SubscribeToTask'].includes(method))throw fail(-32004,'Streaming is not supported');
  if(/TaskPushNotificationConfig/.test(method))throw fail(-32003,'Push notifications are not supported');
  throw fail(-32601,'Method not found');
 }
 return {card,extendedCard,async handle({token,request,version,origin,signal}){
  let rpcId=null;
  try{if(!obj(request)||request.jsonrpc!=='2.0'||!Object.hasOwn(request,'id')||!['string','number'].includes(typeof request.id)||typeof request.method!=='string'||Object.keys(request).some(k=>!['jsonrpc','id','method','params'].includes(k)))throw fail(-32600,'Invalid JSON-RPC request');rpcId=request.id;
   if((version||'0.3')!==A2A_VERSION)throw fail(-32009,'Unsupported A2A version',{supportedVersions:[A2A_VERSION]});
   const a=await identities.authorize(token);const result=await dispatch(token,a.id,request.method,request.params??{},origin,signal);return {jsonrpc:'2.0',id:rpcId,result};
  }catch(e){const code=e.rpcCode??(e.status===400?-32602:e.code==='a2a_forbidden'?-32001:['a2a_busy','a2a_ended'].includes(e.code)&&request?.method==='CancelTask'?-32002:e.status===409?-32602:-32603);return {jsonrpc:'2.0',id:rpcId,error:{code,message:e.rpcCode?e.message:code===-32603?'Island service unavailable; retry the same message or query its task':e.message,...(e.data?{data:e.data}:{})}};}
 },close(){closing=true;}};
}
