// Graphics belong to their calling document. Prefer a DedicatedWorker so
// navigation does not have to retire an otherwise unshared SharedWorker scope.
// No world state, authority, NPC decisions or documents enter this channel.
let serial=0;
const endpoints=[];
export const gpuEndpointStatus=()=>endpoints.map(({script,id,transport,closed})=>({script,id,transport,closed}));
export function createGpuWorkerEndpoint(script,{Shared=globalThis.SharedWorker,Dedicated=globalThis.Worker}={}){
 const source=new URL(script),id='hd-graphics-'+Date.now().toString(36)+'-'+(++serial)+'-'+Math.random().toString(36).slice(2);
 const record={script:source.pathname,id,transport:'dedicated-worker',closed:false};endpoints.push(record);if(endpoints.length>24)endpoints.shift();
 source.searchParams.set('gpuEndpoint',id);
 if(typeof Dedicated==='function'){
  try{
   const owner=new Dedicated(source,{type:'module',name:id});
   const endpoint={transport:'dedicated-worker',onmessage:null,onerror:null,
    postMessage(data,transfer=[]){if(record.closed)throw Error('graphics_endpoint_closed');owner.postMessage(data,transfer);},
    terminate(){if(record.closed)return;record.closed=true;owner.terminate();owner.onerror=null;}
   };
   owner.onmessage=event=>{if(record.closed){event.data?.bitmap?.close();return;}endpoint.onmessage?.(event);};
   owner.onerror=event=>endpoint.onerror?.(event);return ownEndpoint(endpoint);
  }catch{}
 }
 if(typeof Shared==='function'){
  try{
   const owner=new Shared(source,{type:'module',name:id}),port=owner.port;
   const endpoint={transport:'shared-worker',onmessage:null,onerror:null,
    postMessage(data,transfer=[]){if(record.closed)throw Error('graphics_endpoint_closed');port.postMessage(data,transfer);},
    terminate(){if(record.closed)return;record.closed=true;try{port.postMessage({kind:'__hd_graphics_close'});}finally{port.close();owner.onerror=null;}}
   };
   record.transport=endpoint.transport;
   port.onmessage=event=>{if(record.closed){event.data?.bitmap?.close();return;}endpoint.onmessage?.(event);};
   port.onmessageerror=event=>endpoint.onerror?.(event);owner.onerror=event=>endpoint.onerror?.(event);port.start();return ownEndpoint(endpoint);
  }catch{}
 }
 record.closed=true;throw Error('graphics_endpoint_unavailable');
}

export function serveGpuWorkerEndpoint(receive,scope=globalThis){
 if(typeof scope.postMessage==='function'){scope.onmessage=receive;return;}
 let port=null,closed=false;
 scope.postMessage=(data,transfer=[])=>{if(closed){data?.bitmap?.close();return;}if(!port)throw Error('graphics_endpoint_unconnected');port.postMessage(data,transfer);};
 scope.onconnect=event=>{
  const incoming=event.ports[0];if(!incoming)return;if(port||closed){incoming.close();return;}port=incoming;
  port.onmessage=message=>{
   if(message.data?.kind==='__hd_graphics_close'){closed=true;port.close();scope.close();return;}
   if(!closed)return receive(message);
  };
  port.start();
 };
}

// Explicitly release the owned endpoint on actual navigation. A page kept in the
// back/forward cache retains its endpoint for the eventual pageshow.
function ownEndpoint(endpoint){
 const stop=endpoint.terminate.bind(endpoint),hide=event=>{if(!event?.persisted)endpoint.terminate();};
 endpoint.terminate=()=>{globalThis.removeEventListener?.('pagehide',hide);stop();};
 globalThis.addEventListener?.('pagehide',hide);return endpoint;
}
