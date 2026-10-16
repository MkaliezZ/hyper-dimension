// A successful reconciliation must leave its sealed, obsolete document.
// Some embedded browsers can cancel reload without firing pagehide.
export function recoveryReturnURL(original=globalThis.location.href){
 const target=new URL(original);target.searchParams.set('recoveryReturn',crypto.randomUUID());return target.href;
}
export function navigateAfterRecovery({pageLocation=globalThis.location,pageWindow=globalThis.window,schedule=setTimeout,cancel=clearTimeout,delay=1500,onError=()=>{}}={}){
 const original=pageLocation.href;
 if(typeof original!=='string'||typeof pageLocation.replace!=='function'){pageLocation.reload();return;}
 let departed=false;
 const stop=()=>{departed=true;cancel(timer);pageWindow?.removeEventListener?.('pagehide',stop);};
 const fallback=()=>{
  if(departed||pageLocation.href!==original)return;
  try{pageLocation.replace(recoveryReturnURL(original));}
  catch(error){onError(error);}
 };
 const timer=schedule(fallback,delay);timer?.unref?.();
 pageWindow?.addEventListener?.('pagehide',stop,{once:true});
 try{pageLocation.reload();}catch{cancel(timer);fallback();}
}
