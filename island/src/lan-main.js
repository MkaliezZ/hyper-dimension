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
const {createPersonalStewardUI}=await import('./lanStewardUI.js');window.hdPersonalSteward=createPersonalStewardUI({context:()=>({...data.account,profile:{...data.account.profile,theme:worldStorageTheme()||data.account.profile.theme}}),storage:nativeStorage});
await import('./app.js');
const {createLanGameDock}=await import('./lanGameDock.js');createLanGameDock({accountId});
