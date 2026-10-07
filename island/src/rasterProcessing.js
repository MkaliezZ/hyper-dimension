// Artwork only: retain parcel coordinates and feather just ocean pixels at the old rim.
export function fadeIslandEdge(bytes,width,height,extent,firstRow=0,lastRow=height){
 const rim=extent.rim||128;
 for(let y=firstRow;y<Math.min(lastRow,height);y++)for(let x=0;x<width;x++){
  const d=Math.min((width-1-x)*extent.width/width,(height-1-y)*extent.height/height);
  if(d>rim)continue;
  const i=(y*width+x)*4,r=bytes[i],g=bytes[i+1],b=bytes[i+2];
  if(g>r*1.45&&b>r*1.65&&b>g*.87){const t=Math.max(0,Math.min(1,d/rim));bytes[i+3]*=t*t*(3-2*t);}
 }
}
export function artworkURL(value,base){
 const url=new URL(value,base),origin=new URL(base).origin;
 if(url.origin!==origin||!url.pathname.startsWith('/assets/')||url.username||url.password||!['http:','https:'].includes(url.protocol))throw Error('invalid_artwork_source');
 return url.href;
}
export function shoreOptions(value){
 if(!value)return null;
 const {width,height,rim=128}=value;
 if(![width,height,rim].every(n=>Number.isFinite(n)&&n>0)||rim>Math.max(width,height))throw Error('invalid_shore_extent');
 return {width,height,rim};
}
export const RASTER_VERTEX='attribute vec2 position;varying vec2 uv;void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}';
export const RASTER_FRAGMENT='precision highp float;uniform sampler2D source;uniform vec2 size;uniform float pixelStyle;varying vec2 uv;'+
 'vec4 sampleAt(vec2 p){return texture2D(source,clamp(p,vec2(0.5)/size,1.0-vec2(0.5)/size));}'+
 'vec4 weights(float t){float t2=t*t,t3=t2*t;return vec4(-0.5*t+t2-0.5*t3,1.0-2.5*t2+1.5*t3,0.5*t+2.0*t2-1.5*t3,-0.5*t2+0.5*t3);}'+
 'void main(){vec2 d=1.0/size;vec4 center=sampleAt(uv),color=center;'+
 'if(pixelStyle<0.5){vec2 p=uv*size-0.5,f=fract(p),base=(floor(p)+0.5)/size;vec4 wx=weights(f.x),wy=weights(f.y);color=vec4(0.0);'+
 'for(int y=0;y<4;y++){for(int x=0;x<4;x++){color+=sampleAt(base+vec2(float(x-1),float(y-1))*d)*wx[x]*wy[y];}}}'+
 'vec4 north=sampleAt(uv+vec2(0.0,d.y)),south=sampleAt(uv-vec2(0.0,d.y)),east=sampleAt(uv+vec2(d.x,0.0)),west=sampleAt(uv-vec2(d.x,0.0));'+
 'vec3 lo=min(center.rgb,min(min(north.rgb,south.rgb),min(east.rgb,west.rgb)));vec3 hi=max(center.rgb,max(max(north.rgb,south.rgb),max(east.rgb,west.rgb)));'+
 'vec3 detail=center.rgb-(north.rgb+south.rgb+east.rgb+west.rgb)*0.25;'+
 'color.rgb=clamp(color.rgb+clamp(detail*0.42,vec3(-0.045),vec3(0.045)),lo,hi);color.a=clamp(color.a,0.0,1.0);color.rgb=clamp(color.rgb,vec3(0.0),vec3(color.a));gl_FragColor=color;}';
