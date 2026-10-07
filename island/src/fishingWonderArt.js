import {WONDER_DEFINITIONS,wonderAsset} from './eventWonders.js';
const cache={};
function draw(ctx,id,state,theme,x,y,h,now){
 const a=state.eventWonders?.owned?.[id];if(!a)return;
 const color=WONDER_DEFINITIONS[id].colors.find(c=>c.index===a.color)?.id||'sea',src=wonderAsset(id,theme,color);
 if(!cache[src]){const image=new Image();image.src=src;cache[src]=image;}
 const im=cache[src];if(!im.complete||!im.naturalWidth)return;
 const w=h*im.naturalWidth/im.naturalHeight;
 ctx.save();ctx.imageSmoothingEnabled=theme!=='pixel';ctx.fillStyle='#4d513b35';ctx.beginPath();ctx.ellipse(x,y,w*.40,8,0,0,Math.PI*2);ctx.fill();ctx.drawImage(im,x-w/2,y-h,w,h);
 for(let i=0;i<(id==='cooperation_monument'?3:1);i++){
  const glint=(Math.sin(now*1.3+i*2.1)+1)/2,xx=x+w*(.28-i*.20),yy=y-h*(.76+i*.04),r=2+glint*2;
  ctx.strokeStyle='rgba(255,242,176,'+(.25+glint*.55)+')';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(xx-r,yy);ctx.lineTo(xx+r,yy);ctx.moveTo(xx,yy-r);ctx.lineTo(xx,yy+r);ctx.stroke();
 }ctx.restore();
}
export function wonderPlacements(state,slots){
 const w=state.eventWonders;if(!w)return [];
 const places=[];if((w.displays?.seashell_cup||w.displayed==='seashell_cup')&&w.owned.seashell_cup&&slots[18])places.push({id:'seashell_cup',x:slots[18].entry.x+56,y:slots[18].entry.y+4,h:62,rx:27,ry:13});
 if(w.displays?.cooperation_monument&&w.owned.cooperation_monument)places.push({id:'cooperation_monument',x:854,y:505,h:82,rx:29,ry:16});if(w.displays?.market_lantern&&w.owned.market_lantern&&slots[9])places.push({id:'market_lantern',x:slots[9].entry.x+62,y:slots[9].entry.y+8,h:82,rx:29,ry:16});if(w.displays?.couture_ribbon&&w.owned.couture_ribbon&&slots[4])places.push({id:'couture_ribbon',x:slots[4].entry.x+56,y:slots[4].entry.y+4,h:72,rx:27,ry:13});if(w.displays?.fireworks_orbit&&w.owned.fireworks_orbit&&slots[20])places.push({id:'fireworks_orbit',x:slots[20].entry.x+56,y:slots[20].entry.y+4,h:70,rx:27,ry:13});if(w.displays?.island_pinwheel&&w.owned.island_pinwheel&&slots[12])places.push({id:'island_pinwheel',x:slots[12].entry.x-56,y:slots[12].entry.y+4,h:68,rx:22,ry:12});if(w.displays?.starlit_diorama&&w.owned.starlit_diorama&&slots[5])places.push({id:'starlit_diorama',x:slots[5].entry.x+56,y:slots[5].entry.y+4,h:72,rx:26,ry:14});if(w.displays?.muse_wardrobe&&w.owned.muse_wardrobe&&slots[4])places.push({id:'muse_wardrobe',x:slots[4].entry.x-56,y:slots[4].entry.y+4,h:84,rx:22,ry:12});if(w.displays?.cooperation_tree&&w.owned.cooperation_tree&&slots[18])places.push({id:'cooperation_tree',x:slots[18].entry.x-56,y:slots[18].entry.y+4,h:88,rx:25,ry:14});if(w.displays?.archipelago_lighthouse&&w.owned.archipelago_lighthouse&&slots[8])places.push({id:'archipelago_lighthouse',x:slots[8].entry.x-56,y:slots[8].entry.y+4,h:92,rx:25,ry:14});return places;
}
export function drawFishingWonder(ctx,state,theme,slots,now,only=null){
 const w=state.eventWonders;if(!w)return;
 for(const p of wonderPlacements(state,slots))if(!only||p.id===only)draw(ctx,p.id,state,theme,p.x,p.y,p.h,now);
}
