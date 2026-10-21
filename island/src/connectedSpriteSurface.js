import {createConnectedSurfaceClient} from './connectedSurfaceClient.js';
import {createPoseAtlas} from './poseAtlas.js';
import {afterGpuCommands} from './gpuCompletion.js';
// A single GPU draw skins the entire connected surface. Canvas remains available
// for hosts without WebGL; idle poses keep their direct original-image fast path.
const MAX_TEXTURE_BYTES=96*1024*1024,textures=new Map(),failedImages=new WeakSet();let uploadFailures=0;
const MAX_POSE_BYTES=64*1024*1024,poseAtlas=createPoseAtlas({maxBytes:MAX_POSE_BYTES}),imageIds=new WeakMap();let poseSerial=0,themeFilter=null,blendCanvas=null,hits=0,misses=0;
let renderer=null,unavailable=false,serial=0,bytes=0;
let poseEpoch=0;
const remote=typeof document!=='undefined'&&typeof Worker==='function'&&typeof OffscreenCanvas==='function'&&typeof createImageBitmap==='function'?createConnectedSurfaceClient({onReset:()=>clearPoses()}):null;
// Load the owned module endpoint while the application loads its initial art
// and save. Actual image/raster requests retain their original 15-second clocks.
// The worker's own import has no document and cannot create another endpoint.
remote?.prepare?.();
function initialize(){
 if(unavailable||typeof document==='undefined'&&typeof OffscreenCanvas==='undefined')return null;
 if(renderer)return renderer;
 try{
  const canvas=typeof document==='undefined'?new OffscreenCanvas(300,150):document.createElement('canvas'),gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});if(!gl){unavailable=true;return null;}
  const compile=(type,source)=>{const s=gl.createShader(type);if(!s)throw Error('sprite_shader_unavailable');gl.shaderSource(s,source);gl.compileShader(s);return s;};
  const vertex=compile(gl.VERTEX_SHADER,'#version 300 es\nlayout(location=0) in vec2 position;layout(location=1) in vec2 uv;uniform vec2 surface;out vec2 textureUV;void main(){gl_Position=vec4(position.x/surface.x*2.0-1.0,1.0-position.y/surface.y*2.0,0.0,1.0);textureUV=uv;}'),fragment=compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;uniform sampler2D artwork;uniform vec4 cropBounds;in vec2 textureUV;out vec4 color;void main(){vec4 c=texture(artwork,clamp(textureUV,cropBounds.xy,cropBounds.zw));color=vec4(c.rgb*c.a,c.a);}'),program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  const buffer=gl.createBuffer(),r={canvas,gl,buffer,vertices:new Float32Array(240*4),draws:0,maxTextureSize:0,pending:null,ready:false,cancelInitialize:null};renderer=r;
  const abandon=()=>{r.cancelInitialize?.();r.pending?.cancel?.();renderer=null;unavailable=true;textures.clear();bytes=0;clearPoses();};
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();abandon();});
  // Link/limit queries also wait for their fence, rather than stalling another
  // island's drawing task while a newly opened map compiles the same program.
  r.cancelInitialize=afterGpuCommands(gl,()=>{
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('sprite_program_unavailable');
   gl.deleteShader(vertex);gl.deleteShader(fragment);r.maxTextureSize=gl.getParameter(gl.MAX_TEXTURE_SIZE);if(gl.getError()!==gl.NO_ERROR)throw Error('sprite_setup_failed');
   gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0);gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);gl.uniform1i(gl.getUniformLocation(program,'artwork'),0);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);r.surface=gl.getUniformLocation(program,'surface');r.cropBounds=gl.getUniformLocation(program,'cropBounds');r.ready=true;r.cancelInitialize=null;
  },()=>{try{gl.deleteShader(vertex);gl.deleteShader(fragment);gl.deleteProgram(program);gl.deleteBuffer(buffer);}finally{abandon();}});return r;
 }catch{unavailable=true;renderer=null;return null;}
}
function texture(r,img){
 let entry=textures.get(img);const {gl}=r;
 if(!r.ready||failedImages.has(img))return null;
 if(entry)return entry.ready&&!r.pending?(entry.used=++serial,entry):null;
 // Up to eight allocations from the same drawing turn share their latest
 // completion fence and error query. No draw uses this context until the whole
 // batch validates. Replacing a fence includes every newly submitted upload.
 if(r.pending?.entries.length>=8)return null;
 const width=img.naturalWidth||img.width,height=img.naturalHeight||img.height;
 if(!width||!height||Math.max(width,height)>r.maxTextureSize)return null;
 const size=width*height*4;if(size>MAX_TEXTURE_BYTES)return null;
 while(bytes+size>MAX_TEXTURE_BYTES){
  const candidates=[...textures].filter(([,value])=>value.ready);
  if(!candidates.length)return null;
  const [key,old]=candidates.reduce((a,b)=>a[1].used<b[1].used?a:b);
  gl.deleteTexture(old.texture);textures.delete(key);bytes-=old.bytes;
 }
 const t=gl.createTexture();if(!t)return null;
 entry={texture:t,width,height,bytes:size,used:++serial,smooth:null,ready:false};
 textures.set(img,entry);bytes+=size;
 const batch=r.pending||{entries:[],cancel:null,done:false};r.pending=batch;
 batch.entries.push({img,entry});batch.cancel?.();batch.cancel=null;
 const reject=()=>{
  if(batch.done)return;batch.done=true;batch.cancel?.();batch.cancel=null;
  for(const {img,entry}of batch.entries){
   gl.deleteTexture(entry.texture);
   if(textures.get(img)===entry){textures.delete(img);bytes-=entry.bytes;}
   failedImages.add(img);uploadFailures++;
  }
  if(r.pending===batch)r.pending=null;
 };
 try{
  gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  batch.cancel=afterGpuCommands(gl,()=>{
   if(gl.getError()!==gl.NO_ERROR)throw Error('sprite_upload_failed');
   for(const {entry}of batch.entries)entry.ready=true;
   batch.done=true;batch.cancel=null;if(r.pending===batch)r.pending=null;
  },reject);
 }catch{reject();}
 return null;
}
function nativeSurfaceRaster(img,frame,mesh,density,smooth){
 const r=initialize();if(!r)return null;
 try{
  const t=texture(r,img);if(!t)return null;
  r.gl.bindTexture(r.gl.TEXTURE_2D,t.texture);if(t.smooth!==smooth){const mode=smooth?r.gl.LINEAR:r.gl.NEAREST;r.gl.texParameteri(r.gl.TEXTURE_2D,r.gl.TEXTURE_MIN_FILTER,mode);r.gl.texParameteri(r.gl.TEXTURE_2D,r.gl.TEXTURE_MAG_FILTER,mode);t.smooth=smooth;}
  const points=mesh.vertices.flat(),minX=Math.min(...points.map(p=>p.x))-2,maxX=Math.max(...points.map(p=>p.x))+2,minY=Math.min(...points.map(p=>p.y))-2,maxY=Math.max(...points.map(p=>p.y))+2,w=Math.ceil((maxX-minX)*density),h=Math.ceil((maxY-minY)*density);
  // Fixed buckets avoid reallocating the GPU surface on each gait phase.
  const bucket=n=>2**Math.ceil(Math.log2(Math.max(32,n))),bw=bucket(w),bh=bucket(h);if(r.canvas.width<bw)r.canvas.width=bw;if(r.canvas.height<bh)r.canvas.height=bh;
  const {gl}=r,cw=r.canvas.width,ch=r.canvas.height;gl.viewport(0,0,cw,ch);gl.disable(gl.SCISSOR_TEST);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2f(r.surface,cw,ch);gl.uniform4f(r.cropBounds,(frame.x+.5)/t.width,(frame.y+.5)/t.height,(frame.x+frame.w-.5)/t.width,(frame.y+frame.h-.5)/t.height);let n=0;
  for(const triangle of mesh.triangles)for(const p of triangle){r.vertices[n++]=(p.x-minX)*density;r.vertices[n++]=(p.y-minY)*density;r.vertices[n++]=(frame.x+p.u*frame.w)/t.width;r.vertices[n++]=(frame.y+p.v*frame.h)/t.height;}
  gl.bindBuffer(gl.ARRAY_BUFFER,r.buffer);gl.bufferData(gl.ARRAY_BUFFER,r.vertices.subarray(0,n),gl.STREAM_DRAW);gl.drawArrays(gl.TRIANGLES,0,n/4);r.draws++;return {canvas:r.canvas,draw:[0,0,w,h,minX,minY,w/density,h/density]};
 }catch{return null;}
}
function paintNativeSurface(ctx,img,frame,mesh){
 const matrix=ctx.getTransform(),density=Math.max(.75,Math.min(4,Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d))));
 const raster=nativeSurfaceRaster(img,frame,mesh,density,ctx.imageSmoothingEnabled);
 if(!raster)return false;
 try{ctx.drawImage(raster.canvas,...raster.draw);return true;}catch{return false;}
}
export function renderConnectedSurfaceInWorker(img,frame,mesh,density,smoothing){const raster=nativeSurfaceRaster(img,frame,mesh,density,smoothing);return raster?{...raster,gl:renderer.gl}:null;}
function paintSurface(ctx,img,frame,mesh){return remote?false:paintNativeSurface(ctx,img,frame,mesh);}
export function prepareConnectedTexture(img){const r=initialize();return r?!!texture(r,img):false;}
export function connectedTextureFailed(img){return failedImages.has(img);}
export function paintConnectedSurfaceInWorker(ctx,img,frame,mesh){return paintNativeSurface(ctx,img,frame,mesh);}
function clearPoses(){poseEpoch++;poseAtlas.clear();}
export function drawConnectedSurface(ctx,img,frame,mesh,makePose,paintFallback){
 if(typeof document==='undefined'||!makePose)return false;
 // Work and walking each have a continuous one-dimensional pose. Interpolate two
 // cached native surfaces; tools still follow the continuous joint coordinates.
 const p=mesh.pose;if(p.action&&Math.abs(p.gait||0)>1e-6)return paintSurface(ctx,img,frame,mesh);
 const smoothing=ctx.imageSmoothingEnabled;if(themeFilter!==smoothing){clearPoses();themeFilter=smoothing;}
 if(!imageIds.has(img))imageIds.set(img,++poseSerial);
 const matrix=ctx.getTransform(),density=Math.ceil(Math.max(.75,Math.min(4,Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d))))*4)/4,steps=64,position=p.action?Math.max(0,Math.min(1,p.t||0))*steps:Math.max(0,Math.min(1,((p.gait||0)+1)/2))*steps,first=Math.floor(position),last=Math.min(steps,first+1),fraction=position-first;
 const prefix=[imageIds.get(img),frame.x,frame.y,frame.w,frame.h,p.width,p.height,p.garment||false,p.action||'walk',p.harvest?.mode||'',mesh.rows[0],mesh.rows.at(-1),density,smoothing].join('|');
 const get=(index,protectedKeys=[])=>{
  const key=prefix+'|'+index;let cached=poseAtlas.get(key);if(cached){hits++;return cached;}
  misses++;const t=index/steps,pose=p.action?{...p,t,work:Math.sin(t*Math.PI*2),harvest:p.harvest?makePose.harvest(t,p.harvest.mode):null}:{...p,gait:t*2-1},surface=makePose(pose),points=surface.vertices.flat(),x=Math.min(...points.map(p=>p.x))-2,y=Math.min(...points.map(p=>p.y))-2,w=Math.ceil((Math.max(...points.map(p=>p.x))+2-x)*density),h=Math.ceil((Math.max(...points.map(p=>p.y))+2-y)*density);
  // Already validated poses remain drawable during another upload. Only a
  // missing deformed pose waits; its temporary Canvas fallback is never cached.
  if(surface.deformed&&remote){
   const epoch=poseEpoch;
   remote.request(key,img,{frame,mesh:surface,density,x,y,w,h,smoothing},(bitmap,draw)=>{
    if(epoch!==poseEpoch)return;
    poseAtlas.put(key,w,h,g=>{g.imageSmoothingEnabled=smoothing;g.scale(density,density);g.translate(-x,-y);g.drawImage(bitmap,...draw);},{x,y,w:w/density,h:h/density},protectedKeys);
   });
   throw Error('sprite_gpu_pending');
  }
  if(surface.deformed){const r=initialize();if(r&&!texture(r,img))throw Error('sprite_gpu_pending');}
  cached=poseAtlas.put(key,w,h,g=>{
   g.imageSmoothingEnabled=smoothing;g.scale(density,density);g.translate(-x,-y);
   if(!surface.deformed){const a=surface.rows[0],height=surface.rows.at(-1)-a;g.drawImage(img,frame.x,frame.y+a*frame.h,frame.w,height*frame.h,-p.width/2,(a-1)*p.height,p.width,height*p.height);}else if(!paintSurface(g,img,frame,surface))paintFallback(g,surface);
  },{x,y,w:w/density,h:h/density},protectedKeys);
  if(!cached)throw Error('pose_atlas_full');return cached;
 };
 try{const a=get(first);if(fraction<1e-7||first===last){ctx.drawImage(a.image,a.sx,a.sy,a.sw,a.sh,a.x,a.y,a.w,a.h);return true;}const b=get(last,[a.key]),x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.ceil((Math.max(a.x+a.w,b.x+b.w)-x)*density),h=Math.ceil((Math.max(a.y+a.h,b.y+b.h)-y)*density);blendCanvas??=document.createElement('canvas');if(blendCanvas.width<w)blendCanvas.width=w;if(blendCanvas.height<h)blendCanvas.height=h;const g=blendCanvas.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,blendCanvas.width,blendCanvas.height);g.imageSmoothingEnabled=smoothing;g.globalCompositeOperation='source-over';g.globalAlpha=1-fraction;g.drawImage(a.image,a.sx,a.sy,a.sw,a.sh,(a.x-x)*density,(a.y-y)*density,a.w*density,a.h*density);g.globalCompositeOperation='lighter';g.globalAlpha=fraction;g.drawImage(b.image,b.sx,b.sy,b.sw,b.sh,(b.x-x)*density,(b.y-y)*density,b.w*density,b.h*density);g.globalAlpha=1;g.globalCompositeOperation='source-over';ctx.drawImage(blendCanvas,0,0,w,h,x,y,w/density,h/density);return true;}catch{return paintSurface(ctx,img,frame,mesh);}
}
export function connectedSurfaceStatus(){if(remote)return {...remote.inspect(),poseCache:{...poseAtlas.inspect(),hits,misses}};return{backend:renderer?'WebGL2 connected surface':unavailable?'Canvas connected surface':'not needed',ready:!!renderer?.ready,draws:renderer?.draws||0,textures:textures.size,pendingUploads:renderer?.pending?.entries.length||0,uploadFailures,textureBytes:bytes,limitBytes:MAX_TEXTURE_BYTES,poseCache:{...poseAtlas.inspect(),hits,misses}};}
