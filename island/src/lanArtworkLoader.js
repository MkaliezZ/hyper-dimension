// A failed overview must not become the cached, permanent "ready" room art.
// Retry only the same immutable artwork; no save, actor or game result enters here.
export function createLanArtworkLoader({image,overview,house,bounds,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),nonce=()=>Date.now().toString(36),base=()=>globalThis.location?.href}={}){
 const layers=new Map();let serial=0;
 async function asset(url){
  const key=nonce()+'-'+(++serial);let failure;
  for(let attempt=0;attempt<3;attempt++){
   let source=url;if(attempt){const parsed=new URL(url,base());parsed.searchParams.set('hdArtworkRetry',key+'-'+attempt);source=parsed.href;await wait([250,750][attempt-1]);}
   try{const result=await image(source);if(!result?.complete||!result.naturalWidth||!result.naturalHeight)throw Error('Incomplete island artwork');return result;}catch(error){failure=error;}
  }throw failure;
 }
 return{load(theme){
  if(!['pixel','origami'].includes(theme))return Promise.reject(Error('Invalid island artwork theme'));
  if(layers.has(theme))return layers.get(theme);
  const loading=Promise.all([asset(overview(theme)),asset(house(theme))]).then(([map,houses])=>({map,houses,bounds:bounds(theme)})).catch(error=>{if(layers.get(theme)===loading)layers.delete(theme);throw error;});
  layers.set(theme,loading);return loading;
 }};
}
