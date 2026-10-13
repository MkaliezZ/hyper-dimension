// One shared surface deforms the original sprite. Every neighbouring triangle
// shares its vertices: shoulders, elbows, waist and knees cannot drift apart.
import {drawConnectedSurface} from './connectedSpriteSurface.js';
import {harvestStroke} from './toolMotion.js';
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const rotate=(p,pivot,angle)=>{const x=p.x-pivot.x,y=p.y-pivot.y,c=Math.cos(angle),s=Math.sin(angle);return{x:pivot.x+x*c-y*s,y:pivot.y+x*s+y*c};};
export const BODY_MESH_COLUMNS=Object.freeze([0,.20,.5,.80,1]);
export const BODY_MESH_ROWS=Object.freeze([0,.45,.56,.66,.77,.86,1]);
export const GARMENT_MESH_ROWS=Object.freeze([0,.09,.23,.40,.55,.79,1]);
export function jointAngles({side,gait=0,action,t=0,harvest=null,work=0}){
 const pulse=Math.sin(Math.PI*Math.max(0,Math.min(1,t)))**2;
 let upper=side*gait*.12,lower=-side*Math.abs(gait)*.045;
 if(harvest){upper+=side*(harvest.reach*.012+harvest.lift*.08);lower+=side*(harvest.reach*.022+harvest.lift*.34);}
 else if(action==='celebrate'){upper-=side*pulse*1.0;lower-=side*pulse*.68;}
 else if(['hoe','pickaxe','axe'].includes(action)){upper+=side*pulse*.22;lower+=side*pulse*.62;}
 else if(action==='water'){upper+=side*pulse*.11;lower+=side*pulse*.36;}
 else if(action==='sow'||action==='fertilize'){upper-=side*pulse*.06;lower+=side*pulse*.25;}
 else if(action){upper+=side*work*.035;lower+=side*pulse*.10;}
 return{upper,lower};
}
export function spriteSkinPoint(u,v,{width,height,garment=false,...pose}){
 const p={x:(u-.5)*width,y:(v-1)*height},side=u<.5?-1:u>.5?1:0;
 if(!side)return p;
 const shoulderV=garment?.09:.50,elbowV=garment?.25:.62,armEnd=garment?.55:.80;
 const shoulder={x:side*.28*width,y:(shoulderV-1)*height},elbow={x:side*.34*width,y:(elbowV-1)*height};
 const weights=smooth((Math.abs(u-.5)-.18)/.16)*smooth((v-shoulderV)/.055)*(1-smooth((v-armEnd+.035)/.055));
 const angles=jointAngles({side,...pose});let arm=p;
 if(weights>0){
  const forearmWeight=smooth((v-elbowV+.025)/.10),bent=rotate(p,elbow,angles.lower);
  const forearm={x:p.x+(bent.x-p.x)*forearmWeight,y:p.y+(bent.y-p.y)*forearmWeight};
  arm=rotate(forearm,shoulder,angles.upper);
 }
 let x=p.x+(arm.x-p.x)*weights,y=p.y+(arm.y-p.y)*weights;
 const legStart=garment?.79:.79,legWeight=smooth((v-legStart)/.12)*smooth(Math.abs(u-.5)/.18);
 if(legWeight>0){const hip={x:side*.17*width,y:(legStart-1)*height},leg=rotate(p,hip,-side*(pose.gait||0)*.09);x+=(leg.x-p.x)*legWeight;y+=(leg.y-p.y-Math.max(0,side*(pose.gait||0))*1.5)*legWeight;}
 return{x,y};
}
export function createSpriteMesh(pose,{from=0,to=1}={}){
 const rows=[from,...(pose.garment?GARMENT_MESH_ROWS:BODY_MESH_ROWS).filter(v=>v>from&&v<to),to],columns=BODY_MESH_COLUMNS;
 const vertices=rows.map(v=>columns.map(u=>({u,v,...spriteSkinPoint(u,v,pose)}))),triangles=[];
 for(let r=0;r<rows.length-1;r++)for(let c=0;c<columns.length-1;c++){const a=vertices[r][c],b=vertices[r][c+1],d=vertices[r+1][c],e=vertices[r+1][c+1];triangles.push([a,b,e],[a,e,d]);}
 const deformed=vertices.some(row=>row.some(p=>Math.abs(p.x-(p.u-.5)*pose.width)+Math.abs(p.y-(p.v-1)*pose.height)>1e-7));
 // Very narrow side artwork must keep a valid surface even during broad gestures.
 const originals=vertices.flat().map(p=>({p,x:p.x,y:p.y}));let strength=1;
 if(deformed)for(const [a,b,c]of triangles){
  const rb={x:(b.u-a.u)*pose.width,y:(b.v-a.v)*pose.height},rc={x:(c.u-a.u)*pose.width,y:(c.v-a.v)*pose.height},db={x:b.x-a.x-rb.x,y:b.y-a.y-rb.y},dc={x:c.x-a.x-rc.x,y:c.y-a.y-rc.y},cross=(a,b)=>a.x*b.y-a.y*b.x;
  const A=cross(db,dc),B=cross(rb,dc)+cross(db,rc),C=cross(rb,rc)*.8,roots=[];
  if(Math.abs(A)<1e-9){if(Math.abs(B)>1e-9)roots.push(-C/B);}else{const d=B*B-4*A*C;if(d>=0){const r=Math.sqrt(d);roots.push((-B-r)/(2*A),(-B+r)/(2*A));}}
  for(const r of roots)if(r>0&&r<strength)strength=r;
 }
 if(strength<1)for(const {p,x,y}of originals){const rx=(p.u-.5)*pose.width,ry=(p.v-1)*pose.height;p.x=rx+(x-rx)*strength;p.y=ry+(y-ry)*strength;}
 return{pose,rows,columns,vertices,triangles,deformed,strength};
}
export function spriteMeshPoint(mesh,u,v){
 const cs=mesh.columns,rs=mesh.rows,c=Math.min(cs.length-2,Math.max(0,cs.findIndex(x=>x>=u)-1)),r=Math.min(rs.length-2,Math.max(0,rs.findIndex(y=>y>=v)-1)),x=(u-cs[c])/(cs[c+1]-cs[c]),y=(v-rs[r])/(rs[r+1]-rs[r]);
 const a=mesh.vertices[r][c],b=mesh.vertices[r][c+1],d=mesh.vertices[r+1][c],e=mesh.vertices[r+1][c+1],points=y<=x?[a,b,e]:[a,e,d],weights=y<=x?[1-x,x-y,y]:[1-y,x,y-x];
 return{x:points.reduce((s,p,i)=>s+p.x*weights[i],0),y:points.reduce((s,p,i)=>s+p.y*weights[i],0)};
}
export function spriteMeshHands(mesh,heading,flip=false){
 const column=[0,1,2,3,4,3,2,1][heading],garment=mesh.pose.garment;
 const anchors=column===2?[[.72,garment?.40:.69,1]]:[[.14,garment?.39:.69,-1],[.86,garment?.39:.69,1]];
 return anchors.map(([u,v,side])=>{const p=spriteMeshPoint(mesh,u,v),e=spriteMeshPoint(mesh,u,garment?.25:.62),angle=Math.atan2(p.y-e.y,p.x-e.x)-Math.PI/2;return{...p,x:p.x*(flip?-1:1),side,column,angle:angle*(flip?-1:1),u,v};});
}
function triangleMap(source,dest){
 const [a,b,c]=source,[p,q,r]=dest,det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(det)<1e-8)return null;
 const A=((q.x-p.x)*(c.y-a.y)-(r.x-p.x)*(b.y-a.y))/det,B=((q.y-p.y)*(c.y-a.y)-(r.y-p.y)*(b.y-a.y))/det,C=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(c.x-a.x))/det,D=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(c.x-a.x))/det;
 return[A,B,C,D,p.x-A*a.x-C*a.y,p.y-B*a.x-D*a.y];
}
export function drawConnectedSprite(ctx,img,frame,mesh){
 if(!mesh.deformed){const a=mesh.rows[0],h=mesh.rows.at(-1)-a;ctx.drawImage(img,frame.x,frame.y+a*frame.h,frame.w,h*frame.h,-mesh.pose.width/2,(a-1)*mesh.pose.height,mesh.pose.width,h*mesh.pose.height);return;}
 const makePose=pose=>createSpriteMesh(pose,{from:mesh.rows[0],to:mesh.rows.at(-1)});makePose.harvest=harvestStroke;
 if(drawConnectedSurface(ctx,img,frame,mesh,makePose,(target,surface)=>drawCanvasSurface(target,img,frame,surface)))return;
 drawCanvasSurface(ctx,img,frame,mesh);
}
function drawCanvasSurface(ctx,img,frame,mesh){
 const source=v=>({x:frame.x+v.u*frame.w,y:frame.y+v.v*frame.h});
 for(const triangle of mesh.triangles){
  // The undeformed head is painted once, with exactly the same boundary as its neck.
  if(triangle[0].v===mesh.rows[0]&&triangle[2].v<=.45&&!mesh.pose.garment){if(triangle!==mesh.triangles[0])continue;const h=triangle[2].v-mesh.rows[0];ctx.drawImage(img,frame.x,frame.y+mesh.rows[0]*frame.h,frame.w,h*frame.h,-mesh.pose.width/2,(mesh.rows[0]-1)*mesh.pose.height,mesh.pose.width,h*mesh.pose.height);continue;}
  const uv=triangle.map(source),matrix=triangleMap(uv,triangle);if(!matrix)continue;
  const pad=Math.max(frame.w/mesh.pose.width,frame.h/mesh.pose.height),x=Math.max(frame.x,Math.min(...uv.map(p=>p.x))-pad),y=Math.max(frame.y,Math.min(...uv.map(p=>p.y))-pad),w=Math.min(frame.x+frame.w,Math.max(...uv.map(p=>p.x))+pad)-x,h=Math.min(frame.y+frame.h,Math.max(...uv.map(p=>p.y))+pad)-y;
  ctx.save();ctx.beginPath();const center={x:triangle.reduce((s,p)=>s+p.x/3,0),y:triangle.reduce((s,p)=>s+p.y/3,0)};
  // A subpixel overlap hides clip antialias seams, while UVs still meet exactly.
  for(let i=0;i<3;i++){const p=triangle[i],d=Math.hypot(p.x-center.x,p.y-center.y)||1,n={x:p.x+(p.x-center.x)/d*.80,y:p.y+(p.y-center.y)/d*.80};if(i===0)ctx.moveTo(n.x,n.y);else ctx.lineTo(n.x,n.y);}ctx.closePath();ctx.clip();ctx.transform(...matrix);ctx.drawImage(img,x,y,w,h,x,y,w,h);ctx.restore();
 }
}
