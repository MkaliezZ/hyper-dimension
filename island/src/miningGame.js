// Shared mining input replay. The strike result comes from the timed pointer, not a reported grade.
export function createMiningGame(precision){return {engine:'mine',elapsed:0,time:0,precision,result:null}}
export function miningValue(g){return (Math.sin(g.time*3.6-Math.PI/2)+1)/2}
export function replayMining(g,events){
 if(!Array.isArray(events)||events.length>2048)throw Error('Invalid mining batch');
 for(const e of events){
  if(e.neutral===true&&Object.keys(e).length===1)continue;
  if(Object.hasOwn(e,'dt')){if(Object.keys(e).length!==1||!Number.isFinite(e.dt)||e.dt<0||e.dt>.050000001)throw Error('Invalid mining time');g.elapsed+=e.dt;if(!g.result)g.time+=e.dt;continue}
  if(Object.keys(e).length!==1||!e.action||Object.keys(e.action).length!==1||e.action.type!=='strike'||g.result)throw Error('Invalid mining input');
  const value=miningValue(g),strong=Math.abs(value-.5)<=g.precision;g.result={passed:true,strong,value,damage:strong?2:1,quality:strong?100:60,seconds:g.time};
 }
 return g;
}
