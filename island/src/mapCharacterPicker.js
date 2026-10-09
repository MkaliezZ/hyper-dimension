// Targets are recorded by the renderer in paint order, in world coordinates.
// The rendered name and body carry the same stable identity as their detail card.
export function createMapCharacterPicker(){
 let targets=[];
 const contains=(r,p,pad=0)=>r&&p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad;
 return {
  reset(){targets=[];},
  add(target){targets.push(target);},
  pick(p){for(let i=targets.length-1;i>=0;i--){const t=targets[i];if(contains(t.label,p)||contains(t.body,p,2))return t;}return null;},
  inspect(){return targets.map(({kind,npcId,name,body,label})=>({kind,npcId,name,body:body&&{...body},label:label&&{...label}}));}
 };
}
