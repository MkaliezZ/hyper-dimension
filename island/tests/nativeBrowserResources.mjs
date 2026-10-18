import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join,resolve} from 'node:path';
const execute=promisify(execFile);

// Only PIDs returned by the CDP session of this test's owned browser are read.
// No process inventory, command line, user browser, profile or file is queried.
export function browserProcessIds(processes){
 const ids=processes.map(p=>Number(p.id));
 if(ids.some(id=>!Number.isSafeInteger(id)||id<=0))throw Error('Invalid owned-browser PID');
 return [...new Set(ids)];
}
export function parseBrowserProcessRss(text,allowed){
 const ids=new Set(allowed),out=[];
 for(const line of text.trim().split(/\r?\n/)){
  if(!line.trim())continue;
  const match=line.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(\S+)$/);
  if(!match)throw Error('Invalid browser process memory sample');
  const id=Number(match[1]);if(!ids.has(id))throw Error('Unexpected process in browser sample');
  out.push({id,rssBytes:Number(match[2])*1024,cpuPercent:Number(match[3]),state:match[4]});
 }return out;
}
export async function observeOwnedBrowserProcesses(session,{platform=process.platform,run=execute}={}){
 const {processInfo}=await session.send('SystemInfo.getProcessInfo'),ids=browserProcessIds(processInfo);
 if(!ids.length)return[];
 let memory;
 if(platform==='win32'){
  const command=`[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); @(Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64) | ConvertTo-Json -Compress`;
  const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:2000,maxBuffer:65536});
  const rows=JSON.parse(stdout.trim()||'[]');memory=(Array.isArray(rows)?rows:[rows]).map(r=>({id:r.Id,rssBytes:r.WorkingSet64,privateBytes:r.PrivateMemorySize64}));
  if(memory.some(p=>!ids.includes(p.id)))throw Error('Unexpected process in browser sample');
 }else if(platform==='darwin'||platform==='linux'){
  const {stdout}=await run('/bin/ps',['-o','pid=,rss=,pcpu=,stat=','-p',ids.join(',')],{encoding:'utf8',timeout:2000,maxBuffer:65536});memory=parseBrowserProcessRss(stdout,ids);
 }else throw Error('Unsupported browser memory platform');
 return processInfo.map(p=>({...p,...memory.find(m=>m.id===p.id)}));
}

// A stalled owned macOS fixture needs stacks, not a guessed browser flag.
// Sampling is a diagnostic intervention; its caller must not report a passing
// acceptance run after it has been triggered. No user process is enumerated.
export async function sampleOwnedBrowserStall(session,{directory,platform=process.platform,run=execute}={}){
 if(platform!=='darwin')return{unsupportedPlatform:true,processes:[]};
 let timer,owned;try{owned=await Promise.race([session.send('SystemInfo.getProcessInfo'),new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Owned-browser process lookup timed out')),2000);})]);}finally{clearTimeout(timer);}
 const {processInfo}=owned;browserProcessIds(processInfo);
 const targets=[...processInfo.filter(p=>p.type==='renderer').sort((a,b)=>(b.cpuTime||0)-(a.cpuTime||0)).slice(0,2),...processInfo.filter(p=>p.type==='GPU').slice(0,1)],processes=[];
 for(const target of targets){
  const file=join(resolve(directory),'owned-browser-'+Number(target.id)+'.sample.txt'),row={id:Number(target.id),type:target.type,file};
  try{await run('/usr/bin/sample',[String(row.id),'1','10','-file',file],{encoding:'utf8',timeout:5000,maxBuffer:65536});row.sampled=true;}
  catch(error){row.sampled=false;row.error=String(error.message).slice(0,300);}
  processes.push(row);
 }
 return{diagnosticIntervention:true,processes};
}
