import {validateImportRecord} from './saveImportIO.mjs';
import {inspectSqliteBackup,relocateSqliteBackup} from './sqliteBackup.mjs';
import {mkdir,lstat,readdir,readFile,open,rename,unlink} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {resolve,join,dirname,basename,relative,sep,win32,isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {acquireDataLease,alive,exists,plainPath,restoreJournalPath,assertNoLegacyRuntime} from './dataLease.mjs';
import {validateSavedDocument} from './saveStore.mjs';
const fail=(message,code='backup_invalid')=>Object.assign(Error(message),{code,status:503});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),hash=value=>sha(JSON.stringify(value));
const SCHEMA=79,MAX_FILES=250000,MAX_BYTES=20*1024**3;
const pathKey=p=>process.platform==='win32'?resolve(p).toLowerCase():resolve(p);
const under=(root,p)=>pathKey(root)===pathKey(p)||pathKey(p).startsWith(pathKey(root)+sep);
const lockNames=new Set(['write.lock','identity.lock','social.lock','activities.lock','a2a.lock','recruitment.lock','cocreation.lock']);
export function safeRelative(value){
 if(typeof value!=='string'||!value||value.length>2000||/[\\:\x00-\x1f]/.test(value)||value.startsWith('/')||value.split('/').some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw fail('备份路径无效','backup_path');
 return value;
}
async function walk(root){
 await plainPath(root);const files=[],directories=[];
 async function scan(dir,parts=[]){for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
 const partsNext=[...parts,entry.name],key=safeRelative(partsNext.join('/')),file=join(dir,entry.name),s=await lstat(file);
 if(s.isSymbolicLink())throw fail('数据中存在链接，未复制到备份','backup_link');
 if(s.isDirectory()){directories.push(key);await scan(file,partsNext)}else if(s.isFile())files.push({path:key,source:file,bytes:s.size,mtime:s.mtimeMs,ino:s.ino,dev:s.dev});else throw fail('数据中存在不支持的特殊文件','backup_special');}}
 await scan(root);if(files.length>MAX_FILES||files.reduce((n,f)=>n+f.bytes,0)>MAX_BYTES)throw fail('备份超过当前工具容量','backup_limit');
 const keys=new Set();for(const f of [...directories.map(path=>({path})),...files]){const k=f.path.toLowerCase();if(keys.has(k))throw fail('数据文件名在跨平台恢复时冲突','backup_path_collision');keys.add(k);}
 return {files,directories};
}
async function fileHash(file){const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex')}
async function copyChecked(source,target){
 await mkdir(dirname(target),{recursive:true,mode:0o700});const before=await lstat(source);if(!before.isFile()||before.isSymbolicLink())throw fail('数据文件在复制前变化','backup_changed');
 const h=createHash('sha256'),filter=new Transform({transform(chunk,encoding,cb){h.update(chunk);cb(null,chunk)}});
 await pipeline(createReadStream(source),filter,createWriteStream(target,{flags:'wx',mode:0o600}));
 const handle=await open(target,'r+');try{await handle.sync()}finally{await handle.close()}
 const after=await lstat(source);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ino!==after.ino||before.dev!==after.dev)throw fail('数据在复制过程中变化，备份未发布','backup_changed');
 return {bytes:before.size,sha256:h.digest('hex')};
}
async function atomic(file,value){const temp=file+'.'+randomUUID()+'.tmp';let h;try{h=await open(temp,'wx',0o600);await h.writeFile(JSON.stringify(value,null,2)+'\n');await h.sync();await h.close();h=null;await rename(temp,file)}finally{await h?.close().catch(()=>{});await unlink(temp).catch(()=>{})}}
const importMetadata=p=>/(?:^|\/)save-export-key\.json$|(?:^|\/)(?:pixel|origami)\/imports\/(?:browser-migration|[a-f0-9-]{36})\.json$/.test(p);
const metadataPath=p=>importMetadata(p)||/^_lan\/(?:identity(?:\.previous)?|activities(?:\.previous)?|social|a2a|social-settlement|activities-settlement|enrollment)\.json$/.test(p)
 ||/(?:^|\/)(?:pixel|origami)\/(?:current|previous|recruitment(?:\.previous)?|cocreation(?:\.previous)?|lan-wallet)\.json$/.test(p)
 ||/(?:^|\/)(?:runs|_runs|artifacts|_artifacts)\/(?:current|previous)\.json$/.test(p)
 ||/(?:^|\/)(?:artifacts|_artifacts)\/captures\/capture-[a-f0-9]{32}\.json$/.test(p)
 ||/^_lan\/agents\/[a-f0-9-]{36}\/conversation\.json$/.test(p);
const requiredCurrent=p=>metadataPath(p)&&!/(?:previous|\.previous)\.json$/.test(p);
function envelopeCheck(d,p){
 if(importMetadata(p)){validateImportRecord(d,p.endsWith('save-export-key.json')?'key':p.endsWith('browser-migration.json')?'migration':'preview');return;}
 if(!/(?:conversation|enrollment)\.json$|\/captures\//.test(p)&&typeof d.checksum!=='string')throw fail('正式账本缺少校验值','backup_checksum');
 if(/(?:^|\/)_cocreation\//.test(p)){if(d.schema!==1||!d.packages||!Array.isArray(d.requests)||d.checksum!==hash({...d,checksum:undefined}))throw fail('共创账本结构或校验无效','backup_ledger');return;}
 if(/(?:pixel|origami)\/current\.json$/.test(p)){validateSavedDocument(d,p.split('/').at(-2));return;}
 if(/lan-wallet\.json$/.test(p)){if(d.schema!==1||!d.checkpoint||!d.holds||!d.receipts)throw fail('跨岛物资账本结构错误','backup_ledger');validateSavedDocument(d.checkpoint,d.theme);}
 if(d.checksum){const body=d.schema===43||d.schema===44?d.state:d.record??{...d,checksum:undefined};if(d.checksum!==hash(body))throw fail('正式账本校验失败，未发布备份','backup_checksum');}
 if(/(?:runs|_runs)\/current\.json$/.test(p)&&(d.schema!==43||!Array.isArray(d.state?.runs)))throw fail('运行账本结构错误','backup_ledger');
 if(/(?:artifacts|_artifacts)\/current\.json$/.test(p)&&(d.schema!==44||!Array.isArray(d.state?.versions)))throw fail('成果账本结构错误','backup_ledger');
 if(/recruitment\.json$/.test(p)&&(d.schema!==1||!Array.isArray(d.record?.contracts)))throw fail('聘约账本结构错误','backup_ledger');
 if(p==='_lan/identity.json'&&(d.schema!==1||!d.accounts||!d.rooms||!Array.isArray(d.sessions)))throw fail('岛主档案结构错误','backup_ledger');
 if(p==='_lan/social.json'&&(d.version!==1||!Array.isArray(d.events)||!d.rooms))throw fail('社交账本结构错误','backup_ledger');
 if(p==='_lan/activities.json'&&(d.schema!==1||!d.events||!d.follows))throw fail('活动账本结构错误','backup_ledger');
 if(p==='_lan/a2a.json'&&(d.version!==1||!d.tasks))throw fail('管家协作账本结构错误','backup_ledger');
 if(/conversation\.json$/.test(p)&&(d.version!==1||!Array.isArray(d.jobs)))throw fail('对话任务账本结构错误','backup_ledger');
 if(/-settlement\.json$/.test(p)&&(!d.next||!d.old||!Array.isArray(d.steps)||!Number.isInteger(d.applied)))throw fail('未完成结算结构错误','backup_ledger');
}
async function inspectTree(root,inventory){
 const nativeSessions=[];for(const file of inventory.files)if(/(?:^|\/)state\.db$/.test(file.path)){const result=await inspectSqliteBackup(file.source);if(result.canonical)nativeSessions.push({path:file.path,...result});}
 const docs=new Map(),warnings=[],components={saves:0,identities:0,recruitments:0,wallets:0,settlements:0,conversations:0,runLedgers:0,artifactLedgers:0,artifactSnapshots:0,cocreation:0,social:0,activities:0,a2a:0};
 for(const file of inventory.files)if(metadataPath(file.path)){
  let d;try{d=JSON.parse(await readFile(join(root,...file.path.split('/')),'utf8'));if(requiredCurrent(file.path))envelopeCheck(d,file.path);}
  catch(e){if(requiredCurrent(file.path))throw e.code?e:fail('正式数据文件无法解析','backup_ledger');warnings.push({path:file.path,code:'historical_file_unreadable'});continue;}
  docs.set(file.path,d);
  if(/(?:^|\/)_cocreation\//.test(file.path)&&/current\.json$/.test(file.path))components.cocreation++;
  else if(/(?:pixel|origami)\/current\.json$/.test(file.path))components.saves++;
  else if(file.path==='_lan/identity.json')components.identities++;
  else if(/recruitment\.json$/.test(file.path))components.recruitments++;
  else if(/lan-wallet\.json$/.test(file.path))components.wallets++;
  else if(/-settlement\.json$/.test(file.path))components.settlements++;
  else if(/conversation\.json$/.test(file.path))components.conversations++;
  else if(/(?:runs|_runs)\/current\.json$/.test(file.path))components.runLedgers++;
  else if(/(?:artifacts|_artifacts)\/current\.json$/.test(file.path))components.artifactLedgers++;
  else if(/cocreation\.json$/.test(file.path))components.cocreation++;
  else if(file.path==='_lan/social.json')components.social++;
  else if(file.path==='_lan/activities.json')components.activities++;
  else if(file.path==='_lan/a2a.json')components.a2a++;
 }
 const identity=docs.get('_lan/identity.json'),accounts=new Set(Object.keys(identity?.accounts||{})),paths=new Set(inventory.files.map(f=>f.path)),captures=new Map();
 for(const [p,d]of docs)if(/\/captures\/capture-[a-f0-9]{32}\.json$/.test(p)){
  const prefix=p.slice(0,p.lastIndexOf('/')+1),snapshot=prefix+d.id+'.'+d.format;if(d.schema!==44||!/^capture-[a-f0-9]{32}$/.test(d.id)||!/^\w+$/.test(d.format)||!paths.has(snapshot))throw fail('成果缺少原始版本文件','backup_artifact_missing');
  if(await fileHash(join(root,...snapshot.split('/')))!==d.sha256||(await lstat(join(root,...snapshot.split('/')))).size!==d.bytes)throw fail('成果版本内容校验失败','backup_artifact_corrupt');
  captures.set(prefix+d.id,d);components.artifactSnapshots++;
 }
 for(const [p,d]of docs){
  if(/^_lan\/(?:agents|islands)\//.test(p)&&!accounts.has(p.split('/')[2]))throw fail('数据缺少对应岛主身份','backup_reference');
  if(/(?:artifacts|_artifacts)\/current\.json$/.test(p))for(const v of d.state.versions){const cap=captures.get(p.slice(0,p.lastIndexOf('/'))+'/captures/'+v.id);if(!cap||cap.sha256!==v.sha256||cap.ledgerRunId!==v.runId)throw fail('成果版本索引缺少对应回执','backup_reference');}
  if(/-settlement\.json$/.test(p))for(const s of d.steps)if(!accounts.has(s.accountId)||!paths.has('_lan/islands/'+s.accountId+'/'+s.theme+'/current.json'))throw fail('未结算事务缺少对应小岛','backup_reference');
 }
 if(identity)for(const room of Object.values(identity.rooms))for(const id of [room.owner,...Object.keys(room.members||{})])if(!accounts.has(id))throw fail('会客房间缺少参与者身份','backup_reference');
 if(nativeSessions.length)components.hermesSessions=nativeSessions;
 return {docs,components,warnings};
}
async function assertQuiet(root,inventory){
 for(const f of inventory.files){
  if(lockNames.has(basename(f.path))&&!f.path.includes('/documents/')){let owner;try{owner=JSON.parse(await readFile(f.source,'utf8'))}catch{throw fail('发现无法核对的写入锁','data_lock_unknown')}
   if(!Number.isSafeInteger(owner.pid)||owner.pid<=0)throw fail('写入锁没有可核对的进程身份','data_lock_unknown');
   if(alive(owner.pid))throw fail('仍有账本写入进程，未开始备份','data_busy');}
  if(/(?:runs|_runs)\/current\.json$/.test(f.path)){let d;try{d=JSON.parse(await readFile(f.source,'utf8'))}catch{throw fail('运行记录无法核对','backup_ledger')}
   if(d.state?.runs?.some(r=>r.phase==='running'&&alive(r.ownerPid)))throw fail('仍有模型运行，未开始备份','data_busy');}
  if(/recruitment\.json$/.test(f.path)){const d=JSON.parse(await readFile(f.source,'utf8'));if(d.record?.contracts?.some(c=>['planning','cancelling'].includes(c.phase)&&alive(c.ownerPid)))throw fail('仍有招聘运行，未开始备份','data_busy');}
 }
}
function referencedSources(docs){const refs=new Set();for(const [p,d]of docs)if(/(?:artifacts|_artifacts)\/(?:current|previous)\.json$/.test(p)){
 for(const v of d.state?.versions||[])if(v.path)refs.add(v.path);for(const v of Object.values(d.state?.documents||{}))if(v.path)refs.add(v.path);
 }else if(/\/captures\/capture-[a-f0-9]{32}\.json$/.test(p))for(const key of ['sourcePath','backupPath'])if(typeof d[key]==='string')refs.add(d[key]);return [...refs];}
function prefixRelative(origin,value){const windows=/^[a-z]:[\\/]/i.test(origin)||origin.startsWith('\\\\'),api=windows?win32:{resolve,relative,sep,isAbsolute};if(!api.isAbsolute(value))return null;
 const root=api.resolve(origin),file=api.resolve(value),a=windows?root.toLowerCase():root,b=windows?file.toLowerCase():file;
 if(a===b)return '';if(!b.startsWith(a+api.sep))return null;return api.relative(root,file).split(api.sep).join('/');}
export async function createDataBackup({directory,output,documentRoots=[],legacyCheck=true,fault=async()=>{}}){
 const root=await plainPath(directory),out=await plainPath(output);if(!await exists(root))throw fail('数据目录不存在','data_missing');
 if(under(root,out)||under(out,root))throw fail('备份必须放在数据目录之外','backup_destination');if(await exists(out))throw fail('目标备份已存在，未覆盖','backup_exists');
 if(legacyCheck)await assertNoLegacyRuntime();const lease=await acquireDataLease({directory:root,mode:'backup'});const stage=out+'.staging-'+randomUUID();
 try{const original=await walk(root);await assertQuiet(root,original);const checked=await inspectTree(root,original);
  await mkdir(join(stage,'payload'),{recursive:true,mode:0o700});for(const dir of original.directories)await mkdir(join(stage,'payload',...dir.split('/')),{recursive:true,mode:0o700});
  const files=[];for(const f of original.files){const result=await copyChecked(f.source,join(stage,'payload',...f.path.split('/')));files.push({path:f.path,...result});}
  const sources=[],allowed=[];for(const p of documentRoots)allowed.push(await plainPath(p));
  for(const source of referencedSources(checked.docs)){if(prefixRelative(root,source)!==null)continue;
   const external=await plainPath(source);if(!allowed.some(r=>under(r,external)))throw fail('存在数据目录外的成果源文件，请显式指定 --documents-root','backup_external_root');
   if(!await exists(external)){checked.warnings.push({code:'external_source_missing'});continue;}
   const p='_restored_sources/'+sha(source).slice(0,32)+'/'+basename(external);safeRelative(p);if(files.some(f=>f.path===p))throw fail('外部成果恢复路径冲突','backup_path_collision');
   const result=await copyChecked(external,join(stage,'payload',...p.split('/')));files.push({path:p,...result});sources.push({original:source,path:p});
  }
  await fault('copied',{root,stage});const after=await walk(root);if(JSON.stringify(original.files.map(f=>[f.path,f.bytes,f.mtime,f.ino,f.dev]))!==JSON.stringify(after.files.map(f=>[f.path,f.bytes,f.mtime,f.ino,f.dev]))||JSON.stringify(original.directories)!==JSON.stringify(after.directories))throw fail('数据目录在备份期间发生变化','backup_changed');
  for(const f of files){const source=sources.find(s=>s.path===f.path)?.original||join(root,...f.path.split('/'));if(await fileHash(source)!==f.sha256)throw fail('数据内容在备份期间发生变化','backup_changed');}
  const tree=await walk(join(stage,'payload')),manifest={schema:SCHEMA,kind:'hyper-dimension-data-backup',id:randomUUID(),createdAt:new Date().toISOString(),source:{root,platform:process.platform},privateData:true,restorePolicy:'offline-full-directory; login-again; interrupted-manual-jobs-not-replayed; game-settlements-recovered-by-original-ids',files:files.sort((a,b)=>a.path.localeCompare(b.path)),directories:tree.directories,externalSources:sources,components:checked.components,warnings:checked.warnings};
  manifest.checksum=hash(manifest);await atomic(join(stage,'manifest.json'),manifest);await verifyDataBackup(stage);await fault('verified',{root,stage});if(await exists(out))throw fail('目标备份已出现，未覆盖','backup_exists');await rename(stage,out);
  return {backup:out,id:manifest.id,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),components:manifest.components,warnings:manifest.warnings};
 }finally{await lease.release();}
}
export async function verifyDataBackup(backup){
 const root=await plainPath(backup);await plainPath(join(root,'manifest.json'));let manifest;try{manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'))}catch{throw fail('备份清单无法读取','backup_manifest')}
 if(manifest.schema!==SCHEMA||manifest.kind!=='hyper-dimension-data-backup'||manifest.checksum!==hash({...manifest,checksum:undefined})||!Array.isArray(manifest.files)||!Array.isArray(manifest.directories)||!Array.isArray(manifest.externalSources)||typeof manifest.source?.root!=='string')throw fail('备份清单格式或校验失败','backup_manifest');
 if(manifest.files.length>MAX_FILES||manifest.files.reduce((n,f)=>n+f.bytes,0)>MAX_BYTES)throw fail('备份超过容量限制','backup_limit');
 const keys=new Set();for(const f of manifest.files){safeRelative(f.path);if(keys.has(f.path.toLowerCase())||!Number.isSafeInteger(f.bytes)||f.bytes<0||!/^[a-f0-9]{64}$/.test(f.sha256))throw fail('备份文件清单无效','backup_manifest');keys.add(f.path.toLowerCase());}
 for(const p of manifest.directories)safeRelative(p);for(const s of manifest.externalSources)if(typeof s.original!=='string'||!manifest.files.some(f=>f.path===s.path)||!s.path.startsWith('_restored_sources/'))throw fail('外部文件映射无效','backup_manifest');
 const inventory=await walk(join(root,'payload'));if(inventory.files.length!==manifest.files.length||JSON.stringify(inventory.directories.slice().sort())!==JSON.stringify(manifest.directories.slice().sort()))throw fail('备份包含遗漏或额外目录','backup_contents');
 for(const f of inventory.files){const expected=manifest.files.find(x=>x.path===f.path);if(!expected||f.bytes!==expected.bytes||await fileHash(f.source)!==expected.sha256)throw fail('备份内容校验失败，未恢复','backup_contents');}
 const checked=await inspectTree(join(root,'payload'),inventory);return {manifest,inventory,components:checked.components};
}
function rebasePath(value,manifest,target){const external=manifest.externalSources.find(s=>s.original===value);if(external)return join(target,...external.path.split('/'));
 const tail=prefixRelative(manifest.source.root,value);return tail===null?value:tail?join(target,...safeRelative(tail).split('/')):target;}
async function relocate(stage,target,manifest){
 const changes=[],inventory=await walk(stage);
 for(const f of inventory.files){
  if(/(?:^|\/)state\.db$/.test(f.path)){const count=relocateSqliteBackup(f.source,value=>rebasePath(value,manifest,target));if(count)changes.push({path:f.path,reason:'native-session-workspace',count});continue;}
  if(lockNames.has(basename(f.path))&&!f.path.includes('/documents/')){await unlink(f.source);changes.push({path:f.path,reason:'stale-write-lock'});continue;}
  if(importMetadata(f.path))continue; // Source files and signature keys remain byte exact on relocation.
  if(!metadataPath(f.path))continue;let d;try{d=JSON.parse(await readFile(f.source,'utf8'));envelopeCheck(d,f.path);}catch(e){if(requiredCurrent(f.path))throw e;continue;}
  let changed=false;
  function visit(v){if(!v||typeof v!=='object')return;for(const [k,value]of Object.entries(v)){if(typeof value==='string'&&['path','sourcePath','backupPath','snapshotPath'].includes(k)){const mapped=rebasePath(value,manifest,target);if(mapped!==value){v[k]=mapped;changed=true;}}else if(typeof value==='object')visit(value);}}
  // Path fields in formal runtime metadata are migrated. User file contents and chat prose stay exact.
  visit(d);if(f.path==='_lan/identity.json'||f.path==='_lan/identity.previous.json'){if(d.sessions.length){d.sessions=[];changed=true;}for(const r of Object.values(d.rooms))for(const m of Object.values(r.members||{})){m.online=false;m.lastSeen=0;changed=true;}}
  if(changed){if(d.checksum)d.checksum=hash(d.schema===43||d.schema===44?d.state:d.record??{...d,checksum:undefined});await atomic(f.source,d);changes.push({path:f.path,reason:'paths-or-session-reset'});}
 }
 return changes;
}
async function treeDigest(root){const tree=await walk(root),files=[];for(const f of tree.files)files.push([f.path,f.bytes,await fileHash(f.source)]);return hash({directories:tree.directories,files});}
function journalValid(j,root){
 const parent=dirname(root),name=basename(root),id=j?.id;return j?.schema===SCHEMA&&j.target===root&&/^[a-f0-9-]{36}$/.test(id||'')&&j.stage===join(parent,'.'+name+'.restore-'+id)&&j.previous===join(parent,name+'.before-restore-'+id)&&/^[a-f0-9]{64}$/.test(j.digest||'')&&['prepared','old_moved','installed'].includes(j.phase);
}
async function install(j,file,fault){
 const root=j.target,hasTarget=await exists(root),hasStage=await exists(j.stage),hasPrevious=await exists(j.previous);
 if(hasStage){if(await treeDigest(j.stage)!==j.digest)throw fail('待恢复目录已变化，原数据保留','restore_changed');
  if(hasTarget){if(hasPrevious||!j.existed||await treeDigest(root)!==j.originalDigest)throw fail('恢复现场与记录不一致，停止替换','restore_ambiguous');
   await rename(root,j.previous);await fault('old-moved',{journal:j});}
  else if(j.existed&&!hasPrevious)throw fail('恢复前的数据目录缺失','restore_ambiguous');
  j.phase='old_moved';await atomic(file,j);await rename(j.stage,root);await fault('new-installed',{journal:j});j.phase='installed';await atomic(file,j);
 }else if(!hasTarget||await treeDigest(root)!==j.digest||j.existed&&!hasPrevious)throw fail('恢复现场无法核对，停止替换','restore_ambiguous');
 if(await treeDigest(root)!==j.digest)throw fail('恢复后的目录校验失败','restore_changed');await inspectTree(root,await walk(root));
 const receipt={schema:SCHEMA,id:j.id,completedAt:new Date().toISOString(),target:root,previous:j.existed?j.previous:null,backupId:j.backupId,digest:j.digest,changes:j.changes};
 await atomic(file+'.'+j.id+'.receipt.json',receipt);await unlink(file);return receipt;
}
export async function restoreDataBackup({backup,directory,legacyCheck=true,fault=async()=>{}}){
 const root=await plainPath(directory),source=await plainPath(backup);if(under(root,source)||under(source,root))throw fail('恢复目标与备份不能重叠','backup_destination');
 if(legacyCheck)await assertNoLegacyRuntime();const lease=await acquireDataLease({directory:root,mode:'restore'}),file=restoreJournalPath(root);
 try{const {manifest,inventory}=await verifyDataBackup(source);if(await exists(root))await assertQuiet(root,await walk(root));
  const id=randomUUID(),stage=join(dirname(root),'.'+basename(root)+'.restore-'+id),previous=join(dirname(root),basename(root)+'.before-restore-'+id);
  await mkdir(stage,{mode:0o700});for(const dir of inventory.directories)await mkdir(join(stage,...dir.split('/')),{recursive:true,mode:0o700});
  for(const f of inventory.files){const copied=await copyChecked(f.source,join(stage,...f.path.split('/'))),expected=manifest.files.find(x=>x.path===f.path);if(copied.sha256!==expected.sha256)throw fail('备份在恢复时变化','backup_changed');}
  const changes=await relocate(stage,root,manifest);await inspectTree(stage,await walk(stage));const existed=await exists(root),j={schema:SCHEMA,id,target:root,stage,previous,existed,originalDigest:existed?await treeDigest(root):null,digest:await treeDigest(stage),backupId:manifest.id,changes,phase:'prepared'};
  await atomic(file,j);await fault('prepared',{journal:j});return await install(j,file,fault);
 }finally{await lease.release();}
}
export async function recoverDataRestore({directory,legacyCheck=true,fault=async()=>{}}){
 const root=await plainPath(directory);if(legacyCheck)await assertNoLegacyRuntime();const lease=await acquireDataLease({directory:root,mode:'recover',allowRestore:true});
 try{const file=restoreJournalPath(root);let j;try{j=JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return {recovered:false};throw fail('恢复记录无法读取','restore_journal')}
 if(!journalValid(j,root))throw fail('恢复记录路径或格式无效','restore_journal');await plainPath(j.stage);await plainPath(j.previous);
 return {recovered:true,...await install(j,file,fault)};
 }finally{await lease.release();}
}
