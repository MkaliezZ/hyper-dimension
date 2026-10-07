import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir,open,lstat} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {verifyPayload} from './releaseCommon.mjs';
import {acquireDataLease,assertNoLegacyRuntime} from '../server/dataLease.mjs';
const exec=promisify(execFile);
export function nodeSupported(version){const [major,minor]=version.split('.').map(Number);return major===22&&minor>=13||major===23&&minor>=4||major>=24;}
export function deploymentPlan({root,platform=process.platform,arch=process.arch,mode='lan',port,host='127.0.0.1',offline=false}){
 if(!['win32','darwin','linux'].includes(platform)||!['x64','arm64'].includes(arch)||platform==='win32'&&arch!=='x64')throw Error('Unsupported target platform/architecture');
 if(!['pixel','origami','lan'].includes(mode))throw Error('Mode must be pixel, origami or lan');
 port=port===undefined?({pixel:4173,origami:4174,lan:4175}[mode]):Number(port);
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('Port must be 1-65535');
 if(!['127.0.0.1','0.0.0.0'].includes(host)||mode!=='lan'&&host!=='127.0.0.1')throw Error('Only LAN mode can explicitly use all-interface listening');
 const python=join(root,'.runtime/python',platform==='win32'?'Scripts/python.exe':'bin/python');
 const args=mode==='lan'?[join(root,'server/lanServer.mjs'),'--port='+port,'--host='+host]:[join(root,'server.mjs'),'--port='+port,'--theme='+mode];
 return{schema:1,artifact:'agent-source',platform,arch,mode,port,host,offline,root,python,hermes:join(root,'.runtime/hermes-agent'),executable:process.execPath,args,url:'http://127.0.0.1:'+port+(mode==='lan'?'/play':'/'),state:'preserve existing data',secret:'DEEPSEEK_API_KEY environment or private .env.local',shell:false};
}
export function parseArguments(argv){const command=argv[0]||'plan',options={};if(!['plan','doctor','setup','verify','run'].includes(command))throw Error('Use plan, doctor, setup, verify or run');
 for(const a of argv.slice(1)){if(a==='--offline')options.offline=true;else if(/^--(?:python|mode|port|host)=.+$/.test(a)){const i=a.indexOf('=');options[a.slice(2,i)]=a.slice(i+1);}else throw Error('Unsupported argument');}
 return{command,options};
}
async function inspectPython(executable){try{const {stdout}=await exec(executable,['-c','import sys,json;print(json.dumps({"version":sys.version.split()[0],"executable":sys.executable,"major":sys.version_info.major,"minor":sys.version_info.minor}))'],{windowsHide:true,timeout:15000,maxBuffer:4096});const p=JSON.parse(stdout);return{...p,supported:p.major===3&&p.minor>=11&&p.minor<14};}catch{return{supported:false,error:'Python not available; supply --python=<executable> for Python 3.11-3.13'};}}
function run(executable,args,{root,env={},inherit=true}={}){return new Promise((accept,reject)=>{const child=spawn(executable,args,{cwd:root,windowsHide:true,shell:false,stdio:inherit?'inherit':'pipe',env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1',...env}});child.on('error',reject);child.on('exit',(code,signal)=>code===0?accept():reject(Error('Command failed ('+(signal||code)+'): '+args[0])));});}
export async function deploymentDoctor({root,python=process.platform==='win32'?'python':'python3',options={}}){
 const plan=deploymentPlan({root,...options}),interpreter=await inspectPython(python),checks=[{name:'Node',passed:nodeSupported(process.versions.node),version:process.versions.node},{name:'Python',passed:interpreter.supported,...interpreter}];
 for(const f of ['server.mjs','server/lanServer.mjs','package-lock.json','vendor/hermes-agent.zip','vendor/requirements-agent.lock'])checks.push({name:f,passed:existsSync(join(root,f))});
 let integrity;try{integrity=await verifyPayload(root);checks.push({name:'source-manifest',passed:integrity.target==='agent-source'});}catch{checks.push({name:'source-manifest',passed:false});}
 let configured=false;try{const text=await readFile(join(root,'.env.local'),'utf8');configured=/^\s*DEEPSEEK_API_KEY\s*=\s*[^#\s]+/m.test(text);}catch{}
 return{schema:1,kind:'agent-deployment-doctor',plan,checks,configuredKey:!!process.env.DEEPSEEK_API_KEY||configured,modelsCalled:false,passed:checks.every(c=>c.passed)};
}
async function configure(root){const file=join(root,'.env.local');let h;try{h=await open(file,'wx',0o600);await h.writeFile('# Private. Fill your own key; never distribute.\nDEEPSEEK_API_KEY=\nHD_HERMES_INSTALL=.runtime/hermes-agent\n');}catch(e){if(e.code!=='EEXIST')throw e;}finally{await h?.close();}}
export async function deployMain(argv,root=resolve(import.meta.dirname,'..')){
 const {command,options}=parseArguments(argv),plan=deploymentPlan({root,...options});
 if(command==='plan'){console.log(JSON.stringify(plan,null,2));return;}
 if(command==='doctor'){const report=await deploymentDoctor({root,python:options.python,options});console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;return;}
 if(command==='setup'){
  const doctor=await deploymentDoctor({root,python:options.python,options});if(!doctor.passed){console.log(JSON.stringify(doctor,null,2));throw Error('Deployment prerequisites failed');}
  await assertNoLegacyRuntime();const lease=await acquireDataLease({directory:join(root,'data'),mode:'admin'});
  try{
   const python=doctor.checks.find(c=>c.name==='Python').executable;
   await run(python,[join(root,'tools/agent-install.py'),...(options.offline?['--offline']:[])],{root,env:options.offline?{PIP_NO_INDEX:'1'}:{}});
   const npm=process.platform==='win32'?'npm.cmd':'npm'; // Windows npm is a batch file; use its JS entry with Node.
   if(process.platform==='win32'){
    const found=await exec('where.exe',['npm.cmd'],{windowsHide:true,timeout:10000,maxBuffer:8192});
    const candidate=found.stdout.split(/\r?\n/).find(s=>s.trim());
    const npmEntry=join(resolve(candidate,'..'),'node_modules/npm/bin/npm-cli.js');
    if(!existsSync(npmEntry))throw Error('npm CLI not found alongside npm.cmd');
    if(options.offline)await run(process.execPath,[npmEntry,'cache','add',join(root,'vendor/playwright-core-1.63.0.tgz'),'--cache',join(root,'.runtime/npm-cache'),'--offline','--ignore-scripts'],{root});
    await run(process.execPath,[npmEntry,'ci','--ignore-scripts','--no-audit','--no-fund',...(options.offline?['--offline','--cache',join(root,'.runtime/npm-cache')]:[])],{root});
   }else{
    if(options.offline)await run(npm,['cache','add',join(root,'vendor/playwright-core-1.63.0.tgz'),'--cache',join(root,'.runtime/npm-cache'),'--offline','--ignore-scripts'],{root});
    await run(npm,['ci','--ignore-scripts','--no-audit','--no-fund',...(options.offline?['--offline','--cache',join(root,'.runtime/npm-cache')]:[])],{root});
   }
   await configure(root);await writeFile(join(root,'.runtime/agent-installed.json'),JSON.stringify({schema:1,platform:process.platform,arch:process.arch,node:process.versions.node,python:doctor.checks.find(c=>c.name==='Python').version,offline:!!options.offline,at:new Date().toISOString()},null,2));
   console.log(JSON.stringify({installed:true,plan,privateConfigurationPreserved:true,modelsCalled:false}));
  }finally{await lease.release();}
  return;
 }
 await verifyPayload(root);
 if(!existsSync(plan.python)||!existsSync(join(plan.hermes,'run_agent.py')))throw Error('Run setup first; runtime is missing');
 if(command==='verify'){
  await run(plan.python,[join(root,'tools/agent-install.py'),'--verify-only'],{root});
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),testArgs=pkg.scripts.test.split(' ').slice(1);await run(process.execPath,testArgs,{root,env:{DEEPSEEK_API_KEY:''}});
  await run(process.execPath,[join(root,'tools/cocreation-check.mjs')],{root});
  console.log(JSON.stringify({verified:true,modelsCalled:false,scope:'payload + native runtime imports + default rules + course environment; not hardware/human acceptance'}));return;
 }
 console.log(JSON.stringify({starting:true,pid:process.pid,plan}));
 Object.assign(process.env,{HD_HERMES_INSTALL:plan.hermes,HD_HERMES_PYTHON:plan.python,HD_MODEL_PYTHON:plan.python,HD_DOCUMENT_PYTHON:plan.python});
 process.argv=[process.execPath,...plan.args];
 await import(pathToFileURL(plan.args[0]).href);
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))deployMain(process.argv.slice(2)).catch(e=>{console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;});
