// One completed full-resolution ocean frame, one in flight, and one newest
// requested camera. Only artwork geometry/uniforms enter this Worker.
export function createOceanSurfaceClient({worker=()=>new Worker(new URL('./oceanShaderWorker.js',import.meta.url),{type:'module'}),schedule=setTimeout,cancel=clearTimeout,maxFrameBytes=256*1024*1024}={}){
 const fields=new WeakMap(),registrations=new Map();let endpoint=null,disabled=false,lost=false,serial=0,fieldSerial=0,wanted=null,currentKey=null,flight=null,latest=null;
 let stats={backend:'ocean worker pending',ready:false,draws:0,discarded:0};
 const closeLatest=()=>{latest?.bitmap.close();latest=null;};
 function clearFlight(){if(flight){cancel(flight.timer);flight=null;}}
 function fail(error){disabled=true;endpoint?.terminate();endpoint=null;clearFlight();for(const meta of registrations.values())cancel(meta.timer);registrations.clear();closeLatest();stats={...stats,backend:'canvas-compatible',ready:false,error};}
 function pump(){
  if(disabled||lost||flight||!wanted)return;const request=wanted,meta=request.meta;
  if(!meta.ready){
   if(!meta.sent){meta.sent=true;meta.timer=schedule(()=>fail('ocean_field_timeout'),15000);registrations.set(meta.id,meta);endpoint.postMessage({kind:'field',fieldId:meta.id,width:meta.field.width,height:meta.field.height,cell:meta.field.cell,water:meta.field.water});}
   return;
  }
  wanted=null;const frame={...request.frame,fieldId:meta.id,requestId:++serial,key:request.key};
  flight={...frame,timer:schedule(()=>fail('ocean_frame_timeout'),15000)};
  endpoint.postMessage({kind:'frame',frame});
 }
 function start(){
  if(endpoint)return true;if(disabled)return false;
  try{
   endpoint=worker();endpoint.onerror=()=>fail('ocean_worker_error');endpoint.onmessage=({data})=>{
    if(data.kind==='fatal'){data.bitmap?.close();fail(data.error||'ocean_worker_error');return;}
    if(data.kind==='lost'){lost=true;clearFlight();closeLatest();stats={...stats,ready:false,backend:'canvas-compatible',contextLost:true};return;}
    if(data.kind==='restored'){lost=false;stats={...stats,contextLost:false};pump();return;}
    if(data.kind==='registered'){
     const meta=registrations.get(data.fieldId);if(!meta)return;cancel(meta.timer);registrations.delete(data.fieldId);meta.ready=true;pump();return;
    }
    if(data.kind!=='frame'){data.bitmap?.close();return;}
    if(!flight||data.requestId!==flight.requestId){data.bitmap?.close();stats.discarded++;return;}
    const completed=flight;clearFlight();
    if(data.error){data.bitmap?.close();fail(data.error);return;}
    if(data.bitmap){
     if(completed.key===currentKey){closeLatest();latest={...completed,bitmap:data.bitmap};stats={...stats,backend:'webgl2-worker',ready:true,draws:stats.draws+1};}
     else{data.bitmap.close();stats.discarded++;}
    }
    pump();
   };return true;
  }catch{fail('ocean_worker_unavailable');return false;}
 }
 return {
  frame(field,frame){
   if(disabled||!Number.isInteger(frame.width)||!Number.isInteger(frame.height)||frame.width<1||frame.height<1||frame.width>16384||frame.height>16384||frame.width*frame.height*4>maxFrameBytes||frame.inverse?.length!==9||!frame.inverse.every(Number.isFinite)||!Number.isFinite(frame.time))return null;
   if(!start())return null;let meta=fields.get(field);if(!meta){meta={id:++fieldSerial,field,ready:false,sent:false};fields.set(field,meta);}
   const key=[meta.id,frame.theme,frame.width,frame.height,frame.worldWidth,frame.worldHeight,...frame.inverse].join('|');currentKey=key;
   wanted=latest?.key===key&&latest.time===frame.time||flight?.key===key&&flight.time===frame.time?null:{meta,frame,key};
   try{pump();}catch{fail('ocean_message_failed');return null;}
   return latest?.key===key&&frame.time-latest.time>=0&&frame.time-latest.time<=1.5?latest.bitmap:null;
  },
  inspect:()=>({...stats,pendingFrames:flight?1:0,queuedFrames:wanted?1:0,bitmapBytes:latest?latest.width*latest.height*4:0,frameTime:latest?.time,frameKey:latest?.key,frameLimitBytes:maxFrameBytes,renderThread:'worker'}),
  dispose:()=>fail('ocean_disposed')
 };
}
