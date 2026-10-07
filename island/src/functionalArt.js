import {drawItem,drawTeaCups,teaCupMarkup,teaCupArtStatus} from './artStore.js';
import {teaEffectAnchors} from './facilityArtModel.js';
import {FACILITY_ART_FRAMES,FACILITY_VIEW_REPLACEMENTS} from './facilityArtFrames.js';
import {functionalDefinition} from './facilityCatalog.js';
import {functionalUnit} from './functionalFacilities.js';
import {plotPoint} from './farming.js';
const assets={},nurseryBack={};if(typeof Image!=='undefined')for(const theme of ['pixel','origami']){const image=new Image();image.src='/assets/'+FACILITY_ART_FRAMES[theme].file;assets[theme]=image;const back=new Image();back.src='/assets/'+FACILITY_VIEW_REPLACEMENTS[theme].file;nurseryBack[theme]=back;}
export function functionalArtStatus(){return Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,{loaded:v.complete&&v.naturalWidth>0&&nurseryBack[k]?.complete&&nurseryBack[k].naturalWidth>0,width:v.naturalWidth,height:v.naturalHeight,views:12,cup:teaCupArtStatus(k),nurseryBack:{file:FACILITY_VIEW_REPLACEMENTS[k].file,loaded:nurseryBack[k]?.complete&&nurseryBack[k].naturalWidth>0}}]));}
export function functionalSpriteMarkup(theme,item,rotation=0){const d=functionalDefinition(item),meta=FACILITY_ART_FRAMES[theme],f=meta.rows[['irrigation','nursery','tea'].indexOf(d.kind)][rotation],back=d.kind==='nursery'&&rotation===2?FACILITY_VIEW_REPLACEMENTS[theme]:null;const body=back?'<svg x="'+f.x+'" y="'+f.y+'" width="'+f.w+'" height="'+f.h+'" viewBox="'+[back.frame.x,back.frame.y,back.frame.w,back.frame.h].join(' ')+'" preserveAspectRatio="xMidYMax meet" overflow="hidden"><image href="/assets/'+back.file+'" width="'+back.width+'" height="'+back.height+'"/></svg>':'<image href="/assets/'+meta.file+'" width="'+meta.width+'" height="'+meta.height+'"/>';return '<svg viewBox="'+[f.x,f.y,f.w,f.h].join(' ')+'" aria-hidden="true" overflow="hidden">'+body+(d.kind==='tea'?teaCupMarkup(theme,rotation,0,f.x,f.y):'')+'</svg>';}
export function drawFunctionalFacility(ctx,p,theme,{s=null,now=0,ghost=false}={}){
 const d=functionalDefinition(p.item),back=d?.kind==='nursery'&&p.rotation===2?FACILITY_VIEW_REPLACEMENTS[theme]:null,image=back?nurseryBack[theme]:assets[theme];if(!d||!image?.complete||!image.naturalWidth)return false;
 const row=['irrigation','nursery','tea'].indexOf(d.kind),f=FACILITY_ART_FRAMES[theme].rows[row][p.rotation],h=d.shape.h,w=h*f.w/f.h;
 ctx.save();ctx.imageSmoothingEnabled=theme!=='pixel';ctx.globalAlpha=ghost?.7:1;if(back){const r=back.frame,scale=h/r.h,bw=r.w*scale,bh=r.h*scale;ctx.drawImage(image,r.x,r.y,r.w,r.h,p.x-bw/2,p.y-bh+3,bw,bh);}else ctx.drawImage(image,f.x,f.y,f.w,f.h,p.x-w/2,p.y-h+3,w,h);
 const u=s?functionalUnit(s,p.id):null;
 if(d.kind==='tea')drawTeaCups(ctx,theme,p.rotation,p.x-w/2,p.y-h+3,h/f.h,u?.phase==='ready'?u.servings:0);
 if(u&&d.kind==='nursery'&&['growing','ready'].includes(u.phase)){const count=u.phase==='ready'?3:u.elapsed<d.seconds/2?1:2;ctx.save();ctx.beginPath();ctx.rect(p.x-w*.28,p.y-h*.61,w*.56,h*.37);ctx.clip();for(let i=0;i<count;i++){const t=u.enabled?now:0,x=p.x+Math.sin(t*.7+i*2)*w*.16,y=p.y-h*.3-Math.cos(t*.55+i)*h*.05;drawItem(ctx,'shrimp',theme,x,y,h*.18,Math.sin(t*.7+i*2)*.14);}ctx.restore();}
 if(u?.enabled&&['growing','brewing','ready','watering'].includes(u.phase)){
  if(d.kind==='tea'){const anchors=teaEffectAnchors(theme,p.rotation),scale=h/f.h,steam={x:p.x-w/2+anchors.steam.x*scale,y:p.y-h+3+anchors.steam.y*scale};if(u.phase==='brewing'&&anchors.fire){const fire={x:p.x-w/2+anchors.fire.x*scale,y:p.y-h+3+anchors.fire.y*scale},glow=now*7;ctx.save();ctx.globalAlpha=.75;ctx.fillStyle='#ee9b46';ctx.beginPath();ctx.ellipse(fire.x,fire.y,3+Math.sin(glow)*.4,4+Math.sin(glow+1)*.6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffe6a0';ctx.beginPath();ctx.ellipse(fire.x,fire.y+1,1.5,2.5+Math.sin(glow)*.4,0,0,Math.PI*2);ctx.fill();ctx.restore();}for(let i=0;i<3;i++){const t=(now*.42+i/3)%1;ctx.globalAlpha=(1-t)*.55;ctx.strokeStyle='#fffcf1';ctx.lineWidth=theme==='pixel'?1:1.2;ctx.beginPath();ctx.moveTo(steam.x-3+i*3,steam.y-t*12);ctx.quadraticCurveTo(steam.x-4+i*3+Math.sin(t*6)*2,steam.y-5-t*12,steam.x-3+i*3,steam.y-9-t*12);ctx.stroke();}}
  if(d.kind==='nursery'){for(let i=0;i<4;i++){const t=(now*.25+i*.25)%1;ctx.globalAlpha=(1-t)*.7;ctx.strokeStyle='#d8fff5';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x-15+i*9,p.y-16-t*17,1.2,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=.7;ctx.strokeStyle='#84ded9';ctx.beginPath();ctx.ellipse(p.x,p.y-24,15+Math.sin(now*2)*1.5,2,0,0,Math.PI*2);ctx.stroke();}
  if(d.kind==='irrigation'&&u.phase==='watering'){ctx.globalAlpha=.55+.25*Math.sin(now*3);ctx.strokeStyle='#80d6d0';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y+1,w*.28,2,0,0,Math.PI*2);ctx.stroke();}
 }
 ctx.restore();return true;
}
export function drawFarmIrrigation(ctx,s,theme,plots,now){
 for(const p of s.placedItems||[]){if(p.item!=='c14_6')continue;const u=functionalUnit(s,p.id);if(!u?.enabled)continue;
  for(const index of u.targets){const q=plots[index];if(!q)continue;const a=plotPoint(q,.07,.98),b=plotPoint(q,.93,.98);ctx.save();ctx.lineWidth=theme==='pixel'?2:2.5;ctx.strokeStyle='#397e77';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   for(let k=0;k<5;k++){const base=plotPoint(q,.15+k*.175,.97);ctx.fillStyle='#c8b286';ctx.fillRect(base.x-1.5,base.y-3,3,4);}
   if(u.phase==='watering'&&u.currentPlot===index){for(let k=0;k<18;k++){const t=(now*1.2+k/18)%1,at=plotPoint(q,.12+(k%6)*.15,.93-t*.65);ctx.globalAlpha=Math.sin(t*Math.PI)*.8;ctx.fillStyle='#b0e3ef';ctx.beginPath();ctx.ellipse(at.x,at.y,1.5,2.8,0,0,Math.PI*2);ctx.fill();}}ctx.restore();
  }
 }
}
