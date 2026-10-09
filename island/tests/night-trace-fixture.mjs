import {applyNightPartyEvent,nightLight} from '../src/nightPartyReplay.js';
export function findNightAim(game){
 let best={angle:0,power:1,error:Infinity};
 for(let angle=-38;angle<=38;angle++){
  const g=structuredClone(game);applyNightPartyEvent(g,{action:{type:'aim',x:angle,value:1}});applyNightPartyEvent(g,{action:{type:'launch'}});
  let guard=0;while(g.phase==='flight'&&guard++<240)applyNightPartyEvent(g,{dt:.05});
  const error=g.reports.at(-1)?.error??Infinity;if(error<best.error)best={angle,power:1,error};
 }
 return best;
}
export function traceNightGame(game){
 const g=structuredClone(game),events=[],emit=e=>{applyNightPartyEvent(g,e);events.push(e);},tick=()=>emit({dt:.05});
 if(g.engine==='night-sky'){
  for(let i=g.round;i<4;i++){
   if(g.phase==='between'){while(g.phaseTime<1.5)tick();emit({action:{type:'next'}});}
   if(g.phase==='aim'){const aim=findNightAim(g);emit({action:{type:'aim',x:aim.angle,value:aim.power}});emit({action:{type:'launch'}});}
   let guard=0;while(g.phase==='flight'&&guard++<240)tick();
   if(guard>=240)throw Error('Flight failed to finish');
  }
 }else for(let i=g.round;i<4;i++){while(nightLight(g)<.42||nightLight(g)>.58)tick();emit({action:{type:'tap'}});}
 return{game:g,events};
}
