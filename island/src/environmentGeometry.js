// Classify only ocean connected to the map boundary; blue roofs/crystals stay land.
export function buildEnvironmentGeometry(rgba,width,height,cell=4){
 if(rgba.length!==width*height*4)throw Error('invalid_environment_pixels');
 const candidates=new Uint8Array(width*height),water=new Uint8Array(width*height),queue=new Int32Array(width*height);let tail=0;
 for(let i=0;i<candidates.length;i++){const n=i*4,r=rgba[n],g=rgba[n+1],b=rgba[n+2];candidates[i]=rgba[n+3]<30||g>r*1.23&&b>r*1.35&&b>g*.88?1:0;}
 function add(i){if(i>=0&&i<water.length&&!water[i]&&candidates[i]){water[i]=1;queue[tail++]=i;}}
 for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
 for(let head=0;head<tail;head++){const i=queue[head],x=i%width,y=Math.floor(i/width);if(x)add(i-1);if(x<width-1)add(i+1);if(y)add(i-width);if(y<height-1)add(i+width);}
 const edges=[],byStart=new Map(),stride=width+1;
 function edge(x1,y1,x2,y2){const a=y1*stride+x1,b=y2*stride+x2,index=edges.length;edges.push({a,b,used:false});const rows=byStart.get(a)||[];rows.push(index);byStart.set(a,rows);}
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){if(water[y*width+x])continue;
  if(y===0||water[(y-1)*width+x])edge(x,y,x+1,y);
  if(x===width-1||water[y*width+x+1])edge(x+1,y,x+1,y+1);
  if(y===height-1||water[(y+1)*width+x])edge(x+1,y+1,x,y+1);
  if(x===0||water[y*width+x-1])edge(x,y+1,x,y);
 }
 const loops=[];for(let n=0;n<edges.length;n++){if(edges[n].used)continue;let index=n;const points=[];
  while(index!==undefined&&!edges[index].used){const e=edges[index];e.used=true;points.push({x:e.a%stride*cell,y:Math.floor(e.a/stride)*cell});index=(byStart.get(e.b)||[]).find(k=>!edges[k].used);}
  if(points.length>=4)loops.push(points);
 }
 const sample=(x,y)=>{const xx=Math.floor(x/cell),yy=Math.floor(y/cell);return xx<0||yy<0||xx>=width||yy>=height?true:!!water[yy*width+xx];};
 const coast=loops.filter(l=>l.length>16).map(points=>points.map((point,i)=>{const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length],dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1;let nx=dy/len,ny=-dx/len;if(!sample(point.x+nx*8,point.y+ny*8)){nx=-nx;ny=-ny;}return {...point,nx,ny};}));
 return {width,height,cell,water,loops,coast,isWater:sample};
}
