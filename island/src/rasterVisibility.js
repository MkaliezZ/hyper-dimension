// Canvas-space bounds are conservative: keep a two-pixel fringe, and never
// skip an operation whose compositing/filter/shadow can affect other pixels.
export function rasterOutsideCanvas(ctx,source,rect){
 try{
  if(ctx.globalCompositeOperation!=='source-over'||ctx.filter&&ctx.filter!=='none'||ctx.shadowBlur||ctx.shadowOffsetX||ctx.shadowOffsetY)return false;
  const width=ctx.canvas?.width,height=ctx.canvas?.height,m=ctx.getTransform();
  if(!(width>0&&height>0)||m.is2D===false||![width,height,m.a,m.b,m.c,m.d,m.e,m.f].every(Number.isFinite))return false;
  let x,y,w,h;
  if(rect.length===8)[x,y,w,h]=rect.slice(4);
  else if(rect.length===4)[x,y,w,h]=rect;
  else if(rect.length===2){[x,y]=rect;w=source.naturalWidth||source.width;h=source.naturalHeight||source.height;}
  else return false;
  if(![x,y,w,h].every(Number.isFinite)||w===0||h===0)return false;
  const xs=[],ys=[];
  for(const [u,v]of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){xs.push(m.a*u+m.c*v+m.e);ys.push(m.b*u+m.d*v+m.f);}
  if(![...xs,...ys].every(Number.isFinite))return false;
  return Math.max(...xs)<-2||Math.min(...xs)>width+2||Math.max(...ys)<-2||Math.min(...ys)>height+2;
 }catch{return false;}
}
