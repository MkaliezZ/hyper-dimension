import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {win32,posix} from 'node:path';

export function browserLaunchOptions({platform=process.platform,environment=process.env,home=homedir(),exists=existsSync}={}){
 const explicit=environment.HD_QA_BROWSER;
 if(explicit){
  const native=platform==='win32'?win32:posix;
  if(!native.isAbsolute(explicit)||!exists(explicit))throw Error('HD_QA_BROWSER must name an existing absolute Chrome/Edge/Chromium executable');
  return {executablePath:explicit,headless:true};
 }
 let candidates=[];
 if(platform==='win32'){
  candidates=[win32.join(environment['ProgramFiles(x86)']||'C:\\Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
   win32.join(environment.ProgramFiles||'C:\\Program Files','Google/Chrome/Application/chrome.exe'),
   ...(environment.LOCALAPPDATA?[win32.join(environment.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe')]:[])];
 }else if(platform==='darwin'){
  const apps=['Google Chrome.app/Contents/MacOS/Google Chrome','Microsoft Edge.app/Contents/MacOS/Microsoft Edge','Chromium.app/Contents/MacOS/Chromium'];
  candidates=['/Applications',posix.join(home,'Applications')].flatMap(dir=>apps.map(app=>posix.join(dir,app)));
 }else if(platform==='linux'){
  candidates=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/microsoft-edge','/usr/bin/chromium','/usr/bin/chromium-browser'];
 }else throw Error('Browser validation supports Windows, macOS and Linux');
 const executablePath=candidates.find(exists);
 if(!executablePath)throw Error('No installed Chrome/Edge/Chromium found. Install a browser or set HD_QA_BROWSER to its absolute executable path.');
 return {executablePath,headless:true};
}
