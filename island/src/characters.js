import {registerThemeArtwork} from './themeArtwork.js';
import {createSpriteRasterCache} from './spriteRaster.js';
import {createSpriteRefiner} from './spriteRefiner.js';
const spriteRaster=createSpriteRasterCache({bitmap:createSpriteRefiner()});
import {avatarFrame} from './avatars.js';
import {GARMENTS} from './equipmentRules.js';
import {garmentFrame,drawGarmentBody,drawGarmentLayers,hatlessHeadFrame,garmentHands as sleeveHands} from './garmentArt.js';
import {drawItem,drawHeldTool} from './artStore.js';
import {DEFAULT_RECIPES} from './contentCatalog.js';
import {facingCell} from './characterFacing.js';
import {facingIndex,DIRECTION_NAMES} from './directions.js';
const visitorSheets={pixel:new Image(),origami:new Image()};let visitorFrames={};for(const t of ['pixel','origami'])registerThemeArtwork(visitorSheets[t],'/assets/visitors-'+t+'-v4.png',t);fetch('/assets/visitor-frames-v4.json').then(r=>r.json()).then(d=>visitorFrames=d);
const sheets={pixel:new Image(),origami:new Image()},backSheets={pixel:new Image(),origami:new Image()};
for(const theme of ['pixel','origami']){registerThemeArtwork(sheets[theme],'/assets/characters-'+theme+'-v2.png',theme);registerThemeArtwork(backSheets[theme],'/assets/characters-'+theme+'-back-v2.png',theme)}
const directionSheets={pixel:[],origami:[]},repairSheet=new Image(),facingRepairSheet=new Image(),frameCache=new WeakMap();let directionFrames={};fetch('/assets/character-frames-v6.json').then(r=>r.json()).then(d=>directionFrames=d);registerThemeArtwork(repairSheet,'/assets/characters-origami-8way-repair-v6.png','origami');registerThemeArtwork(facingRepairSheet,'/assets/characters-origami-facing-repair-v7.png','origami');
for(const theme of ['pixel','origami'])for(let pack=0;pack<3;pack++){const im=new Image();registerThemeArtwork(im,'/assets/characters-'+theme+'-8way-pack-'+pack+'-v6.png',theme);directionSheets[theme].push(im)}
function framesFor(img,columns,rows){const metadata=directionFrames[img.src.split('/').at(-1)];if(metadata)return metadata;if(!img.complete||!img.naturalWidth)return null;if(frameCache.has(img))return frameCache.get(img);const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);const pixels=g.getImageData(0,0,c.width,c.height).data,out=[];for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const left=Math.round(col*c.width/columns),right=Math.round((col+1)*c.width/columns),top=Math.round(row*c.height/rows),bottom=Math.round((row+1)*c.height/rows);let x0=right,y0=bottom,x1=-1,y1=-1;for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(pixels[(y*c.width+x)*4+3]>100){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}out.push(x1>=0?{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1}:{x:left,y:top,w:right-left,h:bottom-top})}frameCache.set(img,out);return out}
export function characterFrame(id,theme,visitor,heading){
 const selected=facingCell(theme,id,visitor,heading);let img,frame;
 if(selected.repair==='v7'){
  img=facingRepairSheet;frame=framesFor(img,5,2)?.[selected.row*5+selected.column];
 }else if(!visitor&&!(theme==='origami'&&id>=14)&&(heading===0||heading===4)){
  img=heading===4?backSheets[theme]:sheets[theme];frame=framesFor(img,4,4)?.[id];
 }else{
  const pack=visitor?2:Math.floor(id/8),row=id%8;
  img=theme==='origami'&&!visitor&&id>=14?repairSheet:directionSheets[theme][pack];
  frame=framesFor(img,8,img===repairSheet?2:8)?.[(img===repairSheet?id-14:row)*8+selected.column];
 }
 if(!frame){img=visitor?visitorSheets[theme]:sheets[theme];frame=visitor?visitorFrames[theme]?.[id%8]:framesFor(img,4,4)?.[id]}
 return {img,frame,flip:selected.flip,heading,name:DIRECTION_NAMES[heading],cell:selected};
}
export const characterRasterStatus=()=>spriteRaster.inspect();
export function characterAssetStatus(){return Object.fromEntries(['pixel','origami'].map(theme=>[theme,directionSheets[theme].map(im=>({ready:im.complete&&im.naturalWidth>0,width:im.naturalWidth,height:im.naturalHeight}))]))}
export function portraitStyle(id,theme){return 'background-image:url(/assets/characters-'+theme+'-v2.png);background-size:400% 400%;background-position:'+((id%4)*100/3)+'% '+(Math.floor(id/4)*100/3)+'%'}
export function drawAnimatedCharacter(ctx,a,theme,color,isNpc,now,mult){
 const oldHeading=a.facing8,heading=facingIndex(a);if(oldHeading!=null&&oldHeading!==heading){const turn=Math.min((heading-oldHeading+8)%8,(oldHeading-heading+8)%8);a.previousHeading=turn===1?oldHeading:null;a.facingChangedAt=now}const blend=Math.min(1,Math.max(0,(now-(a.facingChangedAt??-1))/.08)),rear=[3,4,5].includes(heading),id=isNpc?a.npcId??0:0,{img,frame:directionFrame,flip}=(avatarFrame(a.appearance,theme,heading)||characterFrame(id,theme,!!a.isVisitor,heading));
 const walk=a.walkMix??(a.walking?1:0),gait=Math.sin(a.phase||0)*walk,act=a.action,t=act?(isNpc&&act.duration>3&&['craft','pickaxe','axe','hoe','water','harvest','cook','brew','paint','arrange'].includes(act.type)?((act.t+(act.visualWait||0))%1.4)/1.4:Math.min(1,(act.t+(act.visualWait||0))/act.duration)):0;
 const action=act?.type,room=act?.roomId,work=act?Math.sin(t*Math.PI*2):0;
 ctx.save();ctx.translate(a.x,a.y);ctx.scale(mult,mult);ctx.imageSmoothingEnabled=theme!=='pixel';
 ctx.fillStyle=isNpc?'#19372740':'#eecb6566';ctx.beginPath();ctx.ellipse(0,1,18,6,0,0,Math.PI*2);ctx.fill();
 const speaking=action==='talk'&&!!a.speech,talking=action==='talk';const gesture=talking?Math.sin(now*(speaking?4.2:1.6)+id):0;const bob=Math.abs(gait)*1.5+Math.sin(now*1.8+id)*.45+(speaking?gesture*.7:0);
 ctx.translate(0,-bob);if(act?.couturePose==='bow'){const bend=Math.sin(t*Math.PI);ctx.translate(0,-35);ctx.rotate(.16*bend);ctx.translate(0,35+5*bend);} // Rotate via actual eight-direction drawings, never compress the silhouette.
 function drawPose(img,directionFrame,opacity,flipped=false,poseHeading=heading){if(img.complete&&img.naturalWidth){ctx.save();ctx.globalAlpha*=opacity;
 const prepared=theme==='origami'?spriteRaster.prepare(ctx,img,directionFrame):null;if(prepared){img=prepared.image;directionFrame=prepared.frame;}
 const vf=directionFrame,cw=vf?.w||img.naturalWidth/4,ch=vf?.h||img.naturalHeight/4,sx=vf?.x||0,sy=vf?.y||0,W=96*(vf?.aspectRatio??cw/ch),H=96;
 const body=(a.garments||[]).find(key=>GARMENTS[key]?.slot==='body');
 const dressed=!!garmentFrame(body,theme,poseHeading);
 const garmentHands=dressed?drawGarmentBody(ctx,body,theme,poseHeading,gait,work,action,t):null;
 ctx.save();if(flipped)ctx.scale(-1,1);
 const segment=(x,y,w,h,dx=0,dy=0,angle=0)=>{ctx.save();ctx.translate(dx,dy);ctx.rotate(angle);ctx.drawImage(img,sx+x*cw,sy+y*ch,w*cw,h*ch,-W/2+x*W,-H+y*H,w*W,h*H);ctx.restore()};
 if(!dressed){
  segment(0,.79,.5,.21,gait*1.6,-Math.max(0,gait)*2.2);
  segment(.5,.79,.5,.21,-gait*1.6,-Math.max(0,-gait)*2.2);
  segment(.24,.52,.52,.29,0,-Math.abs(gait)*.5);
  segment(0,.52,.27,.29,-gait*1.2,action==='celebrate'?-Math.sin(t*Math.PI)*13:work*1.2,gait*.017);
  segment(.73,.52,.27,.29,gait*1.2,talking?(speaking?-4+gesture*3:gesture*.5):act?-Math.sin(t*Math.PI)*7:0,-gait*.017);
 }
 const head=(a.garments||[]).some(key=>GARMENTS[key]?.slot==='head')?hatlessHeadFrame(a.appearance,theme,poseHeading):null;
 if(head){const hh=46,hw=hh*head.frame.w/head.frame.h,r=head.frame;ctx.save();if(flipped)ctx.scale(-1,1);if(head.flip)ctx.scale(-1,1);ctx.drawImage(head.img,r.x,r.y,r.w,r.h,-hw/2,-94,hw,hh);ctx.restore();}else{
 if(dressed){ctx.save();ctx.beginPath();ctx.moveTo(-W/2,-H);ctx.lineTo(W/2,-H);ctx.lineTo(W/2,-H*.52);ctx.lineTo(W*.13,-H*.52);ctx.lineTo(W*.13,-H*.50);ctx.lineTo(-W*.13,-H*.50);ctx.lineTo(-W*.13,-H*.52);ctx.lineTo(-W/2,-H*.52);ctx.closePath();ctx.clip();}
 segment(0,0,1,dressed ? .56 : .54,gait*.6,-Math.abs(gait)*.6,Math.sin(now*1.1+id)*.004+gesture*(speaking?.012:.005));
 if(dressed)ctx.restore();}ctx.restore();
 if(garmentHands)for(const hand of garmentHands){
  const region=hand.column===2?[.45,.63,.43,.2]:hand.side<0?[.04,.65,.24,.19]:[.73,.65,.24,.19];
  ctx.save();ctx.translate(hand.x,hand.y);ctx.rotate(hand.angle);ctx.beginPath();ctx.ellipse(0,0,3.7,4.2,0,0,Math.PI*2);ctx.clip();
  ctx.drawImage(img,sx+region[0]*cw,sy+region[1]*ch,region[2]*cw,region[3]*ch,-4,-4.5,8,9);ctx.restore();
 }
 drawGarmentLayers(ctx,a.garments||[],theme,poseHeading,W,gait,work,action,t,now);
 ctx.restore();}else{ctx.fillStyle=color;ctx.fillRect(-14,-55,28,36);ctx.fillStyle='#e8bf9a';ctx.fillRect(-12,-76,24,22)}}
 if(blend<1&&a.previousHeading!=null){const previous=avatarFrame(a.appearance,theme,a.previousHeading)||characterFrame(id,theme,!!a.isVisitor,a.previousHeading);drawPose(previous.img,previous.frame,1-blend,previous.flip,a.previousHeading)}drawPose(img,directionFrame,a.previousHeading==null?1:blend,flip);
 if(act){
 ctx.save();const left=[1,2,3].includes(heading),body=(a.garments||[]).find(key=>GARMENTS[key]?.slot==='body'),hands=sleeveHands(garmentFrame(body,theme,heading),heading,gait,work,action,t),hand=hands.find(p=>left?p.x<=0:p.x>=0)||hands[0];ctx.translate(hand.x,hand.y);ctx.scale(left?-1:1,1);
 const tools={hoe:'hoe',pickaxe:'pickaxe',axe:'axe',water:'watering_can',harvest:'sickle',sow:'seed',fish:'rod'},prop=act.guestWork?null:act.equipment?.tool?.id||act.toolId||a.toolbelt?.[action]||tools[action]||act.output||(['rest','talk'].includes(action)?null:DEFAULT_RECIPES[room]?.item);
 if(prop){
 const angle=['hoe','pickaxe','axe','harvest'].includes(action)?-1.9+Math.sin(t*Math.PI)*2.05:action==='water'?.2+Math.sin(t*Math.PI)*.3:action==='fish'?-.75:Math.sin(t*Math.PI)*.12;
 const size=action==='fish'?64:action==='pickaxe'||action==='hoe'?54:39,held=drawHeldTool(ctx,prop,theme,0,0,size,angle);
 if(!held)drawItem(ctx,prop,theme,4,-5,size,angle);
 // The palm is in front of the handle, using this avatar or its actual glove artwork.
 if(held){
  const glove=(a.garments||[]).find(key=>GARMENTS[key]?.slot==='hands'),f=garmentFrame(glove,theme,heading);
  ctx.save();ctx.beginPath();ctx.ellipse(0,0,3.4,3.8,0,0,Math.PI*2);ctx.clip();
  if(f){const r=f.frame,half=r.w/2;ctx.drawImage(f.img,r.x+(hand.side<0?0:half),r.y+r.h*.35,half,r.h*.5,-4,-4,8,8);}
  else if(directionFrame&&img.complete){const r=directionFrame,region=hand.column===2?[.45,.63,.43,.2]:hand.side<0?[.04,.65,.24,.19]:[.73,.65,.24,.19];ctx.drawImage(img,r.x+region[0]*r.w,r.y+region[1]*r.h,region[2]*r.w,region[3]*r.h,-4,-4,8,8);}
  ctx.restore();
 }
 if(action==='water'&&t>.35&&t<.8){const tip=held?.tip||{x:17,y:8};ctx.fillStyle='#a4e3ef';for(let i=0;i<5;i++)ctx.fillRect(tip.x+i*2,tip.y+3+i*5,2,4);}
 if(action==='sow'&&t>.35&&t<.75){ctx.fillStyle='#c8ab63';for(let i=0;i<5;i++)ctx.fillRect(11+i*3,7+i*4,2,2);}
 if(action==='fish'){const tip=held?.tip||{x:20,y:-24};ctx.strokeStyle='#dce7dc';ctx.beginPath();ctx.moveTo(tip.x,tip.y);ctx.quadraticCurveTo(tip.x+16,tip.y+20,44,24);ctx.stroke();}
 }
 else if(action==='fish'){ctx.strokeStyle='#ac8355';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-4,16);ctx.lineTo(12,-36);ctx.stroke();ctx.strokeStyle='#c8e0d6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(12,-36);ctx.quadraticCurveTo(38,-14,40,22+Math.sin(now*2)*2);ctx.stroke();ctx.fillStyle='#d79177';ctx.fillRect(38,20,4,7)}else if(action==='eat'){ctx.fillStyle='#d0d8be';ctx.beginPath();ctx.ellipse(0,6,13,5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e2ad77';ctx.fillRect(-7,0,13,6);ctx.strokeStyle='#b7c6c2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(13,4);ctx.lineTo(17,-8-work*4);ctx.stroke()}else if(room===4){ // needle, thread and cloth for the couture bench
 ctx.fillStyle='#c397bc';ctx.fillRect(-8,0,22,14);ctx.strokeStyle='#eedde5';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-5,2);ctx.quadraticCurveTo(10,-12,18+work*3,-6);ctx.stroke();ctx.fillStyle='#ced6db';ctx.fillRect(14+work*3,-14,2,11);
 }else if(room===15){ // clay is shaped while hands close around the pot
 ctx.fillStyle='#b78867';ctx.beginPath();ctx.ellipse(3,4,7+Math.sin(t*Math.PI)*2,11,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#714e39';ctx.beginPath();ctx.ellipse(3,-6,6,2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e8bf9a';ctx.fillRect(-8+work,0,4,8);ctx.fillRect(11-work,0,4,8);
 }else if(room===16){ctx.strokeStyle='#957149';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-4,15);ctx.lineTo(7,-29);ctx.stroke();ctx.strokeStyle='#dbe3df';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(7,-29);ctx.quadraticCurveTo(23,-10,18,14);ctx.stroke();ctx.fillStyle='#c79769';ctx.fillRect(-8,6,11,5);
 }else if(room===20){ctx.fillStyle='#c98888';ctx.fillRect(-5,-10,11,25);ctx.fillStyle='#edbd73';ctx.beginPath();ctx.moveTo(-7,-10);ctx.lineTo(1,-20);ctx.lineTo(8,-10);ctx.fill();ctx.strokeStyle='#725446';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(1,15);ctx.quadraticCurveTo(12,16,10,22);ctx.stroke();
 }else if(action==='paint'){ctx.fillStyle='#d1ad73';ctx.beginPath();ctx.ellipse(0,6,12,8,0,0,Math.PI*2);ctx.fill();for(let i=0;i<3;i++){ctx.fillStyle=['#a6bec8','#c88a92','#a3b583'][i];ctx.fillRect(-7+i*6,3,4,4)}ctx.rotate(work*.22);ctx.fillStyle='#80654a';ctx.fillRect(13,-22,3,25);ctx.fillStyle='#c89994';ctx.fillRect(12,-27,5,7);
 }else if(action==='arrange'){ctx.fillStyle=room===3?'#91ac7b':'#e4d1ab';ctx.fillRect(-7,0,20,13);ctx.fillStyle=room===3?'#e5a1bd':'#ac9170';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(-3+i*6,-3-Math.abs(work)*3,4,0,Math.PI*2);ctx.fill()}
 }else if(action==='cook'){ctx.fillStyle='#716d68';ctx.beginPath();ctx.ellipse(1,4,13,5,0,0,Math.PI*2);ctx.fill();ctx.fillRect(11,2,15,3);ctx.fillStyle=room===17?'#d7ac72':'#d8967e';ctx.beginPath();ctx.ellipse(1,2-work*3,8,3,0,0,Math.PI*2);ctx.fill();
 }else if(action==='brew'){ctx.fillStyle=room===10?'#93b897':'#bbcfbe';ctx.beginPath();ctx.ellipse(2,3,11,8,0,0,Math.PI*2);ctx.fill();ctx.fillRect(-3,-7,10,3);ctx.fillRect(11,0,7,4);ctx.strokeStyle='#759184';ctx.lineWidth=2;ctx.strokeRect(-13,-2,6,8);if(t>.38&&t<.75){ctx.fillStyle='#cde5ce';for(let i=0;i<3;i++)ctx.fillRect(18+i*2,5+i*4,2,3)}
 }else if(action==='water'){ctx.fillStyle='#89bbc5';ctx.fillRect(-5,-2,17,11);ctx.strokeStyle='#527881';ctx.lineWidth=3;ctx.strokeRect(-3,-8,12,8);if(t>.38&&t<.75){ctx.fillStyle='#a4e3ef';for(let i=0;i<4;i++)ctx.fillRect(13+i*3,7+i*5,2,4)}}
 else if(['craft','pickaxe','axe','hoe','build','harvest','arrange','paint'].includes(action)){
 const angle=t<.52?-1.2+t/.52*2.4:1.2-(t-.52)/.48*1.5;ctx.rotate(angle);
 ctx.fillStyle='#94714a';ctx.fillRect(-2,-27,4,30);ctx.fillStyle=action==='paint'?'#cc857c':'#9eb8bd';ctx.fillRect(-11,-29,22,6);
 }else if(action==='observe'){ctx.fillStyle='#e4ca82';ctx.beginPath();ctx.arc(1,-8,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#97ccdc';ctx.beginPath();ctx.arc(1,-8,6,0,Math.PI*2);ctx.fill()}
 else if(action==='perform'){ctx.fillStyle='#ffe4a5';ctx.font='18px serif';ctx.fillText('♪',Math.sin(now*3)*8,-15)}
 ctx.restore();
 }
 ctx.restore();
}
