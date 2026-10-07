import {createHash} from 'node:crypto';
import {readFile,lstat,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative,sep,dirname} from 'node:path';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function packagePath(root,name){
 if(typeof name!=='string'||!name||name.includes('\\')||name.includes(':')||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Invalid release path');
 const path=resolve(root,...name.split('/'));if(!path.startsWith(resolve(root)+sep))throw Error('Release path escapes package');return path;
}
export async function filesIn(root,prefix=''){
 const out=[];for(const e of (await readdir(resolve(root,prefix),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const name=prefix?prefix+'/'+e.name:e.name,path=resolve(root,name),s=await lstat(path);
  if(s.isSymbolicLink())throw Error('Release input cannot contain a symlink or junction');
  if(s.isDirectory())out.push(...await filesIn(root,name));else if(s.isFile())out.push(name);else throw Error('Unsupported release entry');
 }return out;
}
export async function loadManifest(root){
 const bytes=await readFile(resolve(root,'release-manifest.json')),expected=(await readFile(resolve(root,'release-manifest.sha256'),'utf8')).trim();
 if(sha256(bytes)!==expected)throw Error('Release manifest checksum mismatch');
 const manifest=JSON.parse(bytes);if(manifest.schema!==80||!['windows-x64','agent-source'].includes(manifest.target)||!Array.isArray(manifest.files))throw Error('Unsupported release manifest');
 const seen=new Set();for(const f of manifest.files){packagePath(root,f.path);if(seen.has(f.path)||!Number.isSafeInteger(f.bytes)||f.bytes<0||!(/^[a-f0-9]{64}$/).test(f.sha256))throw Error('Invalid release file record');seen.add(f.path);}
 return manifest;
}
export async function assertPlain(root,path){for(let current=path;;current=dirname(current)){if((await lstat(current)).isSymbolicLink())throw Error('Release path uses a symlink or junction');if(current===resolve(root))return;if(current===dirname(current))throw Error('Release path is outside package');}}
export async function verifyPayload(root,{pristine=false}={}){
 const manifest=await loadManifest(root);
 for(const f of manifest.files){const path=packagePath(root,f.path);await assertPlain(root,path);const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size!==f.bytes||sha256(await readFile(path))!==f.sha256)throw Error('Release payload changed: '+f.path);}
 if(pristine){const allowed=new Set([...manifest.files.map(f=>f.path),'release-manifest.json','release-manifest.sha256']);for(const name of await filesIn(root))if(!allowed.has(name))throw Error('Unexpected file in clean release: '+name);}
 return {schema:80,release:manifest.release,target:manifest.target,files:manifest.files.length,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),verified:true,pristine};
}
export async function saveJson(path,value){await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(value,null,2)+'\n');}
