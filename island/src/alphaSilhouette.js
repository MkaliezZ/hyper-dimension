const entries=new WeakMap();
export function alphaContours(pixels,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||pixels.length!==width*height*4)throw Error('invalid_alpha_pixels');
 const edges=[],byStart=new Map(),stride=width+1,solid=(x,y)=>x>=0&&x<width&&y>=0&&y<height&&pixels[(y*width+x)*4+3]>=64;
 const edge=(x1,y1,x2,y2)=>{const a=y1*stride+x1,b=y2*stride+x2,index=edges.length;edges.push({a,b,used:false});const rows=byStart.get(a)||[];rows.push(index);byStart.set(a,rows);};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){if(!solid(x,y))continue;if(!solid(x,y-1))edge(x,y,x+1,y);if(!solid(x+1,y))edge(x+1,y,x+1,y+1);if(!solid(x,y+1))edge(x+1,y+1,x,y+1);if(!solid(x-1,y))edge(x,y+1,x,y);}
 const loops=[];for(let i=0;i<edges.length;i++){if(edges[i].used)continue;let index=i;const points=[];while(index!==undefined&&!edges[index].used){const e=edges[index];e.used=true;points.push({x:e.a%stride,y:Math.floor(e.a/stride)});index=(byStart.get(e.b)||[]).find(n=>!edges[n].used);}if(points.length>=4)loops.push(points);}return loops;
}
// Extract the actual artwork alpha once, preserving holes and disconnected rope
// pieces. Animation reuses the outline; it never reads sprite pixels per frame.
export function alphaSilhouette(image,x=0,y=0,w=image.naturalWidth,h=image.naturalHeight){
 if(!image.complete||!image.naturalWidth)return null;let variants=entries.get(image);if(!variants){variants=new Map();entries.set(image,variants);}const key=[x,y,w,h].join(',');if(variants.has(key))return variants.get(key);
 const width=Math.ceil(w),height=Math.ceil(h),c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,x,y,w,h,0,0,width,height);const pixels=g.getImageData(0,0,width,height).data;
 const path=new Path2D();for(const points of alphaContours(pixels,width,height)){path.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))path.lineTo(p.x,p.y);path.closePath();}
 const value={path,width,height};variants.set(key,value);c.width=c.height=1;return value;
}
export function excludeSilhouette(ctx,shape,rect,world){if(!shape)return;const path=new Path2D();path.rect(0,0,world.width,world.height);path.addPath(shape.path,new DOMMatrix([rect.w/shape.width,0,0,rect.h/shape.height,rect.x,rect.y]));ctx.clip(path,'evenodd');}
