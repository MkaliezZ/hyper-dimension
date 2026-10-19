export const vertex=`#version 300 es
in vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
export const fragment=`#version 300 es
precision highp float;
uniform vec2 resolution;uniform vec2 worldSize;uniform mat3 inverseCamera;uniform sampler2D coastField;uniform float time;uniform float pixelStyle;uniform float night;out vec4 outputColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float bell(float d,float width){return exp(-d*d/(width*width));}
void main(){vec2 screen=vec2(gl_FragCoord.x,resolution.y-gl_FragCoord.y);vec2 p=(inverseCamera*vec3(screen,1.)).xy;if(any(lessThan(p,vec2(0.)))||any(greaterThan(p,worldSize))){outputColor=vec4(0.);return;}if(pixelStyle>.5)p=floor(p*2.)*.5;vec2 f=texture(coastField,p/worldSize).rg;float mask=smoothstep(.28,.72,f.g);if(mask<.001){outputColor=vec4(0.);return;}float distance=f.r*127.5;float foam=0.,swell=0.;float variation=sin(p.x*.019+p.y*.012+time*.55)*1.35;
for(int i=0;i<3;i++){float progress=fract(time/6.8+float(i)/3.);float alpha=pow(max(0.,sin(progress*3.14159265)),1.35);float crest=(1.-progress)*27.+variation;foam+=bell(distance-crest,mix(.9,1.25,pixelStyle))*alpha*.38;swell+=bell(distance-crest-3.,3.5)*alpha*.075;}
vec2 cell=floor(p/vec2(49.,31.)),local=mod(p,vec2(49.,31.));float seed=hash(cell),cx=9.+seed*30.,cy=7.+hash(cell+12.)*17.+sin(time*.36+seed*12.)*1.7;float dx=local.x-cx,curve=mix(sin(dx*.11+time*.3+seed)*.75,step(0.,dx)*1.1,pixelStyle);float pulse=pow(max(0.,sin(time*.82+seed*33.)),2.);float wavelet=bell(local.y-cy-curve,mix(.75,.95,pixelStyle))*(1.-smoothstep(3.,10.+seed*7.,abs(dx)))*(.08+.19*pulse);
float trailX=1410.+sin(p.y*.016+time*.18)*45.;float trail=bell(p.x-trailX,38.)*pow(max(0.,sin(p.y*.39+time*1.1)),16.)*.18*(1.-night);float a=min(.68,foam+swell+wavelet+trail)*mask;vec3 color=mix(vec3(.82,.97,.96),vec3(.96,1.,.96),foam/max(.001,foam+swell+wavelet));outputColor=vec4(color*a,a);}`;
export function coastDistanceTexture(field){const {width:w,height:h,water,cell}=field,d=new Float32Array(w*h);for(let i=0;i<d.length;i++)d[i]=water[i]?1e6:0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!water[i])continue;let n=d[i];if(x)n=Math.min(n,d[i-1]+1);if(y)n=Math.min(n,d[i-w]+1);if(x&&y)n=Math.min(n,d[i-w-1]+1.41421356);if(x<w-1&&y)n=Math.min(n,d[i-w+1]+1.41421356);d[i]=n;}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!water[i])continue;let n=d[i];if(x<w-1)n=Math.min(n,d[i+1]+1);if(y<h-1)n=Math.min(n,d[i+w]+1);if(x<w-1&&y<h-1)n=Math.min(n,d[i+w+1]+1.41421356);if(x&&y<h-1)n=Math.min(n,d[i+w-1]+1.41421356);d[i]=n;}
 const pixels=new Uint8Array(w*h*2);for(let i=0;i<d.length;i++){pixels[i*2]=Math.min(255,Math.round(d[i]*cell*2));pixels[i*2+1]=water[i]?255:0;}return pixels;
}

// Called only in the ocean artwork Worker. GPU queries and drawing never run
// on the island animation/receipt thread. Shader constants retain their source.
export function createOceanRenderer(canvas,{onLost=()=>{},onRestored=()=>{}}={}){
 const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,powerPreference:'high-performance'});if(!gl)throw Error('ocean_gpu_unavailable');
 function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw Error('ocean_shader_compile');}return shader;}
 const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('ocean_shader_link');
 gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const index=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,2,gl.FLOAT,false,0,0);
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 const u=Object.fromEntries(['resolution','worldSize','inverseCamera','coastField','time','pixelStyle','night'].map(k=>[k,gl.getUniformLocation(program,k)]));let fieldId=null;
 const renderer={canvas,gl,lost:false,draw(frame,field){
  if(renderer.lost)throw Error('ocean_context_lost');
  if(canvas.width!==frame.width||canvas.height!==frame.height){canvas.width=frame.width;canvas.height=frame.height;}
  gl.useProgram(program);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,texture);
  if(fieldId!==frame.fieldId){gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RG8,field.width,field.height,0,gl.RG,gl.UNSIGNED_BYTE,field.pixels);fieldId=frame.fieldId;}
  gl.uniform2f(u.resolution,canvas.width,canvas.height);gl.uniform2f(u.worldSize,frame.worldWidth,frame.worldHeight);gl.uniformMatrix3fv(u.inverseCamera,false,new Float32Array(frame.inverse));gl.uniform1i(u.coastField,0);gl.uniform1f(u.time,frame.time);gl.uniform1f(u.pixelStyle,frame.theme==='pixel'?1:0);gl.uniform1f(u.night,Math.max(0,Math.min(1,frame.night||0)));gl.drawArrays(gl.TRIANGLES,0,6);
 }};
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer.lost=true;onLost();});canvas.addEventListener('webglcontextrestored',()=>onRestored());return renderer;
}
