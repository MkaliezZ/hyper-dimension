const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export const POTTERY_COLORS=[
 {name:'海青釉',color:'#559b98',light:'#b2ddd0'},
 {name:'杏白釉',color:'#e4caa2',light:'#fff1d6'},
 {name:'蔷薇釉',color:'#bd7d90',light:'#ecc2d1'}
];
const forms=[
 ['海风直筒杯',[90,88,87,86,87,88,89,90,90,89,88,85]],
 ['花园鼓腹罐',[78,75,81,96,117,130,136,132,118,99,88,83]],
 ['星夜细颈瓶',[62,61,62,65,78,105,126,136,133,120,96,81]],
 ['潮汐宽口钵',[140,138,134,127,115,102,90,79,70,66,64,63]],
 ['晨光花器',[83,81,78,80,91,106,119,127,125,114,95,80]]
];
export function makePotteryLevel(r,d){
 const form=forms[Math.floor(r()*forms.length)],scale=.93+r()*.10,lip=(r()-.5)*6;
 const target=form[1].map((v,i)=>clamp(v*scale+lip*Math.cos(i/11*Math.PI),56,148));
 const bands=[2,3,4][d-1],order=Array.from({length:bands},(_,i)=>(Math.floor(r()*3)+i)%3);
 for(let i=1;i<bands;i++)if(order[i]===order[i-1])order[i]=(order[i]+1)%3;
 const ringColors=Array.from({length:12},(_,i)=>order[Math.floor(i/(12/bands))]);
 const peak=72+r()*8,heat=[12,14,16][d-1],hold=[9,12,15][d-1],cool=[10,12,14][d-1];
 return {schemaVersion:41,formName:form[0],target,initial:Array.from({length:12},(_,i)=>126-Math.sin(i/11*Math.PI)*8),
  tolerance:[12,9,7][d-1],glazeBands:bands,ringColors,glazeOrder:order,glazeGoal:[.82,.86,.9][d-1],
  kiln:{peak,heat,hold,cool,duration:heat+hold+cool,tolerance:[10,8,6.5][d-1],minimum:[.62,.70,.77][d-1],draft:(r()-.5)*.006,phase:r()*Math.PI*2},
  time:[300,360,420][d-1]};
}
export function initPottery(l){
 return {radii:[...l.initial],wet:.88,glaze:Array(12).fill(0),pigments:Array.from({length:12},()=>[0,0,0]),
  glazeColor:l.ringColors[0],mode:'shape',accuracy:0,kiln:null,potteryOutcome:null,potteryRevision:0,contactAt:-1,waterAt:-2};
}
export function potteryShapeReview(s){
 const errors=s.radii.map((r,i)=>Math.abs(r-s.level.target[i])),t=s.level.tolerance;
 const accuracy=errors.reduce((sum,e)=>sum+clamp(1-e/(t*3),0,1),0)/12;
 return {accuracy,maxError:Math.max(...errors),mouth:errors[0]<=t,base:errors[11]<=t,
  complete:accuracy>=.9&&Math.max(...errors)<=t*1.5&&errors[0]<=t&&errors[11]<=t};
}
export function potteryGlazeReview(s){
 const l=s.level,bands=Array.from({length:l.glazeBands},(_,b)=>{
  const start=b*12/l.glazeBands,indices=Array.from({length:12/l.glazeBands},(_,i)=>start+i),color=l.glazeOrder[b];
  const coverage=Math.min(...indices.map(i=>s.glaze[i])),purity=Math.min(...indices.map(i=>s.pigments[i][color]));
  return {band:b,color,coverage,purity,complete:coverage>=.8&&purity>=l.glazeGoal};
 });
 const quality=s.glaze.reduce((sum,v,i)=>sum+v*s.pigments[i][l.ringColors[i]],0)/12;
 return {bands,quality,complete:bands.every(b=>b.complete)};
}
export function potteryKilnTarget(l,elapsed){
 const k=l.kiln;
 if(elapsed<k.heat)return {stage:'升温',temperature:20+(k.peak-20)*elapsed/k.heat,slope:(k.peak-20)/k.heat};
 if(elapsed<k.heat+k.hold){const t=elapsed-k.heat,a=t/k.hold*Math.PI*2;
  return {stage:'保温',temperature:k.peak+1.8*Math.sin(a),slope:1.8*Math.cos(a)*Math.PI*2/k.hold};}
 const t=clamp(elapsed-k.heat-k.hold,0,k.cool);
 return {stage:'退火',temperature:k.peak+(28-k.peak)*t/k.cool,slope:(28-k.peak)/k.cool};
}
export function potteryKilnLoss(s){return .045+.08*s.kiln.vent+s.level.kiln.draft*Math.sin(s.kiln.elapsed*.7+s.level.kiln.phase);}
export function potteryAction(s,a,emit){
 if(['point','down'].includes(a.type)&&(!Number.isFinite(a.x)||!Number.isFinite(a.y)))return true;
 if(s.mode==='firing'||s.mode==='reveal'){
  if(s.mode==='firing'&&['kilnFire','kilnVent'].includes(a.type)&&Number.isFinite(a.delta)&&Math.abs(a.delta)>0&&Math.abs(a.delta)<=10){
   const key=a.type==='kilnFire'?'fire':'vent';s.kiln[key]=clamp(s.kiln[key]+a.delta/100,0,1);s.potteryRevision++;emit(s,'turn',480,360);
  }
  return true;
 }
 if(a.type==='water'){
  if(s.mode==='shape'&&s.t-s.waterAt>=.6){s.wet=clamp(s.wet+.35,0,1);s.waterAt=s.t;emit(s,'water',480,280);}
  return true;
 }
 if(a.type==='glazeColor'){
  if(s.mode==='glaze'&&Number.isInteger(a.index)&&POTTERY_COLORS[a.index]){
   s.glazeColor=a.index;s.holding=false;s.potteryRevision++;s.status='已换成'+POTTERY_COLORS[a.index].name+'，沿指定釉带轻刷。';emit(s,'dip',740,385);
  }return true;
 }
 if(a.type==='rework'){
  if(s.mode==='glaze'){s.mode='shape';s.holding=false;s.glaze.fill(0);s.pigments=s.pigments.map(()=>[0,0,0]);s.potteryRevision++;
   s.status='回到拉坯；旧釉层已清理，可以重新修整器型。';}
  return true;
 }
 if(a.type==='submit'){
  s.holding=false;
  if(s.mode==='shape'){
   const r=potteryShapeReview(s);s.accuracy=r.accuracy;
   if(!r.complete){s.status=!r.mouth||!r.base?'口沿或器足偏离轮廓，请分别修整。':'仍有局部轮廓偏差；平均吻合度和最差段都需达标。';emit(s,'shake');return true;}
   s.mode='glaze';s.glazeColor=s.level.ringColors[0];s.status='按右侧委托的分区釉色涂刷；刷错可以用正确釉色重新覆盖。';s.potteryRevision++;emit(s,'glaze',480,270);
  }else{
   const r=potteryGlazeReview(s);
   if(!r.complete){const b=r.bands.find(b=>!b.complete);s.status='第'+(b.band+1)+'釉带需要'+POTTERY_COLORS[b.color].name+'；覆盖与釉色纯度都需达标。';emit(s,'shake');return true;}
   s.mode='firing';s.kiln={elapsed:0,temperature:20,fire:.5,actualFire:.5,vent:.15,damage:0,fidelity:0,okSeconds:0,
    trace:[{at:0,temperature:20,target:20}],stage:'升温',reveal:0,report:null};
   s.potteryRevision++;s.status='升温开始：↑↓调炉火，←→调风门；提前收火，窑温不会立刻下降。';emit(s,'cook',480,390);
  }return true;
 }
 return !['point','down','up'].includes(a.type);
}
export function stepPottery(s,dt,emit){
 const l=s.level;
 if(s.mode==='shape'||s.mode==='glaze'){
  if(s.holding&&s.pointer.y>112&&s.pointer.y<428){
   const ring=clamp(Math.round((s.pointer.y-125)/270*11),0,11),inside=Math.abs(s.pointer.x-480)<=s.radii[ring]+25;
   if(s.mode==='shape'&&s.wet>.05){
    const target=clamp(Math.abs(s.pointer.x-480),55,160);
    // A guide can lie deep inside a thick starting blank. Accept contact there,
    // and limit deformation by elapsed time rather than silently ignoring the pull.
    if(inside||Math.abs(Math.abs(s.pointer.x-480)-s.radii[ring])<42){
     const pull=(target-s.radii[ring])*(1-Math.exp(-dt*2.8*(.35+.65*s.wet)));
     // Neighbours share the local displacement, not the selected ring's absolute
     // radius. Holding a correct ring must never flatten the adjacent contour.
     for(let i=0;i<12;i++){const influence=Math.exp(-Math.pow((i-ring)/.85,2));s.radii[i]=clamp(s.radii[i]+pull*influence,55,160);}
     s.wet=Math.max(0,s.wet-dt*.042);s.accuracy=potteryShapeReview(s).accuracy;
     if(s.t-s.contactAt>.13){emit(s,'clay',s.pointer.x,s.pointer.y);s.contactAt=s.t;}
    }
   }else if(s.mode==='glaze'&&inside){
    const band=Math.floor(ring/(12/l.glazeBands));
    for(let i=0;i<12;i++)if(Math.floor(i/(12/l.glazeBands))===band){
     const influence=Math.exp(-Math.pow((i-ring)/1.05,2)),paint=1-Math.exp(-dt*4*influence);
     s.glaze[i]=clamp(s.glaze[i]+dt*1.8*influence,0,1);
     s.pigments[i]=s.pigments[i].map((v,color)=>v*(1-paint)+(color===s.glazeColor?paint:0));
    }
    if(s.t-s.contactAt>.13){emit(s,'glaze',s.pointer.x,s.pointer.y,{color:s.glazeColor});s.contactAt=s.t;}
   }
  }return null;
 }
 if(s.mode==='firing'){
  const k=s.kiln;dt=Math.min(dt,Math.max(0,l.kiln.duration-k.elapsed));
  k.actualFire+=(k.fire-k.actualFire)*(1-Math.exp(-dt/1.1));
  k.temperature=clamp(k.temperature+(9.5*k.actualFire-potteryKilnLoss(s)*(k.temperature-20))*dt,20,115);
  k.elapsed=Math.min(l.kiln.duration,k.elapsed+dt);
  const current=potteryKilnTarget(l,k.elapsed),error=Math.abs(k.temperature-current.temperature),relative=error/l.kiln.tolerance;
  k.fidelity+=Math.exp(-relative*relative*.65)*dt;
  if(relative<=1)k.okSeconds+=dt;
  k.damage=clamp(k.damage+Math.max(0,relative-1.6)*dt*2.6,0,100);
  if(k.stage!==current.stage){k.stage=current.stage;s.potteryRevision++;s.status=current.stage==='保温'?'进入保温：小火稳住釉色，不要追着温度频繁加柴。':'进入退火：收火并开风门，跟随降温曲线。';emit(s,'cook',480,390);}
  if(k.elapsed-k.trace.at(-1).at>=.16){k.trace.push({at:k.elapsed,temperature:k.temperature,target:current.temperature});if(k.trace.length>300)k.trace.shift();}
  if(k.damage>=100){s.potteryOutcome={passed:false,quality:0};s.status='窑温偏差过久，坯体未能成器。材料会保留，可以重试。';return s.potteryOutcome;}
  if(k.elapsed+1e-9>=l.kiln.duration){
   const fidelity=clamp(k.fidelity/l.kiln.duration,0,1),passed=fidelity>=l.kiln.minimum&&k.damage<=18;
   k.report={fidelity,damage:k.damage,inBand:clamp(k.okSeconds/l.kiln.duration,0,1),passed};
   const shape=potteryShapeReview(s).accuracy,glaze=potteryGlazeReview(s).quality;
   s.potteryOutcome={passed,quality:Math.round(clamp((shape*.45+glaze*.25+fidelity*.30)*100-k.damage*.35,0,100))};
   s.mode='reveal';k.reveal=0;s.holding=false;s.potteryRevision++;
   s.status=passed?'窑火合格，正在出窑查看釉色。':'烧制偏离委托；正在检查失误记录，材料不扣除。';emit(s,'glaze',480,270);
  }return null;
 }
 if(s.mode==='reveal'){s.kiln.reveal+=dt;if(s.kiln.reveal>=3.4)return s.potteryOutcome;}
 return null;
}
