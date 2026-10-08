import {mkdir,lstat,readFile,open,unlink,rename,readdir,readlink} from 'node:fs/promises';
import {resolve,dirname,basename,join,parse,win32,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const fail=(message,code='data_busy')=>Object.assign(Error(message),{code,status:503});
export const restoreJournalPath=directory=>join(dirname(resolve(directory)),'.'+basename(resolve(directory))+'.hd-restore.json');
export const leasePath=directory=>join(dirname(resolve(directory)),'.'+basename(resolve(directory))+'.hd-data-lease.json');
export function alive(pid){if(!Number.isSafeInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true}catch(e){return e.code!=='ESRCH'}}
export async function exists(path){try{await lstat(path);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
export async function plainPath(path){const target=resolve(path),parts=[];let p=target;for(;;){parts.push(p);if(p===parse(p).root)break;p=dirname(p);}
 for(const part of parts.reverse())try{if((await lstat(part)).isSymbolicLink())throw fail('数据路径不能经过符号链接或目录联接','data_path_link');}catch(e){if(e.code!=='ENOENT')throw e;}return target;
}
async function leaseOwner(file){try{const text=await readFile(file,'utf8'),v=JSON.parse(text);if(v.schema!==1||!Number.isSafeInteger(v.pid)||v.pid<=0||!v.token)throw Error();return {text,value:v};}
 catch(e){if(e.code==='ENOENT')return null;throw fail('数据运行锁无法核对，保留现有文件','data_lease_corrupt')}}
async function removeDead(file){const owner=await leaseOwner(file);if(!owner)return false;if(alive(owner.value.pid))throw fail('数据目录正在使用，请先停止对应服务','data_busy');
 if(await readFile(file,'utf8')!==owner.text)throw fail('数据运行锁已变化，请稍后再试');await unlink(file);return true;}
async function relatedLeases(root,allowRestore=false){const files=[];let p=root;
 for(;;){if(!(allowRestore&&p===root)&&await exists(restoreJournalPath(p)))throw fail('祖先数据目录还有未完成恢复，请先运行 data:recover','data_restore_pending');const parent=dirname(p),prefix='.'+basename(p)+'.hd-runtime-';if(await exists(parent))for(const e of await readdir(parent))if(e===basename(leasePath(p))||e.startsWith(prefix)&&e.endsWith('.json'))files.push(join(parent,e));if(parent===parse(p).root)break;p=parent;}
 async function walk(dir){if(!await exists(dir))return;for(const e of await readdir(dir,{withFileTypes:true})){const file=join(dir,e.name);if(e.isSymbolicLink())throw fail('数据中存在符号链接或目录联接','data_path_link');
 if(e.isDirectory())await walk(file);else if(e.name.endsWith('.hd-data-lease.json')||/\.hd-runtime-[a-f0-9-]+\.json$/.test(e.name))files.push(file);else if(e.name.endsWith('.hd-restore.json'))throw fail('子目录还有未完成恢复，请先运行 data:recover','data_restore_pending');}}
 await walk(root);return [...new Set(files)];
}
const runtimeRegistry=project=>join(project,'.runtime','data-lease-registry');
async function registerRuntimeLease(root,file,token){
 const directory=await plainPath(runtimeRegistry(resolve(import.meta.dirname,'..')));await mkdir(directory,{recursive:true});const registryFile=join(directory,token+'.json'),temporary=registryFile+'.tmp',handle=await open(temporary,'wx',0o600);
 try{await handle.writeFile(JSON.stringify({schema:1,pid:process.pid,token,mode:'runtime',directory:root,leaseFile:file}));await handle.sync();}catch(e){await handle.close();await unlink(temporary).catch(()=>{});throw e;}await handle.close();try{await rename(temporary,registryFile);}catch(e){await unlink(temporary).catch(()=>{});throw e;}
 return registryFile;
}
export async function registeredRuntimePids(project){
 const directory=await plainPath(runtimeRegistry(resolve(project)));if(!await exists(directory))return new Set();const pids=new Set();
 for(const entry of await readdir(directory,{withFileTypes:true})){
  if(entry.isFile()&&/^[a-f0-9-]{36}\.json\.tmp$/.test(entry.name))continue;
  if(!entry.isFile()||!/^[a-f0-9-]{36}\.json$/.test(entry.name))throw fail('运行登记无法核对，请保留数据','data_process_unverified');
  const record=await leaseOwner(join(directory,entry.name));if(!record||!alive(record.value.pid))continue;const r=record.value;
  if(r.mode!=='runtime'||entry.name!==r.token+'.json'||typeof r.directory!=='string'||typeof r.leaseFile!=='string')throw fail('运行登记无法核对，请保留数据','data_process_unverified');
  const root=await plainPath(r.directory),file=await plainPath(r.leaseFile);
  if(dirname(file)!==dirname(root)||!basename(file).startsWith('.'+basename(root)+'.hd-runtime-')||basename(file)!=='.'+basename(root)+'.hd-runtime-'+r.token+'.json')throw fail('运行登记与数据路径不一致','data_process_unverified');
  const owner=await leaseOwner(file);if(!owner)continue;
  if(owner.value.pid!==r.pid||owner.value.token!==r.token||owner.value.mode!=='runtime'||resolve(owner.value.directory||'')!==root)throw fail('运行登记与数据锁不一致','data_process_unverified');
  pids.add(r.pid);
 }return pids;
}

export async function acquireDataLease({directory,mode='runtime',allowRestore=false,sharedRuntime=false}){
 const root=await plainPath(directory);if(root===parse(root).root)throw fail('不能把磁盘根目录作为游戏数据目录','data_path');
 await mkdir(dirname(root),{recursive:true});const token=randomUUID(),file=mode==='runtime'?join(dirname(root),'.'+basename(root)+'.hd-runtime-'+token+'.json'):leasePath(root);let handle;
 for(let attempt=0;attempt<3;attempt++)try{handle=await open(file,'wx',0o600);break}catch(e){if(e.code!=='EEXIST')throw e;await removeDead(file);}
 if(!handle)throw fail('暂时无法取得数据运行锁');let released=false,registryFile=null;
 const release=async()=>{if(released)return;released=true;if(registryFile){const registryOwner=await leaseOwner(registryFile);if(registryOwner?.value.token===token)await unlink(registryFile);}const owner=await leaseOwner(file);if(owner?.value.token===token)await unlink(file);};
 try{await handle.writeFile(JSON.stringify({schema:1,pid:process.pid,token,mode,sharedRuntime,directory:root,startedAt:new Date().toISOString()}));await handle.sync();await handle.close();handle=null;
  if(!allowRestore&&await exists(restoreJournalPath(root)))throw fail('上次恢复尚未完成，请先运行 data:recover','data_restore_pending');
  for(const related of await relatedLeases(root,allowRestore))if(related!==file&&await exists(related)){const owner=await leaseOwner(related);if(mode==='runtime'&&sharedRuntime&&owner?.value.mode==='runtime'&&owner.value.sharedRuntime&&alive(owner.value.pid))continue;await removeDead(related);}
  if(mode==='runtime')registryFile=await registerRuntimeLease(root,file,token);
  return {root,release};
 }catch(e){await handle?.close().catch(()=>{});await release().catch(()=>{});throw e;}
}
// Identify old Windows writers by their exact entry file. A nested QA checkout
// owns different data and must not be mistaken for this deployment.
export async function windowsLegacyProcesses(project,{execute=exec,loadSources=files=>Promise.all(files.map(p=>readFile(p))),request=fetch}={}){
  // Cold Windows hosts can spend more than 15 seconds starting CIM/TCP providers.
  // Inventory only Node processes; listener discovery is needed only for relative game entries.
  const script=`$ErrorActionPreference='Stop'; $candidates=@(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match '(?:lanServer|lanAgentWorker|server)\\.mjs' }); $rows=@($candidates | ForEach-Object { $entry=[regex]::Match($_.CommandLine,'"[^"\\r\\n]*(?:lanServer|lanAgentWorker|server)\\.mjs"|\\S*(?:lanServer|lanAgentWorker|server)\\.mjs').Value; [PSCustomObject]@{pid=$_.ProcessId;script=$entry;ports=@()} }); $relative=@($rows | Where-Object { ![IO.Path]::IsPathRooted($_.script.Trim('"')) }); if($relative.Count -gt 0){ $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop); foreach($row in $relative){$row.ports=@($listeners | Where-Object OwningProcess -eq $row.pid | ForEach-Object LocalPort)} }; ConvertTo-Json -InputObject $rows -Depth 4 -Compress`;
  let stdout;
  try{({stdout}=await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:60000,maxBuffer:65536}));}
  catch{throw fail('无法核对本机运行进程，现有环境与数据已保留，请稍后重试','data_process_unverified');}
  const value=JSON.parse(stdout.trim()||'[]'),items=Array.isArray(value)?value:[value];
  const rows=[],expectedScripts=new Set(['server.mjs','server/lanServer.mjs','server/lanAgentWorker.mjs'].map(p=>win32.resolve(project,p).toLowerCase()));let expected;
  for(const item of items){if(item.pid===process.pid)continue;const file=String(item.script||'').replace(/^"|"$/g,'');
   if(win32.isAbsolute(file)){if(expectedScripts.has(win32.resolve(file).toLowerCase()))rows.push(item.pid);continue;}
   if(/lanAgentWorker\.mjs$/i.test(file)){rows.push(item.pid);continue;}
   // Relative old launch commands cannot identify cwd. Match only actual local game files.
   for(const port of (Array.isArray(item.ports)?item.ports:[]).filter(n=>Number.isInteger(n)&&n>0&&n<=65535).slice(0,32)){expected??=await loadSources(['src/saveClient.js','src/world.js'].map(p=>join(project,p)));let match=true;for(const [i,p]of ['src/saveClient.js','src/world.js'].entries())try{const response=await request('http://127.0.0.1:'+port+'/'+p,{signal:AbortSignal.timeout(1200)});if(!response.ok||!Buffer.from(await response.arrayBuffer()).equals(expected[i])){match=false;break;}}catch{match=false;break;}if(match){rows.push(item.pid);break;}}
  }

  return [...new Set(rows)];
}

// macOS has no /proc. Inspect candidate Node processes and their actual cwd via stock ps/lsof.
export async function darwinLegacyProcesses(project,{execute=exec}={}){
 const {stdout}=await execute('/bin/ps',['-axo','pid=,command='],{timeout:15000,maxBuffer:1024*1024});
 const found=[];
 for(const line of stdout.split(/\r?\n/)){
  const match=line.match(/^\s*(\d+)\s+(.+)$/);if(!match)continue;
  const pid=Number(match[1]),args=match[2];
  if(!Number.isSafeInteger(pid)||pid<=0||pid===process.pid||!/(?:^|[\\/\s])(?:lanServer|lanAgentWorker|server)\.mjs(?:\s|$)/.test(args))continue;
  let command,cwd;
  try{
   command=(await execute('/bin/ps',['-p',String(pid),'-o','comm='],{timeout:5000,maxBuffer:16384})).stdout.trim();
   if(!/^node(?:js)?$/.test(basename(command)))continue;
   const listing=(await execute('/usr/sbin/lsof',['-a','-p',String(pid),'-d','cwd','-Fn'],{timeout:5000,maxBuffer:65536})).stdout;
   cwd=listing.split(/\r?\n/).find(s=>s.startsWith('n'))?.slice(1);
   if(!cwd)throw Error('Cannot identify process working directory');
  }catch(e){
   // ps/lsof exit 1 when the process disappears; any live uninspectable candidate blocks maintenance.
   if(e.code===1&&!alive(pid))continue;
   throw fail('无法核对macOS旧运行端，请保留数据并先停止对应进程','data_process_unverified');
  }
  const expected=['server.mjs','server/lanServer.mjs','server/lanAgentWorker.mjs'].map(p=>join(project,p));
  const absolute=expected.some(file=>args.includes(file+' ')||args.endsWith(file)||args.includes('"'+file+'"'));
  if(absolute||resolve(cwd)===resolve(project)&&/(?:^|\s)(?:\.\/)?(?:server\/)?(?:lanServer|lanAgentWorker|server)\.mjs(?:\s|$)/.test(args))found.push(pid);
 }
 return found;
}

// Old deployments predate the directory lease. Refuse their live writers too.
export async function assertNoLegacyRuntime(){
 const project=resolve(import.meta.dirname,'..');let rows=[];
 if(process.platform==='win32')rows=await windowsLegacyProcesses(project);
 else if(process.platform==='linux'){
  for(const entry of await readdir('/proc'))if(/^\d+$/.test(entry))try{const pid=Number(entry),cmd=(await readFile('/proc/'+entry+'/cmdline','utf8')).split('\0'),cwd=await readlink('/proc/'+entry+'/cwd'),program=cmd[1];if(program&&/^(?:lanServer|lanAgentWorker|server)\.mjs$/.test(basename(program))&&/node(?:js)?$/.test(cmd[0])&&['server.mjs','server/lanServer.mjs','server/lanAgentWorker.mjs'].some(p=>resolve(cwd,program)===resolve(project,p)))rows.push(pid);}catch(e){if(!['ENOENT','ESRCH','EACCES'].includes(e.code))throw e;}
 }else if(process.platform==='darwin')rows=await darwinLegacyProcesses(project);
 else throw fail('此平台尚未提供旧运行端停机检查','data_platform');
 const protectedPids=await registeredRuntimePids(project);
 if(rows.some(pid=>pid!==process.pid&&alive(pid)&&!protectedPids.has(pid)))throw fail('检测到尚未退出的本项目游戏或 Agent 运行端，请先停止服务','data_busy');
}
