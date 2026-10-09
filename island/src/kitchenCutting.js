// Cut positions and judgment are shared by the browser and authoritative craft replay.
export const KITCHEN_SCHEMA=142;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function kitchenTarget(s){
 const j=s.jobs?.[s.ticket];
 if(s.level.schemaVersion!==KITCHEN_SCHEMA||!j||j.state!=='prep'||j.ingredients.length!==s.level.orders[j.id].ingredients.length||j.cuts>=j.ingredients.length*2)return null;
 const index=Math.floor(j.cuts/2);
 return {job:j,index,x:421+index*69,y:328,remaining:2-j.cuts%2};
}
export function initKitchenCutting(s){
 s.kitchenStroke=null;s.lastCut=-1;s.cutX=560;
 for(const j of s.jobs)j.cutQuality=[];
}
export function resetKitchenPrep(j){j.cutQuality=[];}
export function neutralKitchen(s){s.kitchenStroke=null;}
function cut(s,target,x,emit,keyboard=false){
 if(s.t-s.lastCut<.36-1e-9)return false;
 const j=target.job,quality=keyboard?100:Math.round(clamp(100-Math.abs(x-target.x)*1.25,70,100));
 j.cuts++;j.cutQuality.push(quality);s.lastCut=s.t;s.cutX=x;s.cutFlash=.36;s.kitchenStroke=null;
 s.status=(quality>=92?'利落切配':'切配完成')+' · '+j.cuts+'/'+j.ingredients.length*2+(j.cuts===j.ingredients.length*2?' · 可以入灶':' · 每份食材切两刀');
 emit(s,'cut',x,328,{art:s.level.ids[j.ingredients[target.index]],quality,ticket:j.id,index:target.index});return true;
}
export function kitchenCutAction(s,a,emit){
 if(s.level.schemaVersion!==KITCHEN_SCHEMA)return false;
 if(!['point','down','up','cut'].includes(a.type))return false;
 const target=kitchenTarget(s);
 if(a.type==='up'){neutralKitchen(s);s.holding=false;return true;}
 if(a.type==='cut'){if(target)cut(s,target,target.x,emit,true);return true;}
 if(!Number.isFinite(a.x)||!Number.isFinite(a.y))return true;
 s.pointer={x:a.x,y:a.y};
 if(a.type==='down'){
  s.holding=true;
  s.kitchenStroke=target&&a.x>=385&&a.x<=600&&a.y>=250&&a.y<=308?{x:a.x,y:a.y,at:s.t,ticket:target.job.id,index:target.index}:null;
  if(target&&!s.kitchenStroke)s.status='从食材上方按住，向下划过虚线切口；空格也可切配。';
  return true;
 }
 const p=s.kitchenStroke;
 if(!p||!target||!s.holding)return true;
 if(p.ticket!==target.job.id||p.index!==target.index||s.t-p.at>1.5){neutralKitchen(s);return true;}
 if(a.y<340)return true;
 const dy=a.y-p.y,at=(target.y-p.y)/dy,x=p.x+(a.x-p.x)*at;
 neutralKitchen(s);
 if(dy<32||a.y>390||a.x<370||a.x>620||Math.abs(x-target.x)>22){s.status='划过高亮食材的切口，刀路需要从上方到下方。';return true;}
 cut(s,target,x,emit);return true;
}
export function kitchenDishQuality(j,cookingQuality){
 const cuts=j.cutQuality||[],prep=cuts.length?cuts.reduce((a,b)=>a+b,0)/cuts.length:70;
 return cookingQuality*.75+prep*.25;
}
export function kitchenRunQuality(s){
 const served=s.jobs.filter(j=>j.state==='served');
 const mean=served.length?served.reduce((n,j)=>n+(j.quality||60),0)/served.length:55;
 return mean-Math.max(0,s.failed)*4-s.strikes*2;
}
