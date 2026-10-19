// Share a bounded set of Canvas backings across cached poses. Each rectangle
// keeps its original pixel dimensions and a transparent one-pixel gutter.
export function createPoseAtlas({maxBytes=64*1024*1024,pageSize=1024,canvas=()=>document.createElement('canvas')}={}){
 if(!Number.isInteger(pageSize)||pageSize<4||!Number.isFinite(maxBytes)||maxBytes<64)throw TypeError('Invalid pose atlas budget');
 const pages=[],entries=new Map(),workspaces=new Map();let bytes=0,serial=0,evictions=0,workspaceBytes=0;
 const WORKSPACE_LIMIT=4*1024*1024,WORKSPACE_COUNT=32;
 const bucket=n=>2**Math.ceil(Math.log2(n));
 function space(page,w,h,commit=false){
  let x=page.x,y=page.y,row=page.row;
  if(x+w>page.width){x=0;y+=row;row=0;}
  if(y+h>page.height)return null;
  if(commit){page.x=x+w;page.y=y;page.row=Math.max(row,h);}
  return {x:x+1,y:y+1};
 }
 function remove(page){
  for(const key of page.keys)entries.delete(key);
  bytes-=page.bytes;pages.splice(pages.indexOf(page),1);
  page.image.width=0;page.image.height=0;evictions++;
 }
 function allocate(w,h,protectedKeys){
  const paddedW=w+2,paddedH=h+2;
  for(const page of pages)if(space(page,paddedW,paddedH))return {page,...space(page,paddedW,paddedH,true)};
  const width=Math.max(pageSize,bucket(paddedW)),height=Math.max(pageSize,bucket(paddedH)),size=width*height*4;
  if(size>maxBytes||Math.max(width,height)>16384)return null;
  const pinned=new Set(protectedKeys.map(key=>entries.get(key)?.page).filter(Boolean));
  while(bytes+size>maxBytes){
   const victim=pages.filter(page=>!pinned.has(page)).sort((a,b)=>a.used-b.used)[0];
   if(!victim)return null;
   remove(victim);
  }
  const image=canvas();image.width=width;image.height=height;
  const page={image,width,height,bytes:size,x:0,y:0,row:0,keys:new Set(),used:++serial};pages.push(page);bytes+=size;
  return {page,...space(page,paddedW,paddedH,true)};
 }
 function workspaceFor(w,h){
  const key=w+':'+h,found=workspaces.get(key);
  if(found){workspaces.delete(key);workspaces.set(key,found);return found.image;}
  const size=w*h*4,limit=Math.max(WORKSPACE_LIMIT,size);
  while(workspaces.size&&(workspaces.size>=WORKSPACE_COUNT||workspaceBytes+size>limit)){
   const [oldKey,old]=workspaces.entries().next().value;workspaces.delete(oldKey);workspaceBytes-=old.bytes;
   old.image.width=0;old.image.height=0;
  }
  const image=canvas();image.width=w;image.height=h;workspaces.set(key,{image,bytes:size});workspaceBytes+=size;return image;
 }
 return {
  get(key){const entry=entries.get(key);if(entry)entry.page.used=++serial;return entry;},
  put(key,w,h,paint,fields={},protectedKeys=[]){
   if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1)throw TypeError('Invalid pose rectangle');
   const old=entries.get(key);if(old){old.page.used=++serial;return old;}
   const slot=allocate(w,h,protectedKeys);if(!slot)return null;
   // Paint at the same origin and exact backing dimensions as the old standalone
   // pose surface. A subsequent integer copy cannot perturb joint-edge sampling.
   // Keep exact backing dimensions without reallocating the same GPU Canvas
   // on every small change in a walking pose's bounds.
   const workspace=workspaceFor(w,h);
   const draw=workspace.getContext('2d');draw.save();try{
    draw.setTransform(1,0,0,1,0,0);draw.globalAlpha=1;draw.globalCompositeOperation='source-over';draw.clearRect(0,0,w,h);
    draw.beginPath();draw.rect(0,0,w,h);draw.clip();paint(draw);
   }finally{draw.restore();}
   const {page,x,y}=slot,g=page.image.getContext('2d');
   g.save();try{
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(x-1,y-1,w+2,h+2);
    g.beginPath();g.rect(x,y,w,h);g.clip();g.imageSmoothingEnabled=false;g.drawImage(workspace,x,y);
   }finally{g.restore();}
   const entry={...fields,key,image:page.image,sx:x,sy:y,sw:w,sh:h,page};page.keys.add(key);page.used=++serial;entries.set(key,entry);return entry;
  },
  clear(){for(const page of [...pages])remove(page);for(const {image}of workspaces.values()){image.width=0;image.height=0;}workspaces.clear();workspaceBytes=0;},
  inspect:()=>({entries:entries.size,bytes,limitBytes:maxBytes,pages:pages.length,workspaceBytes,workspaceSurfaces:workspaces.size,workspaceLimitBytes:WORKSPACE_LIMIT,evictions})
 };
}
