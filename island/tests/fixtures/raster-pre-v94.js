// Runtime raster reconstruction; source files, world coordinates and hit targets stay intact.
// Keep a single GPU workspace. Cache decoded images, not mutable large canvases:
// Large Canvas / canvas-backed ImageBitmap sources can take slow scaling paths.
const entries=new WeakMap(),queue=[];
let worker=null,busy=false,disabled=false;
const stats={ready:0,pending:0,failures:0,bytes:0,encodedBytes:0};
function createWorker(){
 const canvas=document.createElement('canvas');
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});
 if(!gl)return null;
 const vertex='attribute vec2 position;varying vec2 uv;void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}';
 const fragment='precision highp float;uniform sampler2D source;uniform vec2 size;uniform float pixelStyle;varying vec2 uv;'+
 'vec4 sampleAt(vec2 p){return texture2D(source,clamp(p,vec2(0.5)/size,1.0-vec2(0.5)/size));}'+
 'vec4 weights(float t){float t2=t*t,t3=t2*t;return vec4(-0.5*t+t2-0.5*t3,1.0-2.5*t2+1.5*t3,0.5*t+2.0*t2-1.5*t3,-0.5*t2+0.5*t3);}'+
 'void main(){vec2 d=1.0/size;vec4 center=sampleAt(uv),color=center;'+
 'if(pixelStyle<0.5){vec2 p=uv*size-0.5,f=fract(p),base=(floor(p)+0.5)/size;vec4 wx=weights(f.x),wy=weights(f.y);color=vec4(0.0);'+
 'for(int y=0;y<4;y++){for(int x=0;x<4;x++){color+=sampleAt(base+vec2(float(x-1),float(y-1))*d)*wx[x]*wy[y];}}}'+
 'vec4 north=sampleAt(uv+vec2(0.0,d.y)),south=sampleAt(uv-vec2(0.0,d.y)),east=sampleAt(uv+vec2(d.x,0.0)),west=sampleAt(uv-vec2(d.x,0.0));'+
 'vec3 lo=min(center.rgb,min(min(north.rgb,south.rgb),min(east.rgb,west.rgb)));vec3 hi=max(center.rgb,max(max(north.rgb,south.rgb),max(east.rgb,west.rgb)));'+
 'vec3 detail=center.rgb-(north.rgb+south.rgb+east.rgb+west.rgb)*0.25;'+
 'color.rgb=clamp(color.rgb+clamp(detail*0.42,vec3(-0.045),vec3(0.045)),lo,hi);color.a=clamp(color.a,0.0,1.0);color.rgb=clamp(color.rgb,vec3(0.0),vec3(color.a));gl_FragColor=color;}';
 const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null}return shader};
 const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);if(!vs||!fs)return null;
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;
 gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 gl.uniform1i(gl.getUniformLocation(program,'source'),0);
 return {canvas,gl,program,size:gl.getUniformLocation(program,'size'),pixel:gl.getUniformLocation(program,'pixelStyle')};
}
async function freezeRaster(surface){
 // PNG preserves the reconstructed pixels and alpha exactly. Decoding gives
 // Chromium a static image resource whose scaled textures can stay cached.
 const blob=await new Promise(resolve=>surface.toBlob(resolve,'image/png'));
 if(!blob)throw Error('Raster image encoding unavailable');
 const url=URL.createObjectURL(blob),image=new Image();
 try{image.src=url;await image.decode();return {image,bytes:blob.size}}
 finally{URL.revokeObjectURL(url);surface.width=1;surface.height=1}
}
function schedule(){
 if(busy||!queue.length)return;busy=true;
 // Compilation and one-time processing happen outside the animation frame.
 const idle=window.requestIdleCallback||((f)=>setTimeout(f,16));
 idle(async()=>{const job=queue.shift();try{
  worker??=createWorker();
  if(!worker||worker.gl.isContextLost()){disabled=true;throw Error('Raster reconstruction unavailable')}
  const {canvas,gl,program,size,pixel}=worker,{source,entry,theme}=job;
  const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
  const factor=theme==='pixel'?1:2,w=width*factor,h=height*factor;
  if(Math.max(w,h)>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error('Raster exceeds GPU texture size');
  canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);gl.useProgram(program);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.uniform2f(size,width,height);gl.uniform1f(pixel,theme==='pixel'?1:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   const surface=document.createElement('canvas');surface.width=w;surface.height=h;const g=surface.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(canvas,0,0);
   const frozen=await freezeRaster(surface);entry.surface=frozen.image;entry.factor=factor;entry.status='ready';stats.ready++;stats.bytes+=w*h*4;stats.encodedBytes+=frozen.bytes;
  }finally{gl.deleteTexture(texture);canvas.width=1;canvas.height=1}
 }catch{job.entry.status='fallback';stats.failures++}finally{stats.pending--;busy=false;if(disabled){for(const pending of queue)pending.entry.status='fallback';stats.pending=0;queue.length=0}else schedule()}},{timeout:600});
}
function surfaceFor(source,theme){
 let entry=entries.get(source);
 if(!entry){entry={surface:source,factor:1,status:'pending'};entries.set(source,entry);
  if(!disabled&&(source.naturalWidth||source.width)>0){queue.push({source,theme,entry});stats.pending++;schedule()}else entry.status='fallback';
 }
 return entry;
}
export function drawRaster(ctx,source,theme,...rect){
 if(!(source.naturalWidth||source.width))return;
 const e=surfaceFor(source,theme),factor=e.factor;
 ctx.save();ctx.imageSmoothingEnabled=theme!=='pixel';ctx.imageSmoothingQuality='high';
 if(rect.length===8){const [x,y,w,h,dx,dy,dw,dh]=rect;ctx.drawImage(e.surface,x*factor,y*factor,w*factor,h*factor,dx,dy,dw,dh)}
 else ctx.drawImage(e.surface,...rect);
 ctx.restore();
}
export function rasterQualityStatus(){return {...stats,storage:'decoded-image',backend:disabled?'native canvas':worker?'GPU reconstruction':'preparing'}}
// Match the actual display, including fractional OS scaling, without an arbitrary DPR=2 cap.
export function canvasResolution(width,height,ratio=1){
 const native=Math.max(1,Number(ratio)||1),density=Math.min(native,Math.sqrt(48_000_000/Math.max(1,width*height)),16384/Math.max(1,width,height));
 const w=Math.max(1,Math.round(width*density)),h=Math.max(1,Math.round(height*density));
 return {width:w,height:h,x:w/Math.max(1,width),y:h/Math.max(1,height),native};
}
export function rasterTransform(width,height,worldWidth,worldHeight,zoom,camera,ratioX=1,ratioY=1){
 const scale=Math.max(width/worldWidth,height/worldHeight)*zoom;
 return {scale,ox:Math.round((width/2-camera.x*scale)*ratioX)/ratioX,oy:Math.round((height/2-camera.y*scale)*ratioY)/ratioY};
}

