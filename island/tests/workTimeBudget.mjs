// Native task checks share the original remaining-chain allowance across stages.
export function createWorkTimeBudget(limitMs,label){
 if(!Number.isFinite(limitMs)||limitMs<=0)throw RangeError('Invalid work-time allowance');
 let used=0;
 return Object.freeze({limitMs,get usedMs(){return used;},charge(elapsedMs,working){
  if(!Number.isFinite(elapsedMs)||elapsedMs<0||typeof working!=='boolean')throw RangeError('Invalid work-time sample');
  if(working)used+=elapsedMs;
  if(used>limitMs)throw Error(label+' exceeded '+limitMs+'ms of fixed working hours (used '+used+'ms)');
  return used;
 }});
}
