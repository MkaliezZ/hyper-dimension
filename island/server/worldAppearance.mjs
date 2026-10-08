import {worldSlots,worldWalkableForTheme} from '../src/world.js';
import {hydratePlacements,checkDecoration,snapDisplay} from '../src/placements.js';
import {syncFacilityState} from './facilityActions.mjs';
const fail=message=>Object.assign(Error(message),{code:'appearance_pending',status:409});
export const worldAppearance=(s,storageTheme)=>s.worldAppearance||s.placementBook?.theme||storageTheme;
function nearbyWalkable(theme,p){if(worldWalkableForTheme(theme,p.x,p.y))return p;for(let r=12;r<=300;r+=12)for(let i=0;i<16;i++){const q={x:p.x+Math.cos(i*Math.PI/8)*r,y:p.y+Math.sin(i*Math.PI/8)*r};if(worldWalkableForTheme(theme,q.x,q.y))return q;}return {x:780,y:470};}
export function applyWorldAppearance(s,b,next,storageTheme){
 if(!['pixel','origami'].includes(next))throw fail('画风选择无效');const previous=worldAppearance(s,storageTheme);if(previous===next)return;
 if(b.active||Object.values(b.farm?.leases||{}).length||Object.values(b.field?.leases||{}).length||Object.values(b.resident?.leases||{}).length||Object.values(b.visitor?.leases||{}).length)throw fail('正在收尾岛上作业，请稍后切换');
 if(s.partySession||['fishingParty','nightParty','festivalParty','coutureParty','fireworksParty'].some(key=>s[key]?.session))throw fail('请先结束正在举行的活动，再切换画风');
 hydratePlacements(s,previous);const oldSlots=worldSlots(previous),newSlots=worldSlots(next),original=s.placedItems;s.placedItems=[];s.placementBook.theme=next;
 for(const item of original){
  const from=oldSlots.find(x=>x.id===item.building),to=newSlots.find(x=>x.id===item.building),remembered=item.appearancePositions?.[next];
  const start=remembered||{x:item.x+to.x-from.x,y:item.y+to.y-from.y};let found=null;
  for(let radius=0;radius<=360&&!found;radius+=24)for(let i=0;i<(radius?16:1);i++){
   const q={...item,...snapDisplay(start.x+Math.cos(i*Math.PI/8)*radius,start.y+Math.sin(i*Math.PI/8)*radius)};
   if(checkDecoration(s,q,{theme:next}).ok){found=q;break;}
  }
  if(!found)throw fail('这套画风暂时找不到足够的陈列空间，原小岛保持不变');
  found.appearancePositions={...item.appearancePositions,[previous]:{x:item.x,y:item.y},[next]:{x:found.x,y:found.y}};s.placedItems.push(found);
 }
 s.placementBook.revision++;s.worldAppearance=next;s.player=nearbyWalkable(next,s.player);s.npcPresence=[];
 if(b.visitor){b.visitor.theme=next;s.visitorControl.theme=next;}
 syncFacilityState(s,b);
}
