import {copyEnvironmentClock,environmentAt} from '../src/environmentClock.js';
export function gameEnvironment(provider,at){
 const view=provider?.();if(view==null)return null;
 const clock=copyEnvironmentClock(view.clock||view);
 return {clock,at,environment:environmentAt(clock,at)};
}
// Only the accepted active interval is examined. Offline elapsed time grants no watering or growth.
export function activeWeatherIntervals(context,seconds){
 if(!context||!(seconds>0))return [{seconds,environment:null}];
 const {clock,at}=context,span=clock.dayLengthMs/clock.rate,start=at-seconds*1000;
 let cursor=start;const result=[];
 while(cursor<at-.0001){
  const env=environmentAt(clock,cursor+.0001),next=clock.epochMs+(Math.floor(env.cycles)+1-clock.phaseAtEpoch)*span;
  const end=Math.min(at,Math.max(cursor+.001,next));
  result.push({seconds:(end-cursor)/1000,environment:env});cursor=end;
 }
 return result;
}
