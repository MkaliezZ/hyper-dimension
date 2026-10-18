import {worldStorageTheme} from './worldSession.js';
import {installLanStorage} from './lanStorage.js';
import {identityDisposition,readIdentity} from './lanIdentityGuard.js';
const bootstrapFetch=window.fetch.bind(window);let data,attempt=0,notice;
while(!data){
 const reply=await readIdentity(bootstrapFetch),decision=identityDisposition(reply.status,reply.body);
 if(decision==='expired'){location.replace('/');throw Error('LAN identity required');}
 if(decision==='valid'){data=reply.body;break;}
 if(!notice){notice=document.createElement('p');notice.className='identity-retry-notice';notice.setAttribute('role','status');notice.textContent='正在重新连接本机服务，小岛进度会保留。';document.body.append(notice);}
 await new Promise(r=>setTimeout(r,Math.min(5000,500*++attempt)));
}
notice?.remove();
const nativeStorage=window.localStorage;const accountId=data.account.id,nativeFetch=window.fetch.bind(window);window.fetch=(input,init={})=>{const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')){const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));headers.set('X-HD-Island',accountId);return nativeFetch(input,{...init,headers});}return nativeFetch(input,init);};
installLanStorage(window,accountId);
let checkingIdentity=false;setInterval(async()=>{if(checkingIdentity)return;checkingIdentity=true;try{const r=await readIdentity(nativeFetch),decision=identityDisposition(r.status,r.body,accountId);if(decision==='expired'||decision==='changed')location.replace('/');}finally{checkingIdentity=false;}},15000);
const moduleRetryKey='island-module-retry';
try{
const {createPersonalStewardUI}=await import('./lanStewardUI.js');window.hdPersonalSteward=createPersonalStewardUI({context:()=>({...data.account,profile:{...data.account.profile,theme:worldStorageTheme()||data.account.profile.theme}}),storage:nativeStorage});
await import('./app.js');
const {createLanGameDock}=await import('./lanGameDock.js');createLanGameDock({accountId});
 try{sessionStorage.removeItem(moduleRetryKey);}catch{}
}catch(error){
 const now=Date.now(),message=String(error?.message||error),network=/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);let previous=null,count=0,automatic=false;
 try{previous=JSON.parse(sessionStorage.getItem(moduleRetryKey)||'null');}catch{}
 if(previous?.href===location.href&&Number.isInteger(previous.count)&&previous.count>=0&&previous.count<=2&&Number.isFinite(previous.at)&&now>=previous.at&&now-previous.at<60000)count=previous.count;
 // Only an unexecuted module graph may retry automatically. A runtime failure
 // after entry can have side effects and always needs an explicit user reload.
 if(network&&!window.__hdIslandAppEntered&&count<2){try{const encoded=JSON.stringify({href:location.href,count:count+1,at:now});sessionStorage.setItem(moduleRetryKey,encoded);automatic=sessionStorage.getItem(moduleRetryKey)===encoded;}catch{}}
 window.__hdModuleBootstrapFailure={message,automatic,attempt:count+Number(automatic)};
 const panel=document.createElement('section');panel.id='islandModuleFailure';panel.className='identity-retry-notice';panel.setAttribute('role','status');panel.dataset.automatic=String(automatic);
 const title=document.createElement('strong');title.textContent='小岛组件尚未完整载入';const text=document.createElement('p');text.textContent=automatic?'正在重新载入当前小岛（'+(count+1)+'/2），已保存的进度会保留。':'请重新载入当前小岛。已有进度和待核对记录会保留；若仍失败，请保留此页面的错误信息。';
 const retry=document.createElement('a');retry.id='islandModuleRetry';retry.className='secondary';retry.href=location.href;retry.textContent='重新载入当前小岛';retry.onclick=()=>{try{sessionStorage.removeItem(moduleRetryKey);}catch{}};
 panel.append(title,text,retry);document.body.append(panel);
 if(automatic)setTimeout(()=>location.reload(),300);
}
