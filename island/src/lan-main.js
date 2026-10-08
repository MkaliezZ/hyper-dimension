import {worldStorageTheme} from './worldSession.js';
import {installLanStorage} from './lanStorage.js';
const response=await fetch('/api/lan/me',{cache:'no-store'}),data=await response.json();
if(!response.ok){location.replace('/');throw Error('LAN identity required');}
const nativeStorage=window.localStorage;const accountId=data.account.id,nativeFetch=window.fetch.bind(window);window.fetch=(input,init={})=>{const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')){const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));headers.set('X-HD-Island',accountId);return nativeFetch(input,{...init,headers});}return nativeFetch(input,init);};
installLanStorage(window,accountId);
setInterval(async()=>{try{const r=await nativeFetch('/api/lan/me',{cache:'no-store'}),d=await r.json();if(!r.ok||d.account?.id!==accountId)location.replace('/');}catch{}},15000);
const {createPersonalStewardUI}=await import('./lanStewardUI.js');window.hdPersonalSteward=createPersonalStewardUI({context:()=>({...data.account,profile:{...data.account.profile,theme:worldStorageTheme()||data.account.profile.theme}}),storage:nativeStorage});
await import('./app.js');
const {createLanGameDock}=await import('./lanGameDock.js');createLanGameDock({accountId});
