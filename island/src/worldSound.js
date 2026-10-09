import {getSoundMixer,soundForAction} from './soundMixer.js';
import {audibleResidents,residentStrokePeriod} from './soundSpatial.js';
export function createWorldSound(mixer=getSoundMixer()){
 const scope=mixer.createScope('island-world');let time=0,nextAmbient=0,nextBird=5,nextMusic=0,nextStep=0,beat=0,sceneKey='',active=false;
 const midi=n=>440*2**((n-69)/12),residentState=new Map();let residentCues=0,nearbyCount=0;
 function residents(npcs,listener,scene,building){
  const nearby=audibleResidents(npcs,listener,scene,building);nearbyCount=nearby.length;const seen=new Set();
  for(const {id,actor:a,sound} of nearby){seen.add(id);const old=residentState.get(id),step=Number.isFinite(a.phase)?Math.floor(a.phase/Math.PI):null,act=a.action;let cue=null;
   if(old&&a.walking&&!act&&step!=null&&old.step!=null&&step>old.step)cue='footstep';
   if(old&&a.speech&&a.speech!==old.speech&&act?.type==='talk')cue='talk';
   if(old&&act&&old.action===act&&Number.isFinite(act.t)&&Number.isFinite(act.duration)&&act.duration>0){
    const period=residentStrokePeriod(act),t=act.t+(act.visualWait||0),hit=Math.floor((t-period*.52)/period);
    if(hit>old.hit&&t<act.duration+(act.visualWait||0)&&!['talk','listen','rest','observe','celebrate'].includes(act.type))cue=soundForAction(act.type);
   }
   const period=residentStrokePeriod(act);
   residentState.set(id,{step,speech:a.speech||'',action:act,hit:period>0?Math.floor(((act.t||0)+(act.visualWait||0)-period*.52)/period):null});
   if(cue&&scope.play(cue,{volume:sound.volume*(cue==='talk'?.48:.3),pan:sound.pan,sourceId:'resident-'+id}))residentCues++;
  }
  for(const id of residentState.keys())if(!seen.has(id))residentState.delete(id);
 }
 function tick(dt,{scene='world',building=0,actor,npcs=[],playing=true,game=false,theme='pixel',celebrating=false}={}){
  const enabled=playing&&!game;active=enabled;
  if(!enabled){scope.pause();residentState.clear();nearbyCount=0;return;}
  scope.resume();time+=Math.max(0,Math.min(.05,dt));const key=scene+':'+building;
  if(key!==sceneKey){scope.pause();scope.resume();sceneKey=key;residentState.clear();nextAmbient=time;nextMusic=time+.6;nextBird=time+5;nextStep=time+.3;}
  if(time>=nextAmbient){
   nextAmbient=time+(scene==='mine'?2.8:scene==='world'?3:4);
   const cue=scene==='world'?'ocean':scene==='farm'?'wind':scene==='mine'?'water':[2,17,20,23].includes(building)?'fire':[1,6,14].includes(building)?'water':'wind';
   scope.play(cue,{category:'ambience',volume:scene==='world'?1:scene==='farm'?.55:scene==='mine'?.35:.25});
  }
  if((scene==='farm'||scene==='world')&&time>=nextBird){nextBird=time+9+(beat%4)*2;scope.play('bird',{category:'ambience',volume:.75});}
  if(actor?.walking&&!actor.action&&time>=nextStep){nextStep=time+.32;scope.play('footstep',{volume:scene==='mine'?.8:.65});}
  residents(npcs,actor,scene,building);
  if(!celebrating&&time>=nextMusic){
   nextMusic=time+2.6;const melody=[60,64,67,69,67,64,62,67],transpose=scene==='mine'?-12:scene==='farm'?5:0;
   scope.tone(midi(melody[beat++%melody.length]+transpose),{category:'music',duration:1.2,volume:.085,type:theme==='pixel'?'triangle':'sine'});
   if(beat%4===0)scope.tone(midi(48+transpose),{category:'music',duration:2.3,volume:.045});
  }
 }
 return {tick,contact(action){const cue=soundForAction(action.type);if(cue&&active)scope.play(cue)},collect(){if(active)scope.play('collect')},sceneChanged(){sceneKey='';residentState.clear()},celebrate(){scope.play('victory')},destroy(){scope.destroy()},inspect:()=>({active,sceneKey,nearbyCount,residentCues,...scope.inspect()})};
}
