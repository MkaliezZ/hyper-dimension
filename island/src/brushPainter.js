import {BRUSH_COLORS,BRUSH_SCHEMA,brushGuide,brushReview} from './brushStudio.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=v=>v*v*(3-2*v);
function line(c,points,color,width,dash=[]){if(points.length<2)return;c.beginPath();for(let i=0;i<points.length;i++){const p=points[i];i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);}
function label(c,value,x,y,size,color,align='left'){c.fillStyle=color;c.font='600 '+size+'px "Microsoft YaHei",sans-serif';c.textAlign=align;c.fillText(value,x,y);}
function round(c,x,y,w,h,r,fill){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();}
function brush(c,p,color,ink,pixel,angle=-.58){
 c.save();c.translate(p.x,p.y);c.rotate(angle);c.lineJoin=pixel?'miter':'round';
 // Tip is exactly at (0,0), unlike an atlas bounding box with an unknown tip.
 c.fillStyle='#4a493f';c.beginPath();c.moveTo(0,0);c.lineTo(-6,-20);c.lineTo(6,-20);c.closePath();c.fill();
 c.fillStyle=color;c.beginPath();c.moveTo(0,0);c.lineTo(-5,-11-ink*5);c.lineTo(5,-11-ink*5);c.closePath();c.fill();
 round(c,-5,-99,10,75,pixel?0:3,'#bc9565');round(c,-6,-28,12,11,pixel?0:2,'#8d8170');
 c.fillStyle='#ebcfa0';c.fillRect(-3,-93,2,59);c.fillStyle='#dac2a3';c.fillRect(-5,-26,10,2);
 if(!pixel){c.strokeStyle='#dfbd8b';c.lineWidth=1;c.beginPath();c.moveTo(0,-2);c.lineTo(-2,-18);c.moveTo(1,-3);c.lineTo(3,-18);c.stroke();}c.restore();
}
export function paintBrushStudio(c,s,theme,clock){
 if(s.level.schemaVersion!==BRUSH_SCHEMA)return false;
 const pixel=theme==='pixel',l=s.level,revealing=s.mode==='reveal',u=revealing?ease(clamp(s.reveal/3.2,0,1)):0;
 c.save();c.lineJoin=pixel?'miter':'round';c.lineCap=pixel?'square':'round';
 c.shadowColor='#213c3340';c.shadowBlur=pixel?0:20;c.shadowOffsetY=7;
 round(c,191,58,578,423,pixel?1:12,'#5d6450');c.shadowBlur=0;c.shadowOffsetY=0;
 round(c,197,62,568,412,pixel?0:10,'#b99a6e');round(c,211,76,540,384,pixel?0:3,'#fff1d2');
 // Subtle stationary paper grain, never a screen-wide filter.
 c.save();c.beginPath();c.rect(211,76,540,384);c.clip();
 for(let i=0;i<92;i++){const x=214+(i*71%532),y=82+(i*43%370);c.fillStyle=i%2?'#ceb58524':'#fffbea80';c.fillRect(x,y,pixel?3:12,1);}
 c.strokeStyle='#f7dbad';c.lineWidth=1;c.strokeRect(220,85,522,366);
 if(!revealing)for(let k=s.stroke;k<l.strokes.length;k++){
  const p=l.strokes[k];line(c,p.points,k===s.stroke?'#897f634f':'#968e6c20',k===s.stroke?2:1,[3,6]);
 }
 let group=[],lastStroke=-1,lastSegment=-1;
 const paint=()=>{if(group.length<2)return;const v=l.strokes[lastStroke],color=BRUSH_COLORS[v.color].color;line(c,group,color+(pixel?'b5':'29'),v.width*(pixel?1.15:1.65));line(c,group,color+'ce',v.width*.76);if(!pixel)line(c,group.map(p=>({x:p.x-1.4,y:p.y-1.1})), '#f9eec640',Math.max(1,v.width*.1));};
 for(const p of s.painted){if(p.stroke!==lastStroke||p.segment!==lastSegment){paint();group=[];lastStroke=p.stroke;lastSegment=p.segment;}group.push(p);}paint();
 for(const p of s.paperMarks){c.fillStyle=BRUSH_COLORS[p.color].color+'50';c.beginPath();c.arc(p.x,p.y,4,0,Math.PI*2);c.fill();}
 const guide=brushGuide(s);
 if(guide&&!revealing){
  c.strokeStyle=BRUSH_COLORS[l.strokes[s.stroke].color].color+'70';c.lineWidth=2;c.setLineDash([3,4]);c.beginPath();c.arc(guide.x,guide.y,l.radius,0,Math.PI*2);c.stroke();c.setLineDash([]);
  c.fillStyle=s.dryRemaining>0?'#b99562':BRUSH_COLORS[l.strokes[s.stroke].color].color;c.beginPath();c.arc(guide.x,guide.y,4+Math.sin(clock*4)*.7,0,Math.PI*2);c.fill();
  if(s.dryRemaining>0){c.save();c.globalAlpha=.18;for(let i=0;i<3;i++)line(c,[{x:455+i*25,y:338-(clock*20%50)},{x:466+i*25,y:308-(clock*20%50)}],'#a98c60',2);c.restore();}
 }
 c.restore();
 label(c,l.commission,233,105,19,'#8c7656');label(c,'风物画室 · '+(s.stroke+1>l.strokes.length?'装裱评审':(s.stroke+1)+' / '+l.strokes.length),731,447,15,'#9b8a66','right');
 // Three paint wells retain a clear one-to-one correspondence with the controls.
 for(let i=0;i<3;i++){const y=158+i*88;c.fillStyle='#d8c09a';c.beginPath();c.ellipse(818,y,28,15,0,0,Math.PI*2);c.fill();c.strokeStyle=s.color===i?'#fff1cd':'#887b62';c.lineWidth=s.color===i?3:1;c.stroke();c.fillStyle=BRUSH_COLORS[i].color;c.beginPath();c.ellipse(818,y-2,22,9,0,0,Math.PI*2);c.fill();label(c,BRUSH_COLORS[i].name,818,y+36,16,'#615c49','center');}
 if(s.phase==='playing'&&!revealing){let p=s.pointer;if(s.mode==='dipping'){const v=1-s.dipRemaining/.85,a=ease(Math.min(1,v*2)),b=ease(Math.max(0,(v-.5)*2)),origin=s.dipFrom||p,well={x:818,y:156+s.color*88};p={x:origin.x+(well.x-origin.x)*a+(origin.x-well.x)*b,y:origin.y+(well.y-origin.y)*a+(origin.y-well.y)*b};}brush(c,p,BRUSH_COLORS[s.color].color,s.ink,pixel);}
 if(revealing){
  // Physical frame corners ease into place over the actual review period.
  c.save();c.globalAlpha=u;for(const [x,y,a] of [[206,70,0],[755,70,Math.PI/2],[755,466,Math.PI],[206,466,-Math.PI/2]]){c.save();c.translate(x,y);c.rotate(a);c.translate(-16*(1-u),-16*(1-u));c.fillStyle='#bc9565';c.fillRect(0,0,50,6);c.fillRect(0,0,6,50);c.fillStyle='#ebcd93';c.fillRect(5,5,35,1);c.restore();}
  if(u>.7){const review=brushReview(s);c.globalAlpha=clamp((u-.7)/.3,0,1);round(c,355,417,251,45,pixel?0:8,'#f7e8cbdc');label(c,(review.passed?'✓ 成画达标':'继续练习')+' · '+review.quality+' 分',480,446,20,'#6b7359','center');}c.restore();
 }
 c.restore();return true;
}
