import {mkdir,readFile,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {atomicJSON} from './atomicJson.mjs';
import {RESIDENTS} from '../src/world.js';
const fail=(message,code,status=409)=>Object.assign(Error(message),{code,status});
const text=(v,n)=>typeof v==='string'?v.slice(0,n):'';
const alive=pid=>{if(!Number.isSafeInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true}catch(e){return e.code!=='ESRCH'}};
export function residentChatContext(s,id){
 const p={...RESIDENTS[id],...(s.npcProfiles?.[id]||{})},career=s.npcCareers?.[id];
 return {resident:{id,name:text(p.name,24),job:text(p.job,60),personality:text(p.personality,200),backstory:text(p.backstory,240),lifeGoal:text(p.lifeGoal,160),speechStyle:text(p.speechStyle,120),interests:(p.interest||[]).slice(0,6)},
  world:{day:s.day,playerName:text(s.playerProfile?.name||'岛主',24),needs:s.npcNeeds?.[id],recentWork:(career?.history||[]).slice(-3).map(x=>text(x.result||x.text||x.action,120)),memories:(s.npcMemory?.[id]||[]).slice(-5).map(x=>text(x.text,160)),neighbors:Object.entries(s.npcRelations?.[id]||{}).filter(([key,r])=>RESIDENTS[key]&&r.interactions>0).slice(0,5).map(([key,r])=>({name:text(s.npcProfiles?.[key]?.name||RESIDENTS[key].name,24),affinity:r.affinity,tension:r.tension,trust:r.trust})),recentConversations:(s.npcConversations||[]).filter(c=>c.participants?.includes(id)).slice(-2).map(c=>text(c.summary,160))}};
}
// Private server journal, separate from frame-driven island autosaves. One directory per LAN owner.
export function createResidentChatStore({directory,saves,run,now=Date.now}){
 const folder=resolve(directory,'resident-chats'),active=new Map();
 async function locate(theme,id,input={}){
  if(!['pixel','origami'].includes(theme)||!Number.isInteger(id)||id<0||id>=15)throw fail('请选择一位岛上居民','resident_chat_identity',400);
  const doc=await saves.current(theme);if(!doc)throw fail('请先进入自己的小岛','resident_chat_world',409);
  const worldKey=doc.state.saveSlot||'legacy-'+theme;
  if(input.saveSlot!==worldKey)throw fail('小岛存档已变化，请重新打开居民对话','resident_chat_world_changed');
  const key=theme+'-'+createHash('sha256').update(worldKey).digest('hex').slice(0,32)+'-'+id;
  await mkdir(folder,{recursive:true});return {state:doc.state,worldKey,key,file:resolve(folder,key+'.json'),lock:resolve(folder,key+'.lock'),theme,id};
 }
 async function read(c){
  try{const raw=await readFile(c.file,'utf8');if(raw.length>1000000)throw Error('size');const d=JSON.parse(raw);if(d.version!==1||d.worldKey!==c.worldKey||d.npcId!==c.id||!Array.isArray(d.turns)||d.turns.length>80||d.turns.some(t=>typeof t.id!=='string'||typeof t.message!=='string'||!['pending','completed','failed'].includes(t.status)))throw Error('schema');return d;}
  catch(e){if(e.code==='ENOENT')return {version:1,worldKey:c.worldKey,npcId:c.id,turns:[]};throw fail('这位居民的聊天记录暂时无法读取，原文件已保留','resident_chat_corrupt',503);}
 }
 const view=d=>({npcId:d.npcId,worldKey:d.worldKey,turns:d.turns.map(({ownerPid,...t})=>t)});
 async function lock(c){
  for(let attempt=0;attempt<2;attempt++)try{const h=await open(c.lock,'wx',0o600);await h.writeFile(JSON.stringify({pid:process.pid}));await h.close();return;}catch(e){if(e.code!=='EEXIST')throw e;let l;try{l=JSON.parse(await readFile(c.lock,'utf8'))}catch{throw fail('居民正在整理聊天记录，请稍后重试','resident_chat_busy',429)}if(!Number.isInteger(l.pid)||alive(l.pid))throw fail('这位居民正在回复，请稍后再发送','resident_chat_busy',429);await unlink(c.lock).catch(()=>{});}
  throw fail('聊天记录正在使用中','resident_chat_busy',429);
 }
 async function recover(d,c){
  if(!d.turns.some(t=>t.status==='pending'&&!alive(t.ownerPid)))return d;
  await lock(c);try{d=await read(c);for(const t of d.turns)if(t.status==='pending'&&!alive(t.ownerPid)){t.status='failed';t.error='上次对话因服务重启而中断，请重新发送。';delete t.ownerPid;}await atomicJSON(c.file,d);return d;}finally{await unlink(c.lock).catch(()=>{});}
 }
 return {
  async history(theme,id,input){const c=await locate(theme,id,input);return view(await recover(await read(c),c));},
  async send(theme,id,input){
   if(typeof input?.message!=='string'||!input.message.trim()||input.message.length>1200||typeof input.requestId!=='string'||!/^[-a-zA-Z0-9_]{8,80}$/.test(input.requestId))throw fail('请填写 1–1200 字的消息','resident_chat_input',400);
   const c=await locate(theme,id,input),message=input.message.trim();let d=await read(c),prior=d.turns.find(t=>t.id===input.requestId);
   if(prior){if(prior.message!==message)throw fail('消息编号已用于另一段对话','resident_chat_replay');return view(await recover(d,c));}
   if(active.size)throw fail('上一位居民正在回复，稍后就可以继续聊','resident_chat_busy',429);
   await lock(c);active.set(c.key,true);
   try{
    d=await read(c);prior=d.turns.find(t=>t.id===input.requestId);if(prior){if(prior.message!==message)throw fail('消息编号已用于另一段对话','resident_chat_replay');return view(d);}
    const history=d.turns.filter(t=>t.status==='completed').slice(-12).map(t=>({user:t.message,resident:t.reply}));
    const turn={id:input.requestId,message,status:'pending',at:now(),ownerPid:process.pid};d.turns=d.turns.slice(-79);d.turns.push(turn);await atomicJSON(c.file,d);
    try{
     const result=await run({...residentChatContext(c.state,id),history,message,theme,saveSlot:c.worldKey});
     if(result.source!=='deepseek'||typeof result.reply!=='string'||!result.reply.trim()||result.reply.length>2400)throw fail('居民没有返回完整答复，请重新发送','resident_chat_reply',503);
     Object.assign(turn,{status:'completed',reply:result.reply.trim(),model:result.model,ledgerRunId:result.ledgerRunId,completedAt:now()});
    }catch(e){Object.assign(turn,{status:'failed',error:['provider_balance','model_http_402'].includes(e.code)?'模型额度暂时不足，请稍后重试。':'这次未能收到回复，消息已保留，可以重新发送。'});}
    delete turn.ownerPid;await atomicJSON(c.file,d);return view(d);
   }finally{active.delete(c.key);await unlink(c.lock).catch(()=>{});}
  }
 };
}
