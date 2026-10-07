import {getSoundMixer} from './soundMixer.js';
// One device-wide context and three volume buses; this game only owns its voices.
export function createWorkshopAudio(){
 const mixer=getSoundMixer(),scope=mixer.createScope('workshop'),midi=n=>440*2**((n-69)/12);let lastBeat=-1,closed=false;
 function unlock(){if(!closed){scope.resume();void mixer.unlock();}}
 function event(e){if(!closed)scope.play(e.kind,{lane:e.lane??0});}
 function tick(s){
  if(closed||s.kind!=='rhythm'||s.phase!=='playing')return;
  const beat=Math.floor(s.t/s.level.beat);if(beat===lastBeat)return;lastBeat=beat;
  const roots=[48,53,45,55],root=roots[Math.floor(beat/4)%4]+s.level.key;
  scope.tone(midi(root),{category:'music',duration:s.level.beat*.8,volume:.13});
  if(beat%2===0){scope.tone(midi(root+12),{category:'music',duration:s.level.beat*1.7,volume:.06});scope.tone(midi(root+19),{category:'music',duration:s.level.beat*1.7,volume:.05});}
  scope.tone(beat%4===0?900:650,{category:'music',duration:.03,volume:.035});
 }
 return {unlock,event,tick,subscribe:fn=>mixer.subscribe(fn),get muted(){return mixer.inspect().preferences.muted},toggle(){void mixer.unlock();return mixer.toggleMute()},pause(){scope.pause()},resume:unlock,destroy(){closed=true;scope.destroy()}};
}
