// Versioned, data-only drawing rules shared by the browser and authority replay.
export const BRUSH_COLORS=[{name:'海蓝',color:'#4e817a'},{name:'叶绿',color:'#7d995f'},{name:'花粉',color:'#b78490'}];
export const BRUSH_SCHEMA=139;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function bezier(a,b,c,d,n=100){return Array.from({length:n+1},(_,i)=>{const u=i/n,v=1-u;return {x:v*v*v*a[0]+3*v*v*u*b[0]+3*v*u*u*c[0]+u*u*u*d[0],y:v*v*v*a[1]+3*v*v*u*b[1]+3*v*u*u*c[1]+u*u*u*d[1]};});}
function oval(x,y,rx,ry,start=0,end=Math.PI*2){return Array.from({length:121},(_,i)=>{const a=start+(end-start)*i/120;return {x:x+Math.cos(a)*rx,y:y+Math.sin(a)*ry};});}
function poly(points){return points.map(([x,y])=>({x,y}));}
function sample(points){const out=[{...points[0],arc:0}];let arc=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(dist(a,b)/4));for(let j=1;j<=n;j++){const p={x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n};arc+=dist(out.at(-1),p);out.push({...p,arc});}}return out;}
const curve=(...p)=>bezier(...p);
const stroke=(name,color,points,width=10,wash=false)=>({name,color,points,width,wash});
function motif(index){
 if(index===0)return {name:'潮汐归帆',caption:'一面小帆，把海风带回家。',strokes:[
  stroke('远海的长波',0,curve([244,335],[375,310],[565,365],[714,320]),16,true),
  stroke('海风中的帆',2,poly([[442,287],[500,153],[555,287],[442,287]]),12),
  stroke('木船与桅杆',1,poly([[500,150],[500,310],[429,303],[457,327],[550,327],[575,303],[500,310]]),9),
  stroke('落日的轮廓',2,oval(643,189,34,34),12),
  stroke('近海涟漪',0,curve([257,389],[396,359],[551,418],[707,377]),13),
  stroke('帆面的折线',2,poly([[499,167],[470,280],[545,280]]),6),
  stroke('第一缕海风',1,curve([270,210],[304,168],[354,212],[398,178]),7),
  stroke('第二缕海风',1,curve([268,241],[314,210],[342,250],[383,218]),6),
  stroke('落日倒影',2,curve([605,356],[622,345],[657,350],[680,341]),8)]};
 if(index===1)return {name:'风铃花枝',caption:'先画枝叶，再让一朵花缓缓开放。',strokes:[
  stroke('摇曳的花枝',1,curve([433,410],[514,340],[464,250],[524,175]),14,true),
  stroke('向左舒展的叶',1,curve([484,297],[420,204],[318,232],[484,297]),11),
  stroke('向右舒展的叶',0,curve([484,331],[601,237],[630,346],[484,331]),11),
  stroke('花瓣的轮廓',2,oval(530,185,65,43),17),
  stroke('花心',2,oval(531,187,19,16),9),
  stroke('左叶脉',0,curve([469,287],[431,266],[397,251],[362,249]),5),
  stroke('右叶脉',1,curve([500,325],[533,302],[568,301],[592,309]),5),
  stroke('垂落的小花',2,oval(416,345,29,20),10),
  stroke('庭院的微风',0,curve([279,399],[332,359],[350,409],[391,382]),6)]};
 if(index===2)return {name:'珍珠拾光',caption:'一枚贝壳，收藏潮间带的光。',strokes:[
  stroke('贝壳外缘',2,oval(487,302,156,115,Math.PI,Math.PI*2),15,true),
  stroke('贝壳底缘',0,curve([331,302],[377,418],[590,418],[643,302]),12),
  stroke('中间的贝脊',2,curve([487,193],[487,251],[494,301],[487,352]),9),
  stroke('拾得的珍珠',1,oval(486,352,29,24),11),
  stroke('海滩的潮线',0,curve([251,421],[395,395],[568,440],[714,405]),14),
  stroke('左侧贝脊',2,curve([377,223],[398,284],[418,312],[459,345]),7),
  stroke('右侧贝脊',2,curve([597,223],[573,284],[551,319],[515,345]),7),
  stroke('左侧海草',1,curve([272,356],[227,310],[301,293],[267,251]),8),
  stroke('右侧海草',1,curve([700,371],[744,325],[678,299],[715,258]),8)]};
 return {name:'星灯晚风',caption:'灯笼照亮夜色，也照亮回家的路。',strokes:[
  stroke('湾中的长波',0,curve([250,395],[402,352],[545,431],[714,387]),16,true),
  stroke('星灯的轮廓',2,oval(487,278,86,112),16),
  stroke('灯笼的横纹',1,curve([407,243],[451,219],[524,219],[567,243]),8),
  stroke('灯绳与流苏',1,poly([[486,125],[486,165],[486,390],[486,428]]),7),
  stroke('第一颗星',2,poly([[646,170],[654,190],[674,194],[655,205],[652,226],[638,207],[618,202],[638,190],[646,170]]),9),
  stroke('第二道灯纹',1,curve([405,305],[451,330],[524,330],[570,305]),7),
  stroke('灯火的微光',2,oval(487,276,32,39),9),
  stroke('海风',0,curve([268,192],[294,151],[351,218],[373,178]),7),
  stroke('小星点',2,poly([[317,289],[322,302],[335,305],[320,312],[316,326],[311,313],[298,307],[312,301],[317,289]]),6)]};
}
export function makeBrushLevel(random,difficulty){
 const d=clamp(Math.round(difficulty)||1,1,3),m=motif(Math.floor(random()*4)),dx=(random()-.5)*16,dy=(random()-.5)*10,tilt=(random()-.5)*.07;
 const strokes=m.strokes.slice(0,[5,7,9][d-1]).map(v=>{const pts=v.points.map(p=>({x:480+(p.x-480)*Math.cos(tilt)-(p.y-280)*Math.sin(tilt)+dx,y:280+(p.x-480)*Math.sin(tilt)+(p.y-280)*Math.cos(tilt)+dy}));const points=sample(pts);return {...v,points,length:points.at(-1).arc,dryTime:v.wash?[1.1,1.6,2][d-1]:.45};});
 return {schemaVersion:BRUSH_SCHEMA,commission:m.name,caption:m.caption,strokes,radius:[19,15,12][d-1],maxSpeed:[230,205,185][d-1],inkPerPixel:[.00145,.00165,.00185][d-1],minQuality:[65,73,80][d-1],time:[180,240,300][d-1]};
}
export function initBrush(){return {mode:'drawing',stroke:0,node:0,arc:0,color:0,ink:1,painted:[],paperMarks:[],strokeReports:[],brushLast:null,brushAnchored:false,brushTimeCredit:0,offPath:0,strokeError:0,strokeSamples:0,strokeAccuracy:0,dryRemaining:0,dipRemaining:0,reveal:0,brushRevision:0,brushSegment:0,dipFrom:null,lastBrushWarning:-5};}
export function neutralBrush(s){s.holding=false;s.brushLast=null;s.brushAnchored=false;s.brushTimeCredit=0;}
function warn(s,text,emit,penalty=1){s.status=text;s.strokeError+=penalty;s.brushRevision++;if(s.t-s.lastBrushWarning>.65){s.lastBrushWarning=s.t;emit(s,'brush-warning',s.pointer.x,s.pointer.y);}}
function guideAt(stroke,arc){const pts=stroke.points;let i=1;while(i<pts.length-1&&pts[i].arc<arc)i++;const a=pts[i-1],b=pts[i],u=clamp((arc-a.arc)/Math.max(.001,b.arc-a.arc),0,1);return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,index:i};}
export function brushGuide(s){const stroke=s.level.strokes[s.stroke];return stroke?guideAt(stroke,s.arc||0):null;}
function project(stroke,p,arc,maxForward){let best;for(let i=1;i<stroke.points.length;i++){const a=stroke.points[i-1],b=stroke.points[i];if(b.arc<arc-12||a.arc>arc+maxForward)continue;const dx=b.x-a.x,dy=b.y-a.y,u=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(.001,dx*dx+dy*dy),0,1),q={x:a.x+u*dx,y:a.y+u*dy,arc:a.arc+u*(b.arc-a.arc),index:i},distance=dist(p,q);if(!best||distance<best.distance)best={...q,distance};}return best;}
export function brushAction(s,a,emit){
 if(s.level.schemaVersion!==BRUSH_SCHEMA)return false;
 if(a.type==='point'||a.type==='down'){
  if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||Math.abs(a.x)>10000||Math.abs(a.y)>10000)return true;
  s.pointer={x:a.x,y:a.y};
  if(a.type==='down'){
   if(s.mode!=='drawing'||s.dryRemaining>0)return true;
   s.holding=true;s.brushSegment++;const guide=brushGuide(s);s.brushLast={...s.pointer};s.brushAnchored=!!guide&&dist(guide,s.pointer)<=s.level.radius;
   if(!s.brushAnchored)warn(s,'从发亮的笔触起点落笔，断笔后从这里续画。',emit,.5);
   else if(s.color!==s.level.strokes[s.stroke].color)warn(s,'这道笔触需要指定颜色；换色后从光点续画。',emit,1);
  }return true;
 }
 if(a.type==='up'){neutralBrush(s);return true;}
 if(a.type==='color'){if(Number.isInteger(a.index)&&BRUSH_COLORS[a.index]){s.color=a.index;neutralBrush(s);s.brushRevision++;}return true;}
 if(a.type==='dip'){
  if(s.mode!=='drawing')return true;s.dipFrom={...s.pointer};neutralBrush(s);s.mode='dipping';s.dipRemaining=.85;s.status='正在润笔蘸墨…';emit(s,'dip',822,420);s.brushRevision++;return true;
 }
 if(a.type==='reworkStroke'){
  if(s.mode!=='drawing'||s.stroke>=s.level.strokes.length)return true;neutralBrush(s);s.painted=s.painted.filter(p=>p.stroke!==s.stroke);s.paperMarks=s.paperMarks.filter(p=>p.stroke!==s.stroke);s.arc=0;s.node=0;s.strokeError=0;s.strokeSamples=0;s.strokeAccuracy=0;s.score=s.strokeReports.reduce((n,v)=>n+v.quality*10,0);s.status='这一笔已擦回草稿，可以重新运笔；已完成部分保留。';s.brushRevision++;emit(s,'brush-rework',480,280);return true;
 }
 return false;
}
export function brushReview(s){const quality=s.strokeReports.length?Math.round(s.strokeReports.reduce((n,v)=>n+v.quality,0)/s.strokeReports.length):0;return {quality,passed:s.strokeReports.length===s.level.strokes.length&&quality>=s.level.minQuality,required:s.level.minQuality};}
export function stepBrush(s,dt,emit){
 if(s.mode==='dipping'){s.dipRemaining=Math.max(0,s.dipRemaining-dt);if(!s.dipRemaining){s.ink=1;s.mode='drawing';s.status='笔尖已经润好，从发亮笔触继续。';s.brushRevision++;}return null;}
 if(s.mode==='reveal'){s.reveal+=dt;if(s.reveal>=3.2)return brushReview(s);return null;}
 if(s.dryRemaining>0){s.dryRemaining=Math.max(0,s.dryRemaining-dt);if(!s.dryRemaining){s.status='色层已干，可以绘制下一道笔触。';s.brushRevision++;}neutralBrush(s);return null;}
 const stroke=s.level.strokes[s.stroke];if(!stroke||!s.holding||!s.brushAnchored||dt<=0)return null;
 s.brushTimeCredit=Math.min(12,s.brushTimeCredit+s.level.maxSpeed*dt);
 const from=s.brushLast||s.pointer,to=s.pointer,travel=dist(from,to);s.brushLast={...to};
 if(s.color!==stroke.color){if(travel>1){s.paperMarks.push({...to,color:s.color,stroke:s.stroke});if(s.paperMarks.length>180)s.paperMarks.shift();warn(s,'颜色不符合委托，可以换色或重绘这一笔。',emit,.7);}return null;}
 if(s.ink<=.008){neutralBrush(s);s.status='笔尖缺墨，蘸墨后从当前光点续画。';s.brushRevision++;return null;}
 if(travel<.06)return null; // Holding a stationary pointer cannot fill a guide.
 const allowance=s.brushTimeCredit;
 if(travel>allowance){s.brushAnchored=false;warn(s,'运笔太快或出现跳笔，回到光点重新落笔。',emit,2);return null;}
 const q=project(stroke,to,s.arc,allowance+s.level.radius*.55),mid={x:(from.x+to.x)/2,y:(from.y+to.y)/2},midQ=project(stroke,mid,s.arc,allowance+s.level.radius*.55);
 if(!q||!midQ||q.distance>s.level.radius||midQ.distance>s.level.radius){s.offPath+=dt;warn(s,'笔尖离开轮廓，回到光点继续或重绘这一笔。',emit,.4);if(!q||q.distance>s.level.radius*2)s.brushAnchored=false;return null;}
 const advance=q.arc-s.arc;if(advance<.12)return null;
 if(advance>allowance){s.brushAnchored=false;warn(s,'没有连续画过这一段，从当前光点续画。',emit,1.5);return null;}
 const inkNeeded=advance*s.level.inkPerPixel;if(inkNeeded>s.ink){neutralBrush(s);s.status='笔尖缺墨，蘸墨后续画。';s.brushRevision++;return null;}
 s.ink=Math.max(0,s.ink-inkNeeded);s.strokeSamples++;s.strokeAccuracy+=clamp(1-q.distance/s.level.radius,0,1);s.arc=q.arc;s.node=q.index;s.brushTimeCredit=Math.max(0,s.brushTimeCredit-advance);
 s.painted.push({x:to.x,y:to.y,color:s.color,stroke:s.stroke,segment:s.brushSegment,at:s.t,width:stroke.width*clamp(1.28-travel/Math.max(.01,dt)/400,.6,1.2)});s.score+=advance*.7;
 if(s.strokeSamples%3===0)emit(s,'ink',to.x,to.y,{color:BRUSH_COLORS[s.color].color});
 if(stroke.length-s.arc<=3.5&&dist(to,stroke.points.at(-1))<=s.level.radius){
  const accuracy=s.strokeAccuracy/Math.max(1,s.strokeSamples),quality=clamp(Math.round(79+accuracy*21-s.strokeError),0,100);
  s.strokeReports.push({name:stroke.name,quality,accuracy,samples:s.strokeSamples,errors:s.strokeError});emit(s,'brush-complete',to.x,to.y,{color:BRUSH_COLORS[s.color].color});
  s.stroke++;s.arc=0;s.node=0;s.strokeError=0;s.strokeSamples=0;s.strokeAccuracy=0;s.score=s.strokeReports.reduce((n,v)=>n+v.quality*10,0);neutralBrush(s);s.brushRevision++;
  if(s.stroke===s.level.strokes.length){s.mode='reveal';s.status='画作完成 · 正在装裱与评审…';}
  else{s.dryRemaining=stroke.dryTime;s.status='这一笔完成 · 等色层晾干，再换到下一笔的颜色。';}
 }
 return null;
}
