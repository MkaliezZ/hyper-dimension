// A completed GPU frame gets its own CPU pixel plane before an ImageBitmap
// crosses threads. No returned bitmap aliases the live GL drawing buffer.
export const GPU_FRAME_LIMITS=Object.freeze({dimension:16384,bytes:256*1024*1024});
const unpremultiply=new Uint8Array(256*256);
for(let alpha=1;alpha<256;alpha++)for(let color=0;color<256;color++)unpremultiply[(alpha<<8)|color]=Math.min(255,Math.round(color*255/alpha));
const planes=new WeakMap(),counts={frames:0,bytes:0,allocations:0};
export const gpuFrameSnapshotStatus=()=>({...counts,source:'cpu-owned-rgba'});
export async function captureGpuFrame(gl,canvas,{bitmap=(image,options)=>createImageBitmap(image,options),Image=globalThis.ImageData,maxBytes=GPU_FRAME_LIMITS.bytes}={}){
 const width=canvas?.width,height=canvas?.height;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>GPU_FRAME_LIMITS.dimension||height>GPU_FRAME_LIMITS.dimension||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>GPU_FRAME_LIMITS.bytes||width*height*4>maxBytes)throw Error('gpu_snapshot_budget');
 if(typeof Image!=='function')throw Error('gpu_snapshot_image_data_unavailable');
 let plane=planes.get(gl);
 if(!plane||plane.busy||plane.pixels.byteLength!==width*height*4){const next={pixels:new Uint8Array(width*height*4),row:new Uint8Array(height>1?width*4:0),busy:false};counts.allocations++;if(!plane||!plane.busy)planes.set(gl,next);plane=next;}
 if(plane.row.byteLength!==(height>1?width*4:0))plane.row=new Uint8Array(height>1?width*4:0);
 plane.busy=true;try{const pixels=plane.pixels;
 gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 if(gl.getError()!==gl.NO_ERROR)throw Error('gpu_snapshot_readback_failed');
 const attributes=gl.getContextAttributes();if(!attributes)throw Error('gpu_snapshot_context_lost');
 // Ocean shaders store premultiplied color. ImageData stores straight color;
 // the bounded lookup preserves each original 8-bit premultiplied channel
 // when Canvas subsequently composites it. Sprite contexts stay straight.
 if(attributes.premultipliedAlpha)for(let i=0;i<pixels.length;i+=4){const alpha=pixels[i+3];if(alpha===255)continue;if(alpha===0){pixels[i]=pixels[i+1]=pixels[i+2]=0;continue;}const base=alpha<<8;pixels[i]=unpremultiply[base|pixels[i]];pixels[i+1]=unpremultiply[base|pixels[i+1]];pixels[i+2]=unpremultiply[base|pixels[i+2]];}
 // WebGL rows start at the lower edge. Flip in place using one bounded row,
 // retaining only one full pixel plane even for a full-resolution ocean.
 const stride=width*4,row=plane.row;
 for(let y=0;y<Math.floor(height/2);y++){
  const top=y*stride,bottom=(height-y-1)*stride;
  row.set(pixels.subarray(top,top+stride));pixels.copyWithin(top,bottom,bottom+stride);pixels.set(row,bottom);
 }
 const image=new Image(new Uint8ClampedArray(pixels.buffer),width,height);
 const result=await bitmap(image,{premultiplyAlpha:attributes.premultipliedAlpha?'premultiply':'none'});
 if(!result||result.width!==width||result.height!==height){result?.close?.();throw Error('gpu_snapshot_dimensions');}
 counts.frames++;counts.bytes+=pixels.byteLength;return result;
 }finally{plane.busy=false;}
}
