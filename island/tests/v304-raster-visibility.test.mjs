import test from 'node:test';
import assert from 'node:assert/strict';
import {rasterOutsideCanvas as outside} from '../src/rasterVisibility.js';
const image={naturalWidth:40,naturalHeight:30},identity={a:1,b:0,c:0,d:1,e:0,f:0};
const context=(matrix=identity,extra={})=>({canvas:{width:100,height:80},globalCompositeOperation:'source-over',filter:'none',shadowBlur:0,shadowOffsetX:0,shadowOffsetY:0,getTransform:()=>matrix,...extra});
test('fully outside images are skipped on every edge while subpixel fringes remain',()=>{
 const c=context();for(const rect of [[-23,0,20,20],[103,0,20,20],[0,-23,20,20],[0,83,20,20]])assert(outside(c,image,rect));
 for(const rect of [[-22,0,20,20],[102,0,20,20],[0,-22,20,20],[0,82,20,20],[-.1,-.1,100.2,80.2]])assert(!outside(c,image,rect));
});
test('bounds follow the actual backing transform and include every rotated/sheared corner',()=>{
 assert(!outside(context({...identity,e:150}),image,[-150,0,20,20]));
 assert(outside(context({...identity,a:2,d:2}),image,[60,0,20,20]));
 assert(!outside(context({a:0,b:1,c:-1,d:0,e:100,f:0}),image,[0,70,30,40]));
 assert(!outside(context({...identity,c:-2}),image,[110,20,20,20]));
 assert(outside(context({...identity,a:-2,d:-2,e:500,f:500}),image,[0,0,20,20]));
});
test('cropped atlas bounds use the destination and reversed rectangles retain visible pixels',()=>{
 assert(!outside(context(),image,[500,500,20,20,10,10,20,20]));
 assert(outside(context(),image,[0,0,20,20,150,150,20,20]));
 assert(!outside(context(),image,[110,20,-30,20]));
 assert(outside(context(),image,[150,150,-20,-20]));
});
test('natural-size drawing uses the actual reconstructed surface dimensions',()=>{
 assert(outside(context(),image,[-45,0]));
 assert(!outside(context(),{naturalWidth:80,naturalHeight:60},[-45,0]));
 assert(!outside(context(),{width:80,height:60},[-45,0]));
});
test('destructive compositing never skips a draw that can clear the canvas',()=>{
 for(const mode of ['copy','source-in','source-out','destination-in','destination-atop','multiply',undefined])assert(!outside(context(identity,{globalCompositeOperation:mode}),image,[500,500,20,20]));
});
test('blur, shadow offsets and unknown transforms stay on the original drawing path',()=>{
 for(const extra of [{filter:'blur(12px)'},{shadowBlur:30},{shadowOffsetX:-500},{shadowOffsetY:-500}])assert(!outside(context(identity,extra),image,[500,500,20,20]));
 for(const matrix of [{...identity,a:NaN},{...identity,is2D:false}])assert(!outside(context(matrix),image,[500,500,20,20]));
 assert(!outside(context(identity,{getTransform(){throw Error('unknown context');}}),image,[500,500,20,20]));
});
test('invalid or incomplete drawing arguments preserve browser validation',()=>{
 for(const rect of [[],[1],[1,2,3],[500,500,0,20],[500,500,20,NaN]])assert(!outside(context(),image,rect));
 assert(!outside(context(identity,{canvas:{width:0,height:80}}),image,[500,500,20,20]));
});
test('ten thousand affine cases never cull a polygon intersecting the padded canvas',()=>{
 let seed=304;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};let skipped=0;
 const clip=(polygon,inside,intersect)=>{const result=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],aa=inside(a),bb=inside(b);if(aa)result.push(a);if(aa!==bb)result.push(intersect(a,b));}return result;};
 for(let i=0;i<10000;i++){
  const m={a:random()*4-2,b:random()*2-1,c:random()*2-1,d:random()*4-2,e:random()*500-250,f:random()*500-250},rect=[random()*200-100,random()*200-100,random()*100+1,random()*100+1];
  if(!outside(context(m),image,rect))continue;skipped++;const[x,y,w,h]=rect;let polygon=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([u,v])=>[m.a*u+m.c*v+m.e,m.b*u+m.d*v+m.f]);
  for(const[axis,edge,sign]of[[0,-2,1],[0,102,-1],[1,-2,1],[1,82,-1]])polygon=clip(polygon,p=>(p[axis]-edge)*sign>=0,(a,b)=>{const t=(edge-a[axis])/(b[axis]-a[axis]);return[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];});
  assert.equal(polygon.length,0);
 }
 assert(skipped>5000);
});
