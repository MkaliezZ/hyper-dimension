import {mkdir,readFile,writeFile,open,unlink,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {atomicJSON} from './atomicJson.mjs';
export const PORTFOLIO_FILE_LIMIT=8*1024*1024,PORTFOLIO_QUOTA=64*1024*1024;
const fail=(message,code='portfolio_invalid',status=400)=>Object.assign(Error(message),{code,status});
const empty=()=>({schema:1,revision:0,draft:{name:'',headline:'',bio:'',experiences:[],projects:[]},published:null,assets:[],messages:[],requests:[]});
const idOK=id=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id||'');
function text(v,max,required=false){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw fail('文字格式或长度不符合要求');const s=v.trim();if(required&&!s)throw fail('请填写必要内容');return s;}
function strict(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw fail('资料字段无效');}
function cleanDraft(v,assets){
 strict(v,['name','headline','bio','experiences','projects']);if(!Array.isArray(v.experiences)||v.experiences.length>30||!Array.isArray(v.projects)||v.projects.length>24)throw fail('最多展示 30 条经历和 24 个项目');const used=new Set();
 const key=k=>{if(!idOK(k)||used.has(k))throw fail('展项编号无效或重复');used.add(k);return k;};
 const experiences=v.experiences.map(e=>{strict(e,['id','period','title','description']);return{id:key(e.id),period:text(e.period,60),title:text(e.title,100,true),description:text(e.description,2000)};});
 const projects=v.projects.map(p=>{strict(p,['id','title','summary','url','files']);let url=text(p.url,1000);if(url){let parsed;try{parsed=new URL(url)}catch{throw fail('项目链接应为完整网址');}if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw fail('项目链接只支持 HTTP/HTTPS 网址');url=parsed.href;}if(!Array.isArray(p.files)||p.files.length>8||new Set(p.files).size!==p.files.length||p.files.some(id=>!assets.some(a=>a.id===id)))throw fail('项目附件无效，每个项目最多 8 个文件');return{id:key(p.id),title:text(p.title,100,true),summary:text(p.summary,3000),url,files:[...p.files]};});
 return{name:text(v.name,40),headline:text(v.headline,120),bio:text(v.bio,6000),experiences,projects};
}
function fileBytes(i){
 strict(i,['name','type','base64']);const name=text(i.name,120,true).replace(/[\\/<>:"|?*]/g,'_'),type=i.type,types={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','application/pdf':'.pdf','text/plain':'.txt'};if(!types[type])throw fail('支持 PNG、JPEG、WebP、PDF 和 UTF-8 文本');if(typeof i.base64!=='string'||i.base64.length>Math.ceil(PORTFOLIO_FILE_LIMIT/3)*4||i.base64.length%4!==0||/[^A-Za-z0-9+/=]/.test(i.base64))throw fail('附件过大或编码无效','portfolio_file_size',413);const bytes=Buffer.from(i.base64,'base64');if(bytes.toString('base64')!==i.base64)throw fail('附件编码无效');if(!bytes.length||bytes.length>PORTFOLIO_FILE_LIMIT)throw fail('每个附件最大 8 MiB','portfolio_file_size',413);
 const valid=type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':type==='application/pdf'?bytes.toString('ascii',0,5)==='%PDF-':(()=>{try{return!new TextDecoder('utf-8',{fatal:true}).decode(bytes).includes('\u0000');}catch{return false}})();if(!valid)throw fail('文件内容与所选类型不符');return{name,type,bytes,extension:types[type]};
}
export function createPortfolioStore({directory,now=()=>Date.now()}={}){
 const root=resolve(directory,'portfolio'),file=join(root,'portfolio.json'),files=join(root,'files'),lock=join(root,'write.lock');
 async function read(){try{const d=JSON.parse(await readFile(file,'utf8'));if(d.schema!==1||!Number.isInteger(d.revision)||!Array.isArray(d.assets)||!Array.isArray(d.messages))throw fail('会客馆资料需要恢复','portfolio_corrupt',503);return d;}catch(e){if(e.code==='ENOENT')return empty();throw e;}}
 async function locked(fn){await mkdir(files,{recursive:true,mode:0o700});const token=randomUUID(),start=Date.now();let acquired=false;
 while(!acquired){let h;try{h=await open(lock,'wx',0o600);await h.writeFile(JSON.stringify({pid:process.pid,token}));acquired=true;}catch(e){if(e.code!=='EEXIST')throw e;try{const owner=JSON.parse(await readFile(lock,'utf8'));try{process.kill(owner.pid,0)}catch(e){if(e.code!=='EPERM'){await unlink(lock);continue}}}catch(e){if(e.code==='ENOENT')continue;if(Date.now()-(await stat(lock)).mtimeMs>30000){await unlink(lock);continue}}if(Date.now()-start>5000)throw fail('会客馆正在保存，请稍后再试','portfolio_busy',503);await new Promise(r=>setTimeout(r,35));}finally{await h?.close();}}
 try{return await fn(await read());}finally{try{if(JSON.parse(await readFile(lock,'utf8')).token===token)await unlink(lock)}catch{}}
 }
 function projection(d,owner){const refs=new Set(d.published?.projects.flatMap(p=>p.files)||[]);return{revision:d.revision,canEdit:owner,draft:owner?structuredClone(d.draft):null,published:structuredClone(d.published),assets:structuredClone(d.assets.filter(a=>owner||refs.has(a.id)).map(({path,...a})=>a)),messages:structuredClone(d.messages.filter(m=>owner||!m.hidden)),quota:{used:owner?d.assets.reduce((s,a)=>s+a.size,0):null,max:PORTFOLIO_QUOTA,fileMax:PORTFOLIO_FILE_LIMIT}};}
 async function commit(d){d.revision++;await atomicJSON(file,d);}
 return{directory:root,async view({owner=false}={}){return projection(await read(),owner)},
 async action(i,{owner=false,authorId='local-owner',authorName='本岛岛主'}={}){
 strict(i,['operation','requestId','revision','draft','message','messageId','reply','hidden']);if(!idOK(i.requestId))throw fail('请求编号无效');return locked(async d=>{
 const fingerprint=createHash('sha256').update(JSON.stringify(i)).digest('hex'),prior=d.requests.find(r=>r.id===i.requestId&&r.authorId===authorId);if(prior){if(prior.fingerprint!==fingerprint)throw fail('同一请求不能更改内容','portfolio_request_conflict',409);return{...projection(d,owner),replayed:true};}
 const op=i.operation;if(['save','publish','unpublish','moderate'].includes(op)&&!owner)throw fail('只有岛主可以修改展馆','portfolio_owner',403);if(['save','publish','unpublish','moderate'].includes(op)&&i.revision!==d.revision)throw fail('资料已有新版本，请重新读取再编辑','portfolio_conflict',409);
 if(op==='save')d.draft=cleanDraft(i.draft,d.assets);
 else if(op==='publish'){const draft=cleanDraft(d.draft,d.assets);if(!draft.name&&!draft.bio&&!draft.projects.length&&!draft.experiences.length)throw fail('请先保存要展示的资料');d.published={...structuredClone(draft),publishedAt:now()};}
 else if(op==='unpublish')d.published=null;
 else if(op==='message'){if(d.messages.length>=300)throw fail('留言板已满，请联系岛主整理');if(d.messages.filter(m=>m.authorId===authorId&&now()-m.at<60000).length>=3)throw fail('海风传信稍慢，请一分钟后再留言','portfolio_rate',429);d.messages.push({id:randomUUID(),authorId,name:text(authorName,40,true),at:now(),text:text(i.message,1000,true),reply:'',repliedAt:null,hidden:false});}
 else if(op==='moderate'){const m=d.messages.find(m=>m.id===i.messageId);if(!m)throw fail('留言不存在','portfolio_message_missing',404);if(typeof i.hidden!=='boolean')throw fail('留言状态无效');m.hidden=i.hidden;m.reply=text(i.reply,1000);m.repliedAt=m.reply?now():null;}
 else throw fail('不支持此展馆操作');d.requests.push({id:i.requestId,authorId,fingerprint});d.requests=d.requests.slice(-200);await commit(d);return projection(d,owner);
 });},
 async upload(i,{owner=false}={}){if(!owner)throw fail('只有岛主可以上传文件','portfolio_owner',403);const f=fileBytes(i);return locked(async d=>{if(d.assets.length>=100||d.assets.reduce((s,a)=>s+a.size,0)+f.bytes.length>PORTFOLIO_QUOTA)throw fail('展馆附件总容量上限 64 MiB / 100 件','portfolio_quota',413);const id=randomUUID(),path=id+f.extension;await writeFile(join(files,path),f.bytes,{flag:'wx',mode:0o600});const asset={id,path,name:f.name,type:f.type,size:f.bytes.length,sha256:createHash('sha256').update(f.bytes).digest('hex'),at:now()};d.assets.push(asset);try{await commit(d)}catch(e){await unlink(join(files,path)).catch(()=>{});throw e;}return{...projection(d,true),uploadedId:id};});},
 async asset(id,{owner=false}={}){if(!idOK(id))throw fail('附件编号无效');const d=await read(),a=d.assets.find(a=>a.id===id);if(!a||!owner&&!d.published?.projects.some(p=>p.files.includes(id)))throw fail('附件尚未公开或不存在','portfolio_file_missing',404);if(!/^[a-f0-9-]+\.(png|jpg|webp|pdf|txt)$/.test(a.path))throw fail('附件路径无效');const bytes=await readFile(join(files,a.path));if(createHash('sha256').update(bytes).digest('hex')!==a.sha256)throw fail('附件损坏，请恢复备份','portfolio_file_corrupt',503);return{...a,bytes};}
 };
}

