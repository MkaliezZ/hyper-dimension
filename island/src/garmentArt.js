import {registerThemeArtwork,activateThemeArtwork,initialArtworkTheme} from './themeArtwork.js';
import {GARMENTS} from './equipmentRules.js';
const sheets={pixel:[],origami:[]},headSheets={pixel:new Image(),origami:new Image()};let metadata={};
for(const theme of ['pixel','origami']){for(let pack=0;pack<4;pack++)sheets[theme][pack]=registerThemeArtwork(new Image(),'/assets/garments-'+theme+'-pack-'+pack+'-v35.png',theme);registerThemeArtwork(headSheets[theme],'/assets/avatar-heads-'+theme+'-v35.png',theme);}
export const garmentArtReady=Promise.all([fetch('/assets/garment-frames-v35.json').then(r=>{if(!r.ok)throw Error('服装图集元数据缺失');return r.json()}).then(d=>metadata=d),activateThemeArtwork(initialArtworkTheme())]);
garmentArtReady.catch(()=>{});
export function garmentFrame(id,theme,heading){
 const spec=GARMENTS[id],column=[0,1,2,3,4,3,2,1][heading];if(!spec)return null;
 const img=sheets[theme]?.[spec.pack],frame=metadata['garments-'+theme+'-pack-'+spec.pack+'-v35.png']?.frames[spec.row*5+column];
 return img?.complete&&img.naturalWidth&&frame?{img,frame,flip:[1,2,3].includes(heading),spec,column,heading}:null;
}
export function hatlessHeadFrame(id,theme,heading){const row={male_3:0,female_2:1,male_5:2}[id];if(row===undefined)return null;const img=headSheets[theme],column=[0,1,2,3,4,3,2,1][heading],frame=metadata['avatar-heads-'+theme+'-v35.png']?.frames[row*5+column];return img?.complete&&img.naturalWidth&&frame?{img,frame,flip:[1,2,3].includes(heading)}:null;}
function crop(ctx,f,x,y,width,height,portion=null){
 const r=f.frame,p=portion||[0,0,1,1];ctx.drawImage(f.img,r.x+p[0]*r.w,r.y+p[1]*r.h,p[2]*r.w,p[3]*r.h,x,y,width,height);
}
// Hands use the same sleeve anchors as the garment and tool, outside the avatar's mirror.
export function garmentHands(f,heading,gait,work,action,t){
 const full=f?.spec.kind==='full',H=52,W=full?H*f.frame.w/f.frame.h:50,column=[0,1,2,3,4,3,2,1][heading],flip=[1,2,3].includes(heading);
 const points=column===2?[[.77,.40,1]]:column===1?[[.12,.39,-1],[.88,.34,1]]:column===3?[[.12,.35,-1],[.88,.39,1]]:[[.12,.39,-1],[.88,.39,1]];
 return points.map(([x,y,side])=>{const dy=side<0?(action==='celebrate'?-Math.sin(t*Math.PI)*10:work*1.2):action?-Math.sin(t*Math.PI)*5:0;return {x:((x-.5)*W+side*gait*1.2)*(flip?-1:1),y:-H+y*H+dy,side,column,angle:-side*gait*.017*(flip?-1:1)}});
}
export function drawGarmentBody(ctx,id,theme,heading,gait,work,action,t){
 const f=garmentFrame(id,theme,heading);if(!f||f.spec.kind!=='full')return false;
 const H=52,W=H*f.frame.w/f.frame.h;
 ctx.save();if(f.flip)ctx.scale(-1,1);
 const segment=(x,y,w,h,dx=0,dy=0,angle=0)=>{ctx.save();ctx.translate(dx,dy);ctx.rotate(angle);crop(ctx,f,-W/2+x*W,-H+y*H,w*W,h*H,[x,y,w,h]);ctx.restore()};
 segment(0,.81,.5,.19,gait*1.6,-Math.max(0,gait)*2.2);
 segment(.5,.81,.5,.19,-gait*1.6,-Math.max(0,-gait)*2.2);
 segment(0,.5,1,.32,0,-Math.abs(gait)*.4,Math.sin(gait)*.007);
 segment(.24,0,.52,.51,0,-Math.abs(gait)*.5);
 segment(0,.09,.25,.43,-gait*1.2,action==='celebrate'?-Math.sin(t*Math.PI)*10:work*1.2,gait*.017);
 segment(.75,.09,.25,.43,gait*1.2,action?-Math.sin(t*Math.PI)*5:0,-gait*.017);
 segment(0,0,1,.1,0,-Math.abs(gait)*.5);
 ctx.restore();return garmentHands(f,heading,gait,work,action,t);
}
export function drawGarmentLayers(ctx,ids,theme,heading,baseWidth,gait,work,action,t,now){
 for(const id of ids){
  const f=garmentFrame(id,theme,heading);if(!f||f.spec.kind==='full')continue;
  const k=f.spec.kind;ctx.save();if(f.flip)ctx.scale(-1,1);
  if(k==='gloves'){
   const body=ids.find(key=>GARMENTS[key]?.slot==='body'),hands=garmentHands(garmentFrame(body,theme,heading),heading,gait,work,action,t);if(f.flip)ctx.scale(-1,1);for(const hand of hands){ctx.save();ctx.translate(hand.x,hand.y);ctx.rotate(hand.angle);const r=f.frame,half=r.w/2,h=9,w=half/r.h*h;ctx.drawImage(f.img,r.x+(hand.side<0?0:half),r.y,half,r.h,-w/2,-h/2,w,h);ctx.restore()}
  }else{
   const height={apron:43,shawl:28,cape:42,skirt:28,hat:0,comb:18}[k],width=k==='hat'?Math.max(44,Math.min(56,baseWidth*1.06)):k==='comb'?18:height*f.frame.w/f.frame.h,h=k==='hat'?width*f.frame.h/f.frame.w:height;
   const y={apron:-49,shawl:-52,cape:-52,skirt:-31,hat:-110,comb:-85}[k],x=k==='comb'?baseWidth*.22:0;
   ctx.translate(x+(k==='comb'?gait*.6:0),y);ctx.rotate(k==='hat'?Math.sin(now*1.1)*.004:Math.sin(gait)*.015);crop(ctx,f,-width/2,0,width,h);
  }
  ctx.restore();
 }
}
export function garmentAssetStatus(){return {version:35,metadata:Object.keys(metadata).filter(k=>k.startsWith('garments-')).length,headMetadata:Object.keys(metadata).filter(k=>k.startsWith('avatar-heads-')).length,headAssets:Object.values(headSheets).every(im=>im.complete&&im.naturalWidth>0),assets:Object.entries(sheets).flatMap(([theme,images])=>images.map((im,pack)=>({theme,pack,ready:im.complete&&im.naturalWidth>0}))) }}
