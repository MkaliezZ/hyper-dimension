import {readFileSync,existsSync} from 'node:fs';
import {resolve,isAbsolute,join} from 'node:path';
export const RUNTIME_FIELDS=Object.freeze(['DEEPSEEK_API_KEY','HD_HERMES_INSTALL','HD_HERMES_PYTHON','HD_MODEL_PYTHON','HD_DOCUMENT_PYTHON','HD_MODEL_ENDPOINT','HD_DOCUMENT_ROOT','HD_SAVE_DIR','HD_RUN_LEDGER_DIR','HD_ARTIFACT_DIR','HD_HERMES_HOME','HD_STEWARD_WORKDIR']);
export function parseRuntimeEnvironment(text){
 const result={};for(const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)){const match=line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(!match||!RUNTIME_FIELDS.includes(match[1]))continue;
  const name=match[1];if(Object.hasOwn(result,name))throw Object.assign(Error('本机配置出现重复字段，请保留一项'),{code:'runtime_config_duplicate'});
  let value=match[2];if(value.startsWith('"')||value.startsWith("'")){const quote=value[0],end=value.lastIndexOf(quote);if(end===0||!/^\s*(?:#.*)?$/.test(value.slice(end+1)))throw Object.assign(Error('本机配置引号未正确闭合'),{code:'runtime_config_quotes'});value=value.slice(1,end);}
  else value=value.replace(/\s+#.*$/,'').trim();if(/[\x00-\x1f]/.test(value))throw Object.assign(Error('本机配置不能包含控制字符'),{code:'runtime_config_invalid'});result[name]=value;
 }return result;
}
export function resolveRuntimePaths({root,environment={},platform=process.platform,exists=existsSync}){
 const localInstall=resolve(root,'.runtime/hermes-agent'),localPython=resolve(root,'.runtime/python',platform==='win32'?'Scripts/python.exe':'bin/python');
 const install=environment.HD_HERMES_INSTALL?resolve(root,environment.HD_HERMES_INSTALL):exists(join(localInstall,'run_agent.py'))||platform!=='win32'?localInstall:resolve(environment.LOCALAPPDATA||'', 'hermes/hermes-agent');
 const hermesPython=environment.HD_HERMES_PYTHON|| (exists(localPython)?localPython:resolve(install,platform==='win32'?'venv/Scripts/python.exe':'venv/bin/python'));
 const oldDocument=platform==='win32'&&environment.USERPROFILE?resolve(environment.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'):null;
 const documentPython=environment.HD_DOCUMENT_PYTHON||(exists(localPython)?localPython:oldDocument&&exists(oldDocument)?oldDocument:hermesPython);
 const modelPython=environment.HD_MODEL_PYTHON||(exists(localPython)?localPython:platform==='win32'?'python':'python3');
 const executable=value=>isAbsolute(value)||/[\\/]/.test(value)?resolve(root,value):value;
 return {install,hermesPython:executable(hermesPython),documentPython:executable(documentPython),modelPython:executable(modelPython)};
}
export function loadRuntimeEnvironment({root=resolve(import.meta.dirname,'..'),environment=process.env,read=readFileSync,exists=existsSync,platform=process.platform}={}){
 let file={};try{file=parseRuntimeEnvironment(read(resolve(root,'.env.local'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const merged={...file,...environment};for(const name of RUNTIME_FIELDS)if(!environment[name]&&file[name]){environment[name]=file[name];merged[name]=file[name];}
 for(const name of ['HD_SAVE_DIR','HD_RUN_LEDGER_DIR','HD_ARTIFACT_DIR','HD_HERMES_HOME','HD_STEWARD_WORKDIR','HD_DOCUMENT_ROOT'])if(merged[name])environment[name]=resolve(root,merged[name]);
 const paths=resolveRuntimePaths({root,environment:{...merged,...environment},platform,exists});
 for(const [field,key] of [['HD_HERMES_INSTALL','install'],['HD_HERMES_PYTHON','hermesPython'],['HD_MODEL_PYTHON','modelPython'],['HD_DOCUMENT_PYTHON','documentPython']])environment[field]=paths[key];
 return {paths,configuredKey:!!environment.DEEPSEEK_API_KEY,loadedFields:Object.keys(file)};
}
// Startup-only configuration. Values are never returned by status endpoints.
export const runtimeConfig=loadRuntimeEnvironment();
