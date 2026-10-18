import {createPoseAtlas} from './poseAtlas.js';
// A single GPU draw skins the entire connected surface. Canvas remains available
// for hosts without WebGL; idle poses keep their direct original-image fast path.
const MAX_TEXTURE_BYTES=96*1024*1024,textures=new Map();
const MAX_POSE_BYTES=64*1024*1024,poseAtlas=createPoseAtlas({maxBytes:MAX_POSE_BYTES}),imageIds=new WeakMap();let poseSerial=0,themeFilter=null,blendCanvas=null,hits=0,misses=0;
let renderer=null,unavailable=false,serial=0,bytes=0;
function initialize(){
 if(unavailable||typeof document==='undefined')return null;
 if(renderer)return renderer;
 try{
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});if(!gl){unavailable=true;return null;}
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('sprite_shader_unavailable');return s;};
  const precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT)?.precision?'highp':'mediump';
  const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 position;attribute vec2 uv;uniform vec2 surface;varying vec2 textureUV;void main(){gl_Position=vec4(position.x/surface.x*2.0-1.0,1.0-position.y/surface.y*2.0,0.0,1.0);textureUV=uv;}'),fragment=compile(gl.FRAGMENT_SHADER,'precision '+precision+' float;uniform sampler2D artwork;uniform vec4 cropBounds;varying vec2 textureUV;void main(){vec4 c=texture2D(artwork,clamp(textureUV,cropBounds.xy,cropBounds.zw));gl_FragColor=vec4(c.rgb*c.a,c.a);}'),program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('sprite_program_unavailable');gl.deleteShader(vertex);gl.deleteShader(fragment);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer=null;unavailable=true;textures.clear();bytes=0;});
  gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const position=gl.getAttribLocation(program,'position'),uv=gl.getAttribLocation(program,'uv');gl.enableVertexAttribArray(position);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(position,2,gl.FLOAT,false,16,0);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);gl.uniform1i(gl.getUniformLocation(program,'artwork'),0);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
  renderer={canvas,gl,buffer,surface:gl.getUniformLocation(program,'surface'),cropBounds:gl.getUniformLocation(program,'cropBounds'),vertices:new Float32Array(240*4),draws:0};return renderer;
 }catch{unavailable=true;renderer=null;return null;}
}
function texture(r,img,smooth){
 let entry=textures.get(img);const {gl}=r;
 if(!entry){const width=img.naturalWidth||img.width,height=img.naturalHeight||img.height;if(!width||!height||Math.max(width,height)>gl.getParameter(gl.MAX_TEXTURE_SIZE))return null;
  const size=width*height*4;if(size>MAX_TEXTURE_BYTES)return null;
  while(bytes+size>MAX_TEXTURE_BYTES&&textures.size){const [key,old]=[...textures].reduce((a,b)=>a[1].used<b[1].used?a:b);gl.deleteTexture(old.texture);textures.delete(key);bytes-=old.bytes;}
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);if(gl.getError()!==gl.NO_ERROR){gl.deleteTexture(t);return null;}gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);entry={texture:t,width,height,bytes:size,used:0,smooth:null};textures.set(img,entry);bytes+=size;
 }
 entry.used=++serial;gl.bindTexture(gl.TEXTURE_2D,entry.texture);if(entry.smooth!==smooth){const mode=smooth?gl.LINEAR:gl.NEAREST;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mode);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,mode);entry.smooth=smooth;}return entry;
}
function paintSurface(ctx,img,frame,mesh){
 const r=initialize();if(!r)return false;
 try{
  const t=texture(r,img,ctx.imageSmoothingEnabled);if(!t)return false;
  const points=mesh.vertices.flat(),minX=Math.min(...points.map(p=>p.x))-2,maxX=Math.max(...points.map(p=>p.x))+2,minY=Math.min(...points.map(p=>p.y))-2,maxY=Math.max(...points.map(p=>p.y))+2,matrix=ctx.getTransform(),density=Math.max(.75,Math.min(4,Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)))),w=Math.ceil((maxX-minX)*density),h=Math.ceil((maxY-minY)*density);
  // Fixed buckets avoid reallocating the GPU surface on each gait phase.
  const bucket=n=>2**Math.ceil(Math.log2(Math.max(32,n))),bw=bucket(w),bh=bucket(h);if(r.canvas.width<bw)r.canvas.width=bw;if(r.canvas.height<bh)r.canvas.height=bh;
  const {gl}=r,cw=r.canvas.width,ch=r.canvas.height;gl.viewport(0,0,cw,ch);gl.disable(gl.SCISSOR_TEST);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2f(r.surface,cw,ch);gl.uniform4f(r.cropBounds,(frame.x+.5)/t.width,(frame.y+.5)/t.height,(frame.x+frame.w-.5)/t.width,(frame.y+frame.h-.5)/t.height);let n=0;
  for(const triangle of mesh.triangles)for(const p of triangle){r.vertices[n++]=(p.x-minX)*density;r.vertices[n++]=(p.y-minY)*density;r.vertices[n++]=(frame.x+p.u*frame.w)/t.width;r.vertices[n++]=(frame.y+p.v*frame.h)/t.height;}
  gl.bindBuffer(gl.ARRAY_BUFFER,r.buffer);gl.bufferData(gl.ARRAY_BUFFER,r.vertices.subarray(0,n),gl.STREAM_DRAW);gl.drawArrays(gl.TRIANGLES,0,n/4);ctx.drawImage(r.canvas,0,0,w,h,minX,minY,w/density,h/density);r.draws++;return true;
 }catch{return false;}
}
function clearPoses(){poseAtlas.clear();}
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
  cached=poseAtlas.put(key,w,h,g=>{
   g.imageSmoothingEnabled=smoothing;g.scale(density,density);g.translate(-x,-y);
   if(!surface.deformed){const a=surface.rows[0],height=surface.rows.at(-1)-a;g.drawImage(img,frame.x,frame.y+a*frame.h,frame.w,height*frame.h,-p.width/2,(a-1)*p.height,p.width,height*p.height);}else if(!paintSurface(g,img,frame,surface))paintFallback(g,surface);
  },{x,y,w:w/density,h:h/density},protectedKeys);
  if(!cached)throw Error('pose_atlas_full');return cached;
 };
 try{const a=get(first);if(fraction<1e-7||first===last){ctx.drawImage(a.image,a.sx,a.sy,a.sw,a.sh,a.x,a.y,a.w,a.h);return true;}const b=get(last,[a.key]),x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.ceil((Math.max(a.x+a.w,b.x+b.w)-x)*density),h=Math.ceil((Math.max(a.y+a.h,b.y+b.h)-y)*density);blendCanvas??=document.createElement('canvas');if(blendCanvas.width<w)blendCanvas.width=w;if(blendCanvas.height<h)blendCanvas.height=h;const g=blendCanvas.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,blendCanvas.width,blendCanvas.height);g.imageSmoothingEnabled=smoothing;g.globalCompositeOperation='source-over';g.globalAlpha=1-fraction;g.drawImage(a.image,a.sx,a.sy,a.sw,a.sh,(a.x-x)*density,(a.y-y)*density,a.w*density,a.h*density);g.globalCompositeOperation='lighter';g.globalAlpha=fraction;g.drawImage(b.image,b.sx,b.sy,b.sw,b.sh,(b.x-x)*density,(b.y-y)*density,b.w*density,b.h*density);g.globalAlpha=1;g.globalCompositeOperation='source-over';ctx.drawImage(blendCanvas,0,0,w,h,x,y,w/density,h/density);return true;}catch{return paintSurface(ctx,img,frame,mesh);}
}
export function connectedSurfaceStatus(){return{backend:renderer?'WebGL connected surface':unavailable?'Canvas connected surface':'not needed',draws:renderer?.draws||0,textures:textures.size,textureBytes:bytes,limitBytes:MAX_TEXTURE_BYTES,poseCache:{...poseAtlas.inspect(),hits,misses}};}
