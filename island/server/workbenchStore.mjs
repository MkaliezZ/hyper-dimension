import {mkdir,readFile,rename,unlink,stat,readdir,open} from 'node:fs/promises';import {resolve,join,extname,basename,isAbsolute} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
const clone=v=>JSON.parse(JSON.stringify(v)),hash=v=>createHash('sha256').update(v).digest('hex'),safeId=/^capture-[a-f0-9]{32}$/;
const formats=new Set(['txt','md','csv','json','docx','xlsx','pdf']),fail=(message,code='workbench_unavailable',status=503)=>Object.assign(Error(message),{code,status});
export function createWorkbenchStore({directory,ledger,preview,now=Date.now}){
 const root=resolve(directory),current=join(root,'current.json'),previous=join(root,'previous.json'),lock=join(root,'write.lock'),captures=join(root,'captures');
 const initial=()=>({projects:[],active:{pixel:null,origami:null},documents:{},versions:[],captures:[],receipts:[]});
 const fileKey=path=>'document-'+hash(process.platform==='win32'?resolve(path).toLowerCase():resolve(path)).slice(0,32);
 async function atomic(path,value){const temp=path+'.'+randomUUID()+'.tmp';let f;try{f=await open(temp,'wx',0o600);await f.writeFile(value);await f.sync();await f.close();f=null;await rename(temp,path)}finally{await f?.close().catch(()=>{});await unlink(temp).catch(()=>{})}}
 async function locked(fn){
  await mkdir(root,{recursive:true});const token=randomUUID(),start=Date.now();
  while(true){try{const f=await open(lock,'wx',0o600);await f.writeFile(JSON.stringify({pid:process.pid,token}));await f.close();break}catch(e){if(e.code!=='EEXIST')throw e;
   try{const old=JSON.parse(await readFile(lock,'utf8'));let alive=true;try{process.kill(old.pid,0)}catch(x){alive=x.code==='EPERM'}if(!alive){await unlink(lock);continue}}catch{try{if(Date.now()-(await stat(lock)).mtimeMs>30000){await unlink(lock);continue}}catch{}}
   if(Date.now()-start>6000)throw fail('成果手账正在保存，请稍后重试');await new Promise(r=>setTimeout(r,30));
  }}
  try{return await fn()}finally{try{if(JSON.parse(await readFile(lock,'utf8')).token===token)await unlink(lock)}catch{}}
 }
 async function load(){try{const text=await readFile(current,'utf8'),d=JSON.parse(text);if(d.schema!==44||d.checksum!==hash(JSON.stringify(d.state))||!Array.isArray(d.state?.versions)||!Array.isArray(d.state.projects))throw Error();return {...d,text}}
 catch(e){if(e.code==='ENOENT')return {state:initial(),revision:0,text:null};throw fail('成果手账校验失败，原文件和版本快照已保留','workbench_corrupt')}}
 async function save(old){if(old.text)await atomic(previous,old.text);await atomic(current,JSON.stringify({schema:44,revision:old.revision+1,state:old.state,checksum:hash(JSON.stringify(old.state))}))}
 function view(s,theme,warnings=[]){
  const latest=new Map();for(const v of s.versions)latest.set(v.documentId,v);
  const related=new Map();for(const v of s.versions.filter(v=>(v.projectIds||[v.projectId]).includes(s.active[theme])))related.set(v.documentId,v);
  return {schema:44,activeId:s.active[theme],projects:clone(s.projects),artifacts:clone([...latest.values()].sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt))),projectArtifacts:clone([...related.values()].reverse()),totalVersions:s.versions.length,snapshotBytes:s.versions.reduce((n,v)=>n+v.bytes,0),warnings};
 }
 async function verifiedCapture(id,runs){
  if(!safeId.test(id))throw fail('成果编号无效','artifact_invalid',400);
  const m=JSON.parse(await readFile(join(captures,id+'.json'),'utf8'));
  if(m.schema!==44||m.id!==id||m.mode!=='manual'||!['document_write','document_edit'].includes(m.tool)||!formats.has(m.format)||!isAbsolute(m.sourcePath||'')||extname(m.sourcePath).toLowerCase()!=='.'+m.format||basename(m.sourcePath)!==m.name||!Number.isSafeInteger(m.bytes)||m.bytes<0||m.bytes>25*1024*1024||!/^[a-f0-9]{64}$/.test(m.sha256)||!Number.isFinite(Date.parse(m.capturedAt)))throw fail('成果回执无效','artifact_invalid');
  const r=runs.find(r=>r.id===m.ledgerRunId);
  if(!r||r.automatic||r.kind!=='steward_manual'||!r.providerStarted||r.theme!==m.theme||r.providerRunId&&r.providerRunId!==m.providerRunId)throw fail('成果缺少本次手动运行关联','artifact_run_unconfirmed');
  const bytes=await readFile(join(captures,id+'.'+m.format));if(bytes.length!==m.bytes||hash(bytes)!==m.sha256)throw fail('成果快照校验失败，未作为已确认版本展示','artifact_corrupt');
  return m;
 }
 async function recover(){
  await mkdir(captures,{recursive:true});const runs=(await ledger.snapshot()).runs,ids=(await readdir(captures)).filter(n=>/^capture-[a-f0-9]{32}\.json$/.test(n)).map(n=>n.slice(0,-5));
  return locked(async()=>{const old=await load(),s=old.state,warnings=[],found=[];let changed=false;
   for(const id of ids){if(s.captures.some(c=>c.id===id))continue;try{found.push(await verifiedCapture(id,runs))}catch(e){warnings.push({id,code:e.code||'artifact_unavailable'})}}
   found.sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)||a.id.localeCompare(b.id));
   for(const m of found){
    if(s.versions.length>=4000){warnings.push({id:m.id,code:'artifact_capacity'});continue}
    const documentId=Object.values(s.documents).find(d=>fileKey(d.path)===fileKey(m.sourcePath))?.id||fileKey(m.sourcePath),doc=s.documents[documentId]??={id:documentId,path:m.sourcePath,version:0,latest:null},last=s.versions.find(v=>v.id===doc.latest);
    if(last?.sha256===m.sha256){last.projectIds??=[last.projectId].filter(Boolean);if(s.projects.some(p=>p.id===m.projectId)&&!last.projectIds.includes(m.projectId))last.projectIds.push(m.projectId);s.captures.push({id:m.id,artifactId:last.id,runId:m.ledgerRunId});changed=true;continue}
    doc.version++;doc.latest=m.id;const version={id:m.id,documentId,version:doc.version,name:m.name,path:m.sourcePath,format:m.format,bytes:m.bytes,sha256:m.sha256,capturedAt:m.capturedAt,tool:m.tool,changes:m.changes,theme:m.theme,projectId:s.projects.some(p=>p.id===m.projectId)?m.projectId:null,projectIds:s.projects.some(p=>p.id===m.projectId)?[m.projectId]:[],runId:m.ledgerRunId,providerRunId:m.providerRunId,recovered:!['completed','late_completed'].includes(runs.find(r=>r.id===m.ledgerRunId)?.phase)};
    s.versions.push(version);s.captures.push({id:m.id,artifactId:m.id});changed=true;
   }
   if(changed)await save(old);return {state:s,warnings};
  });
 }
 return {
  directory:root,
  async list(theme){const {state,warnings}=await recover();return view(state,theme,warnings)},
  async syncOperations(operations,metadata){
   const ids=(Array.isArray(operations)?operations:[]).filter(op=>op.status==='done'&&['document_write','document_edit'].includes(op.tool)&&safeId.test(op.artifact?.id||'')).map(op=>op.artifact.id);
   const {state,warnings}=await recover();const artifacts=[];
   for(const id of ids){const linked=state.captures.find(c=>c.id===id),v=linked&&state.versions.find(v=>v.id===linked.artifactId);if(v&&(v.runId===metadata.runId||linked.runId===metadata.runId))artifacts.push(clone(v))}
   return {artifacts:[...new Map(artifacts.map(v=>[v.id,v])).values()],warning:warnings.some(w=>ids.includes(w.id))?'文档已保存，但成果版本尚未登记；重新打开成果手账会核验。':null};
  },
  async context(theme){
   return locked(async()=>{const s=(await load()).state,p=s.projects.find(p=>p.id===s.active[theme]&&p.status==='active');if(!p)return null;
    const latest=new Map();for(const v of s.versions.filter(v=>(v.projectIds||[v.projectId]).includes(p.id)))latest.set(v.documentId,v);
    return {id:p.id,name:p.name,goal:p.goal,notes:p.notes,version:p.version,status:p.status,files:[...latest.values()].slice(-6).map(v=>({artifactId:v.id,name:v.name,path:v.path,version:v.version,sha256:v.sha256}))};
   });
  },
  async project(theme,input){
   if(!['pixel','origami'].includes(theme)||typeof input?.requestId!=='string'||!/^[\w-]{1,120}$/.test(input.requestId))throw fail('项目请求无效','project_invalid',400);
   const signature=hash(JSON.stringify([theme,input]));
   return locked(async()=>{const old=await load(),s=old.state,prior=s.receipts.find(r=>r.id===input.requestId);
    if(prior){if(prior.signature!==signature)throw fail('同一项目请求内容不同','project_conflict',409);return view(s,theme)}
    let p=s.projects.find(p=>p.id===input.id);const action=input.action;
    if(!['create','update','select','archive','reopen'].includes(action))throw fail('项目操作无效','project_invalid',400);
    if(action!=='create'&&!p)throw fail('工作项目不存在','project_missing',404);
    if(action!=='create'&&p.version!==input.expectedVersion)throw fail('项目已在另一窗口修改，请刷新后再保存','project_conflict',409);
    if(['create','update'].includes(action)){
     const value={name:String(input.name||'').trim(),goal:String(input.goal||'').trim(),notes:String(input.notes||'').trim()};
     if(!value.name||value.name.length>60||value.goal.length>1000||value.notes.length>4000)throw fail('名称1–60字、目标最多1000字、纪要最多4000字','project_invalid',400);
     if(action==='create'){if(s.projects.length>=200)throw fail('项目数量已达200，请使用已有项目','project_capacity',409);p={id:'project-'+randomUUID(),...value,version:1,status:'active',createdAt:new Date(now()).toISOString(),updatedAt:new Date(now()).toISOString(),history:[]};s.projects.push(p);s.active[theme]=p.id}
     else if(Object.keys(value).some(k=>value[k]!==p[k])){p.history.push({version:p.version,name:p.name,goal:p.goal,notes:p.notes,at:p.updatedAt});p.history=p.history.slice(-32);Object.assign(p,value,{version:p.version+1,updatedAt:new Date(now()).toISOString()})}
    }
    if(action==='select'){if(p.status!=='active')throw fail('归档项目需先重新启用','project_archived',409);s.active[theme]=p.id}
    if(action==='archive'||action==='reopen'){p.status=action==='archive'?'archived':'active';p.version++;p.updatedAt=new Date(now()).toISOString();if(action==='archive')for(const key of Object.keys(s.active))if(s.active[key]===p.id)s.active[key]=null}
    s.receipts.push({id:input.requestId,signature});s.receipts=s.receipts.slice(-64);await save(old);return view(s,theme);
   });
  },
  async detail(id){
   const {state}=await recover(),v=state.versions.find(v=>v.id===id);if(!v)throw fail('成果版本不存在','artifact_missing',404);
   const path=join(captures,v.id+'.'+v.format),bytes=await readFile(path);if(bytes.length!==v.bytes||hash(bytes)!==v.sha256)throw fail('版本快照校验失败，现有文件保留','artifact_corrupt');
   return {...clone(v),versions:clone(state.versions.filter(x=>x.documentId===v.documentId).reverse()),snapshotPath:path};
  },
  async download(id){const d=await this.detail(id),bytes=await readFile(d.snapshotPath);if(hash(bytes)!==d.sha256)throw fail('版本快照已变化，下载已停止','artifact_corrupt');return {metadata:d,bytes}},
  async preview(id,offset=1){const d=await this.detail(id);return {metadata:d,preview:await preview(d.snapshotPath,offset,d.sha256)}}
 };
}
