import {mkdir,readFile,writeFile,rename,unlink,open,stat} from 'node:fs/promises';import {resolve,join} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {validateCoCreationPack,coCreationChallenge,CO_CREATION_LIMITS} from '../src/cocreation.js';
import {createCraftGame,applyCraftTrace,craftResult} from '../src/craftGameReplay.js';
const clone=v=>structuredClone(v),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),fail=(message,code='cocreation_conflict',status=409)=>Object.assign(Error(message),{code,status});
const ops=new Set(['import','edit','submit','review','activate','rollback','trial_begin','trial_checkpoint','trial_finish','trial_cancel']);
const inputKeys=['operation','requestId','expectedVersion','packageId','pack','version','hash','note','decision','challengeId','worldKey','runId','batch','events'];
async function atomic(file,value){const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(tmp,file);}
function check(doc,theme){if(!doc||doc.schema!==1||doc.theme!==theme||typeof doc.version!=='string'||!Number.isSafeInteger(doc.revision)||doc.revision<0||hash({...doc,checksum:undefined})!==doc.checksum)throw fail('共创档案校验失败，原文件已保留','cocreation_corrupt',503);return doc;}
export function createCoCreationStore({directory,now=()=>Date.now(),worldExists=async()=>true}){
 const root=resolve(directory,'_cocreation');
 function paths(theme){if(!['pixel','origami'].includes(theme))throw fail('画风无效','cocreation_invalid',400);const dir=join(root,theme);return{dir,file:join(dir,'current.json'),previous:join(dir,'previous.json'),lock:join(dir,'write.lock')};}
 async function withLock(theme,fn){const p=paths(theme);await mkdir(p.dir,{recursive:true});const token=randomUUID(),start=Date.now();let acquired=false;
 while(!acquired){try{const f=await open(p.lock,'wx',0o600);await f.writeFile(JSON.stringify({pid:process.pid,token}));await f.close();acquired=true;}catch(e){if(e.code!=='EEXIST')throw e;try{const owner=JSON.parse(await readFile(p.lock,'utf8'));try{process.kill(owner.pid,0)}catch(e){if(e.code!=='EPERM'){await unlink(p.lock);continue;}}}catch{try{if(Date.now()-(await stat(p.lock)).mtimeMs>30000){await unlink(p.lock);continue;}}catch{}}
 if(Date.now()-start>5000)throw fail('共创档案正在写入，请稍后重试','cocreation_busy',503);await new Promise(r=>setTimeout(r,35));}}
 try{return await fn(p);}finally{try{if(JSON.parse(await readFile(p.lock,'utf8')).token===token)await unlink(p.lock)}catch{}}}
 async function read(p,theme){try{return check(JSON.parse(await readFile(p.file,'utf8')),theme);}catch(e){if(e.code!=='ENOENT')throw e.code==='cocreation_corrupt'?e:fail('共创档案无法读取，原文件已保留','cocreation_corrupt',503);const doc={schema:1,theme,revision:0,version:randomUUID(),updatedAt:now(),packages:{},trial:null,results:[],events:[],requests:[]};doc.checksum=hash(doc);await atomic(p.file,doc);return doc;}}
 function event(d,type,text,extra={}){d.events.push({id:randomUUID(),at:now(),type,text,...extra});d.events=d.events.slice(-200);}
 function packageRow(d,id){const r=d.packages[id];if(!r)throw fail('作品不存在','cocreation_missing',404);return r;}
 function versionRow(row,n){const r=row.versions.find(v=>v.number===n);if(!r)throw fail('版本不存在','cocreation_missing',404);return r;}
 function draft(row){const r=row.versions.at(-1);if(!['draft','changes_requested'].includes(r.phase))throw fail('提交版本已冻结；请从当前作品另建草稿','cocreation_frozen');return r;}
 function newVersion(row,pack){if(row.versions.length>=CO_CREATION_LIMITS.versions)throw fail('每件作品最多20个保留版本，请导出后创建新作品','cocreation_limit');const v={number:(row.versions.at(-1)?.number||0)+1,phase:'draft',hash:hash(pack),pack:clone(pack),createdAt:now(),review:null,publishedAt:null};row.versions.push(v);return v;}
 function validateInput(i){if(!i||Array.isArray(i)||Object.keys(i).some(k=>!inputKeys.includes(k))||!ops.has(i.operation)||!/^[a-zA-Z0-9-]{8,80}$/.test(i.requestId||''))throw fail('共创命令无效','cocreation_invalid',400);}
 function visible(d){const out=clone(d);delete out.requests;delete out.checksum;return out;}
 return{
 directory:root,
 async current(theme){return withLock(theme,async p=>visible(await read(p,theme)));},
 async raw(theme){return withLock(theme,p=>read(p,theme));},
 async export(theme,id,number){return withLock(theme,async p=>{const d=await read(p,theme),r=versionRow(packageRow(d,id),number);return{pack:clone(r.pack),sha256:r.hash,version:r.number,phase:r.phase};});},
 async restorePrevious(theme,{expectedVersion}={}){return withLock(theme,async p=>{const d=await read(p,theme);if(d.version!==expectedVersion)throw fail('另一窗口已经更新共创档案');const previous=check(JSON.parse(await readFile(p.previous,'utf8')),theme);previous.version=randomUUID();previous.revision=d.revision+1;previous.updatedAt=now();delete previous.checksum;previous.checksum=hash(previous);await atomic(p.file,previous);return visible(previous);});},
 async action(theme,i){validateInput(i);return withLock(theme,async p=>{
 const old=await read(p,theme),fingerprint=hash({...i,expectedVersion:undefined}),prior=old.requests.find(r=>r.id===i.requestId);
 if(prior){if(prior.hash!==fingerprint)throw fail('同一请求不能变更共创内容','cocreation_id_conflict');return{document:visible(old),...clone(prior.response),replayed:true};}
 if(i.expectedVersion!==old.version)throw fail('另一窗口更新了共创版本，请保留编辑内容后刷新','cocreation_version');
 const d=clone(old);let ticket=null,receipt=null,selection=null;
 if(i.operation==='import'){
  const pack=validateCoCreationPack(i.pack);if(d.packages[pack.id])throw fail('作品编号已存在，请打开已有作品或修改新包编号','cocreation_exists');if(Object.keys(d.packages).length>=CO_CREATION_LIMITS.packages)throw fail('本地每套画风最多24件作品','cocreation_limit');
  const row={id:pack.id,active:null,versions:[]};d.packages[pack.id]=row;const v=newVersion(row,pack);selection={packageId:pack.id,version:v.number};event(d,'import','已导入草稿：'+pack.title,selection);
 }else if(['edit','submit','review','activate','rollback'].includes(i.operation)){
  const row=packageRow(d,i.packageId);let v;
  if(i.operation==='edit'){const pack=validateCoCreationPack(i.pack);if(pack.id!==row.id)throw fail('编辑不能更改作品编号','cocreation_invalid',400);const latest=row.versions.at(-1);if(['draft','changes_requested'].includes(latest.phase)){v=draft(row);v.pack=clone(pack);v.hash=hash(pack);v.phase='draft';v.review=null;}else v=newVersion(row,pack);event(d,'edit','已保存共创草稿',{packageId:row.id,version:v.number});}
  else {v=versionRow(row,i.version);if(i.hash!==v.hash)throw fail('审核内容摘要已变化，请重新查看','cocreation_hash');
   if(i.operation==='submit'){if(v!==row.versions.at(-1)||v.phase!=='draft')throw fail('只能提交最新草稿','cocreation_frozen');v.phase='submitted';v.submittedAt=now();event(d,'submit','已冻结待审版本',{packageId:row.id,version:v.number,hash:v.hash});}
   else if(i.operation==='review'){if(v.phase!=='submitted'||!['approve','request_changes'].includes(i.decision))throw fail('仅能审核待审版本','cocreation_review');const note=String(i.note||'').trim();if(note.length<4||note.length>500)throw fail('审核说明需4–500字','cocreation_invalid',400);v.phase=i.decision==='approve'?'approved':'changes_requested';v.review={decision:i.decision,note,reviewer:'本机岛主',at:now(),hash:v.hash};event(d,'review',i.decision==='approve'?'版本审核通过':'已退回修改',{packageId:row.id,version:v.number,note});}
   else {if(v.phase!=='approved'||i.operation==='rollback'&&!v.publishedAt)throw fail('只能启用已审核版本；回退目标必须曾发布','cocreation_not_approved');row.active={version:v.number,hash:v.hash};v.publishedAt??=now();event(d,i.operation,i.operation==='rollback'?'已回退到历史发布版本':'已在岛内共创书架启用',{packageId:row.id,version:v.number,hash:v.hash});}
  }
  selection={packageId:row.id,version:v.number};
 }else if(i.operation==='trial_begin'){
  if(d.trial)throw fail('上次共创练习还在进行，请继续或结束','cocreation_trial_active');const row=packageRow(d,i.packageId),v=versionRow(row,i.version);
  if(row.active?.version!==v.number||row.active.hash!==v.hash||i.hash!==v.hash||v.phase!=='approved')throw fail('请使用当前审核发布的挑战','cocreation_not_active');const c=coCreationChallenge(v.pack,i.challengeId);if(!c)throw fail('挑战不存在','cocreation_missing',404);
  if(typeof i.worldKey!=='string'||i.worldKey.length>160||!await worldExists(theme,i.worldKey))throw fail('当前岛屿身份已变化，请重新打开工坊','cocreation_world');
  ticket={kind:'cocreation',runId:randomUUID(),packageId:row.id,packageVersion:v.number,packageHash:v.hash,challengeId:c.id,name:c.title,author:v.pack.author,brief:c.brief,hints:c.hints,recipeId:c.recipe.id,building:c.building,seed:c.seed,difficulty:c.difficulty,minQuality:c.minQuality,worldKey:i.worldKey,theme,startedAt:now(),expiresAt:now()+86400000,nextBatch:1,game:createCraftGame(c.building,c.seed,c.difficulty)};d.trial=ticket;event(d,'trial_begin','共创练习开场：'+c.title,{runId:ticket.runId,packageId:row.id,version:v.number});
 }else{
  const t=d.trial;if(!t||t.runId!==i.runId)throw fail('练习来自旧的运行或已结束','cocreation_trial_stale');
  if(i.operation!=='trial_cancel'&&!await worldExists(theme,t.worldKey))throw fail('当前岛屿身份已变化，请结束旧练习后重开','cocreation_world');
  if(i.operation==='trial_checkpoint'){if(now()>t.expiresAt)throw fail('练习已过期，请结束后重开','cocreation_expired');if(i.batch!==t.nextBatch)throw fail('练习操作批次顺序不符','cocreation_batch');try{applyCraftTrace(t.game,i.events)}catch{throw fail('练习操作无法通过规则重放','cocreation_input');}if(t.game.elapsed*1000>now()-t.startedAt+150)throw fail('练习操作超出实际时间','cocreation_clock');t.nextBatch++;ticket=t;}
  else {const r=craftResult(t.game);if(i.operation==='trial_finish'&&!r)throw fail('请先完成关卡再提交成绩','cocreation_unfinished');if(i.operation==='trial_finish'&&now()>t.expiresAt)throw fail('练习已过期，请结束后重开','cocreation_expired');
   receipt={runId:t.runId,packageId:t.packageId,packageVersion:t.packageVersion,packageHash:t.packageHash,challengeId:t.challengeId,author:t.author,worldKey:t.worldKey,at:now(),outcome:i.operation==='trial_cancel'?'cancelled':r.passed&&r.quality>=t.minQuality?'passed':'practiced',result:i.operation==='trial_cancel'?null:clone(r),target:t.minQuality};d.results.push(receipt);d.results=d.results.slice(-200);d.trial=null;event(d,i.operation,receipt.outcome==='passed'?'挑战达标，练习成绩已记录':receipt.outcome==='cancelled'?'已结束共创练习':'练习成绩已记录，目标尚未达成',{runId:t.runId,packageId:t.packageId,version:t.packageVersion});}
 }
 d.version=randomUUID();d.revision++;d.updatedAt=now();const response={ticket:ticket?clone(ticket):null,receipt,selection};d.requests.push({id:i.requestId,hash:fingerprint,response});d.requests=d.requests.slice(-200);delete d.checksum;d.checksum=hash(d);await atomic(p.previous,old);await atomic(p.file,d);return{document:visible(d),...response,replayed:false};
 });}
 };
}
