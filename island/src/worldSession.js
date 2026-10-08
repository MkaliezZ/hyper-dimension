let storageTheme=null;
export function configureWorldSession(theme){if(!['pixel','origami'].includes(theme))throw Error('小岛身份无效');storageTheme=theme;}
export const worldStorageTheme=()=>storageTheme;
// Art remains theme-specific; all services for a home island use its stable storage identity.
export function worldRequest(input,init={},base=globalThis.location?.href){
 if(!storageTheme||typeof input!=='string'&&!(input instanceof URL))return {input,init};
 const url=new URL(String(input),base);if(url.origin!==new URL(base).origin||!url.pathname.startsWith('/api/'))return {input,init};
 const home=/^\/api\/(saves|recruitment|parties|cocreation|workbench|residents)\/(pixel|origami)(?=\/|$)/;
 if(home.test(url.pathname))url.pathname=url.pathname.replace(home,(_,service)=>'/api/'+service+'/'+storageTheme);
 if(url.pathname.startsWith('/api/lan/social/history/'))url.searchParams.set('theme',storageTheme);
 let body=init.body;
 if(typeof body==='string'&&/^\/api\/(npc\/|hermes\/|lan\/steward)/.test(url.pathname)){try{const value=JSON.parse(body);if(value&&typeof value==='object'&&!Array.isArray(value))body=JSON.stringify({...value,theme:storageTheme});}catch{}}
 return {input:url.href,init:body===init.body?init:{...init,body}};
}
export function worldFetch(input,init){const r=worldRequest(input,init);return globalThis.fetch(r.input,r.init);}
