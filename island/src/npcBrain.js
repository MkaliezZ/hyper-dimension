import { BUILDINGS,SLOTS } from './world.js';
export const GOAL_POINTS={farm:{x:441,y:601},mine:{x:1134,y:296},plaza:{x:784,y:458},workshop:{x:706,y:206},tea:{x:866,y:218},gallery:{x:979,y:612}};
const TEMPLATES={farm:['田垄有了新变化，我想去看看。','今天先去照料土地。'],mine:['矿洞的光好像又亮了一些。','我要去检查矿石和工具。'],plaza:['广场很适合与大家见面。','我去看看有没有新的聚会。'],workshop:['工坊或许能做出派对需要的东西。','工具整理好了，我去工坊。'],tea:['茶屋坐一会儿，可能会遇见朋友。','我想去茶屋聊聊今天的事。'],gallery:['有人在展馆留下了新故事。','我想看看岛上的收藏。']};
export function decideLocally(resident,state,memories=[],turn=0){
 const active=new Set(Object.values(state.buildings).map(id=>BUILDINGS[id]?.kind));
 const candidates=['farm','mine','plaza','workshop','tea','gallery'].filter(g=>!['workshop','tea','gallery'].includes(g)||active.has(g));
 const recent=memories.at(-1)?.text||'';
 const scored=candidates.map(goal=>{let score=1+(resident.interest.includes(goal)?3:0);if(goal==='farm'&&state.tasks.farm===false)score+=1.4;if(goal==='mine'&&state.tasks.mine===false)score+=1.3;if(goal==='plaza'&&state.activities>0)score+=1.2;if(goal==='workshop'&&state.tasks.craft===false)score+=.9;if(recent.includes('派对')&&goal==='plaza')score+=2;if(recent.includes('收获')&&goal==='farm')score+=2;if(recent.includes('矿')&&goal==='mine')score+=2;return {goal,score}}).sort((a,b)=>b.score-a.score);
 const last=state.npcLastGoal?.[resident.id];const goal=scored.find(x=>x.goal!==last)?.goal||scored[0]?.goal||'plaza';
 return {goal,speech:TEMPLATES[goal][(turn+resident.id)%2],mood:goal==='plaza'?'social':goal==='farm'||goal==='mine'?'busy':'curious',source:'local'};
}
export function recordMemory(state,event){state.islandMemory??=[];state.islandMemory.push({day:state.day,text:String(event).slice(0,120)});state.islandMemory=state.islandMemory.slice(-12)}

export function destinationFor(decision,state){if(['farm','mine','plaza'].includes(decision.goal))return decision.goal==='farm'?{x:435,y:700}:decision.goal==='mine'?{x:1140,y:312}:{x:780,y:465};const id=Number.isInteger(decision.buildingId)&&state.buildings[decision.buildingId]!==undefined?decision.buildingId:Object.values(state.buildings).find(id=>BUILDINGS[id]?.kind===decision.goal);return SLOTS[id]?.entry||{x:780,y:465}}
