import {mkdir,open,readFile,writeFile,rename,unlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';import {randomBytes,randomUUID,createHash,createHmac,timingSafeEqual} from 'node:crypto';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,code,status=409)=>Object.assign(Error(message),{code,status});
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
const sealed=data=>({...data,checksum:hash({...data,checksum:undefined})});
export function validateImportRecord(data,kind){
 if(!data||data.version!==1||data.checksum!==hash({...data,checksum:undefined}))throw fail('存档来源记录校验失败','import_record_corrupt',503);
 if(kind==='key'){if(!/^[a-f0-9]{64}$/.test(data.key))throw fail('签名配置无效','save_signing_key_invalid',503);return data;}
 if(!uuid(data.id)||data.sourceHash!==hash(data.data)||!Number.isFinite(data.createdAt))throw fail('导入原始内容与记录不一致','import_record_corrupt',503);
 if(kind==='preview'&&(data.requestHash!==importRequestHash(data.id,data.expectedVersion,data.clientId)||!Number.isFinite(data.expiresAt)||typeof data.allowed!=='boolean'))throw fail('导入预览校验失败','import_record_corrupt',503);
 return data;
}
async function atomic(file,data){data=sealed(data);await mkdir(join(file,'..'),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';let handle;try{handle=await open(temp,'wx',0o600);await handle.writeFile(JSON.stringify(data));await handle.sync();await handle.close();handle=null;await rename(temp,file);}finally{await handle?.close().catch(()=>{});await unlink(temp).catch(()=>{});}}
function unsigned(doc){const copy={...doc};delete copy.exportProof;return copy;}
export function importSummary(data){
 const s=data?.state||data,quantities=Object.values(s?.inventory||{}).filter(n=>Number.isSafeInteger(n)&&n>=0);
 return {day:Number.isSafeInteger(s?.day)?s.day:null,coins:Number.isFinite(s?.coins)?s.coins:null,name:typeof s?.playerProfile?.name==='string'?s.playerProfile.name.slice(0,24):'岛主',island:typeof s?.playerProfile?.islandName==='string'?s.playerProfile.islandName.slice(0,24):'',goods:quantities.reduce((a,b)=>a+b,0),activities:Number.isSafeInteger(s?.activities)?s.activities:0,buildings:Object.keys(s?.buildings||{}).length};
}
export function importRequestHash(id,expectedVersion,clientId){return hash([id,expectedVersion,String(clientId||'').slice(0,80)]);}
export function createSaveImportIO({root,now=()=>Date.now()}){
 let keyPromise;
 async function key(){
  if(keyPromise)return keyPromise;
  keyPromise=(async()=>{
   await mkdir(root,{recursive:true});const file=join(root,'save-export-key.json');let handle;
   try{handle=await open(file,'wx',0o600);await handle.writeFile(JSON.stringify(sealed({version:1,key:randomBytes(32).toString('hex')})));await handle.sync();}
   catch(error){if(error.code!=='EEXIST')throw error;}finally{await handle?.close();}
   for(let i=0;i<100;i++){try{const value=validateImportRecord(JSON.parse(await readFile(file,'utf8')),'key');if(value.version===1&&/^[a-f0-9]{64}$/.test(value.key))return Buffer.from(value.key,'hex');}catch{}await new Promise(r=>setTimeout(r,20));}
   throw fail('本机备份签名配置无法读取，已有存档未改动','save_signing_key_invalid',503);
  })().catch(e=>{keyPromise=null;throw e;});return keyPromise;
 }
 async function signature(doc){const secret=await key();return {version:1,keyId:createHash('sha256').update(secret).digest('hex').slice(0,16),signature:createHmac('sha256',secret).update(JSON.stringify(unsigned(doc))).digest('hex')};}
 async function classify(data){
  if(!data?.schema)return {kind:'external-state',signature:'none',label:'普通存档 · 来源未验证'};
  if(!data.exportProof)return {kind:'legacy-export',signature:'none',label:'旧版备份 · 来源未验证'};
  const proof=data.exportProof;if(proof.version!==1||!/^[a-f0-9]{16}$/.test(proof.keyId)||!/^[a-f0-9]{64}$/.test(proof.signature))throw fail('备份签名格式无效，未覆盖当前进度','import_signature');
  const expected=await signature(data);
  if(proof.keyId!==expected.keyId)return {kind:'foreign-export',signature:'foreign',label:'另一安装环境的备份 · 本机无法验证签名'};
  if(!timingSafeEqual(Buffer.from(proof.signature,'hex'),Buffer.from(expected.signature,'hex')))throw fail('备份签名与文件内容不一致，请选择原备份文件','import_signature');
  return {kind:'local-export',signature:'local',label:'本机签名备份 · 文件内容完整'};
 }
 const folder=p=>join(p.dir,'imports'),migration=p=>join(folder(p),'browser-migration.json');
 async function migrationData(p){try{return validateImportRecord(JSON.parse(await readFile(migration(p),'utf8')),'migration');}catch(e){if(e.code==='ENOENT')return null;throw fail('浏览器旧档保留文件无法读取，未覆盖当前进度','migration_corrupt',503);}}
 async function prune(p){
  await mkdir(folder(p),{recursive:true});const rows=[];
  for(const f of await readdir(folder(p))){if(!/^[a-f0-9-]{36}\.json$/.test(f))continue;try{const v=validateImportRecord(JSON.parse(await readFile(join(folder(p),f),'utf8')),'preview');if(!v.completed&&v.expiresAt<now())await unlink(join(folder(p),f));else rows.push({file:f,...v});}catch{}}
  const completed=rows.filter(r=>r.completed).sort((a,b)=>b.createdAt-a.createdAt);
  for(const r of completed.slice(20))await unlink(join(folder(p),r.file));
  if(rows.filter(r=>!r.completed).length>=5)throw fail('已有五份待导入预览，请先使用现有预览或稍后重试','import_preview_limit');
 }
 return{
  hash,
  async export(doc){return {...doc,exportProof:await signature(doc)};},
  classify,
  async captureMigration(p,data){let value=await migrationData(p);if(!value){value={version:1,id:randomUUID(),createdAt:now(),sourceHash:hash(data),summary:importSummary(data),data,imported:false};await atomic(migration(p),value);}return !value.imported?{id:value.id,summary:value.summary}:null;},
  async migration(p){const value=await migrationData(p);return value&&!value.imported?{id:value.id,summary:value.summary}:null;},
  async migrationSource(p,id){const value=await migrationData(p);if(!value||id&&value.id!==id)throw fail('未找到这份浏览器旧档','migration_missing',404);return value;},
  async migrationImported(p,id){const value=await migrationData(p);if(value&&value.id===id)await atomic(migration(p),{...value,imported:true,importedAt:now()});},
  async prepare(p,{data,expectedVersion,clientId='',requestId=randomUUID(),source='file',migrationId=null,origin,allowed=true,blockReason=null,current}){
   if(!uuid(requestId))throw fail('导入预览编号无效','import_preview_invalid');
   const file=join(folder(p),requestId+'.json'),sourceHash=hash(data),requestHash=importRequestHash(requestId,expectedVersion,clientId);
   try{const old=validateImportRecord(JSON.parse(await readFile(file,'utf8')),'preview');if(old.sourceHash!==sourceHash||old.requestHash!==requestHash)throw fail('同一预览编号不能更换文件或进度','import_preview_conflict');return {...old, data:undefined};}catch(e){if(e.code!=='ENOENT')throw e;}
   await prune(p);const value={version:1,id:requestId,createdAt:now(),expiresAt:now()+15*60*1000,completed:false,data,expectedVersion,clientId:String(clientId).slice(0,80),requestHash,sourceHash,source,migrationId,origin,allowed,blockReason,summary:importSummary(data),current:current?importSummary(current.state):null};
   await atomic(file,value);return {...value,data:undefined};
  },
  async candidate(p,id){if(!uuid(id))throw fail('需要先预览要导入的存档','import_preview_required');try{return validateImportRecord(JSON.parse(await readFile(join(folder(p),id+'.json'),'utf8')),'preview');}catch(e){if(e.code==='ENOENT')throw fail('预览已过期或不存在，请重新预览文件','import_preview_missing');throw e;}},
  async complete(p,value){await atomic(join(folder(p),value.id+'.json'),{...value,completed:true,completedAt:now()});},
 };
}
