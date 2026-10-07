import {artworkURL,shoreOptions,fadeIslandEdge,RASTER_VERTEX,RASTER_FRAGMENT} from './rasterProcessing.js';
// A serial workspace limits temporary GPU surfaces; no island state enters this worker.
let workspace=null,noGPU=false,tail=Promise.resolve();
function createWorkspace(){
 const canvas=new OffscreenCanvas(1,1),gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});
 if(!gl)return null;
 const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw Error('raster_shader_unavailable');}return shader;};
 try{
  const vs=compile(gl.VERTEX_SHADER,RASTER_VERTEX),fs=compile(gl.FRAGMENT_SHADER,RASTER_FRAGMENT),program=gl.createProgram();
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('raster_program_unavailable');
  gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const p=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);gl.uniform1i(gl.getUniformLocation(program,'source'),0);
  return {canvas,gl,program,size:gl.getUniformLocation(program,'size'),pixel:gl.getUniformLocation(program,'pixelStyle')};
 }catch{gl.getExtension('WEBGL_lose_context')?.loseContext();return null;}
}
async function render(data){
 const started=performance.now(),url=artworkURL(data.url,self.location.href),shore=shoreOptions(data.shore),factor=data.theme==='pixel'?1:2;
 if(!['pixel','origami'].includes(data.theme))throw Error('invalid_artwork_theme');
 const response=await fetch(url);if(!response.ok)throw Error('artwork_unavailable');
 let source=await createImageBitmap(await response.blob()),flipped=null,surface=null,masked=null,texture=null;
 const width=source.width,height=source.height,w=width*factor,h=height*factor;
 try{
  if(w*h>48_000_000||Math.max(w,h)>16384)throw Error('artwork_too_large');
  if(shore){
   masked=new OffscreenCanvas(width,height);const g=masked.getContext('2d',{willReadFrequently:true});g.drawImage(source,0,0);
   const pixels=g.getImageData(0,0,width,height);fadeIslandEdge(pixels.data,width,height,shore);g.putImageData(pixels,0,0);
  }
  if(!noGPU){workspace??=createWorkspace();if(!workspace||workspace.gl.isContextLost()){workspace=null;noGPU=true;}}
  surface=new OffscreenCanvas(w,h);const output=surface.getContext('2d');output.imageSmoothingEnabled=data.theme!=='pixel';output.imageSmoothingQuality='high';
  if(workspace){
   const {gl,canvas,program,size,pixel}=workspace;
   if(Math.max(w,h)>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error('artwork_gpu_limit');
   // WebGL unpack flags do not transform ImageBitmap. Apply orientation and alpha on creation.
   flipped=await createImageBitmap(masked||source,{imageOrientation:'flipY',premultiplyAlpha:'premultiply'});
   canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);gl.useProgram(program);texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,flipped);gl.uniform2f(size,width,height);gl.uniform1f(pixel,data.theme==='pixel'?1:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)throw Error('artwork_gpu_failed');
   output.imageSmoothingEnabled=false;output.drawImage(canvas,0,0);
  }else output.drawImage(masked||source,0,0,w,h);
  const blob=await surface.convertToBlob({type:'image/png'});
  return {blob,width:w,height:h,factor,backend:workspace?'Worker GPU reconstruction':'Worker canvas',processingMs:performance.now()-started};
 }finally{
  source.close();flipped?.close();if(texture&&workspace)workspace.gl.deleteTexture(texture);
  if(workspace){workspace.canvas.width=1;workspace.canvas.height=1;}
  if(surface){surface.width=1;surface.height=1;}if(masked){masked.width=1;masked.height=1;}
 }
}
self.onmessage=({data})=>{
 tail=tail.then(async()=>{try{self.postMessage({requestId:data.requestId,...await render(data)});}catch(e){self.postMessage({requestId:data.requestId,error:e.message||'raster_processing_failed'});}});
};
