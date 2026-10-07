const images=new Map();let pixels=0;const maxPixels=32*1024*1024;
self.onmessage=async({data})=>{
 const {requestId,operation,imageId}=data;
 try{
  if(operation==='register'){
   const url=new URL(data.url,self.location.href);if(url.origin!==self.location.origin||!url.pathname.startsWith('/assets/'))throw Error('invalid_artwork_source');
   const response=await fetch(url.href);if(!response.ok)throw Error('artwork_unavailable');const bitmap=await createImageBitmap(await response.blob()),size=bitmap.width*bitmap.height;if(size>maxPixels){bitmap.close();throw Error('artwork_too_large')}
   if(images.has(imageId)){const old=images.get(imageId);pixels-=old.width*old.height;old.close();images.delete(imageId)}
   images.set(imageId,bitmap);pixels+=size;
   while(pixels>maxPixels&&images.size>1){const id=images.keys().next().value,image=images.get(id);pixels-=image.width*image.height;images.delete(id);image.close();}
   self.postMessage({requestId});return;
  }
  if(operation!=='resize')throw Error('unknown_artwork_operation');
  const image=images.get(imageId);if(!image)throw Error('artwork_evicted');images.delete(imageId);images.set(imageId,image);
  const bitmap=await createImageBitmap(image,data.x,data.y,data.w,data.h,data.options);
  self.postMessage({requestId,bitmap},[bitmap]);
 }catch(error){self.postMessage({requestId,error:error.message||'artwork_refinement_failed'})}
};
