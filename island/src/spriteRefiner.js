// Only artwork enters this worker; save state and game outcomes stay with their own services.
export function createSpriteRefiner(){
 if(typeof Worker==='undefined')return null;
 let worker=null,serial=0,imageSerial=0,registered=new WeakMap();const imageIds=new WeakMap(),pending=new Map();
 function start(){
  if(worker)return worker;
  worker=new Worker(new URL('./spriteRasterWorker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const p=pending.get(data.requestId);if(!p){data.bitmap?.close?.();return;}pending.delete(data.requestId);data.error?p.reject(Error(data.error)):p.resolve(data.bitmap||true);};
  worker.onerror=()=>{for(const p of pending.values())p.reject(Error('Artwork refinement unavailable'));pending.clear();worker?.terminate();worker=null;registered=new WeakMap();};
  return worker;
 }
 function request(message,transfer=[]){
  const target=start(),requestId=++serial;
  return new Promise((resolve,reject)=>{pending.set(requestId,{resolve,reject});try{target.postMessage({...message,requestId},transfer)}catch(error){pending.delete(requestId);reject(error)}});
 }
 async function register(image){
  if(registered.has(image))return registered.get(image);
  let id=imageIds.get(image);if(!id){id=++imageSerial;imageIds.set(image,id);}
  const url=image.currentSrc||image.src;if(!url)throw Error('Artwork source unavailable');
  const ready=request({operation:'register',imageId:id,url}).then(()=>id);
  registered.set(image,ready);try{return await ready}catch(error){registered.delete(image);throw error}
 }
 return async(image,x,y,w,h,options)=>{
  let id=await register(image);
  try{return await request({operation:'resize',imageId:id,x,y,w,h,options})}
  catch(error){if(error.message!=='artwork_evicted')throw error;registered.delete(image);id=await register(image);return request({operation:'resize',imageId:id,x,y,w,h,options})}
 };
}
