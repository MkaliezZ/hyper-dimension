// Original procedural island audio. Preferences belong to this device, never the game save.
export const SOUND_KEY='hd-island-sound-v1';
export const SOUND_DEFAULTS=Object.freeze({version:1,muted:false,master:.7,music:.32,effects:.75,ambience:.38});
export function normalizeSoundPreferences(value={}){
 const result={...SOUND_DEFAULTS};
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  if(typeof value.muted==='boolean')result.muted=value.muted;
  for(const key of ['master','music','effects','ambience'])if(typeof value[key]==='number'&&Number.isFinite(value[key]))result[key]=Math.max(0,Math.min(1,value[key]));
 }return result;
}
function safeStorage(){try{return globalThis.localStorage}catch{return null}}
const midi=n=>440*2**((n-69)/12),categories=['music','effects','ambience'];
const cueNotes={flip:67,join:60,snap:62,ingredient:65,cook:55,serve:72,collect:76,push:48,shutter:85,guide:74,bite:79,catch:72,rotate:57,buoy:69,turn:57,star:77,ribbon:71,order:72,dip:62,glaze:65,brush:59};
const cues=new Set([...Object.keys(cueNotes),'note','victory','failure','firework','footstep','wood','stone','hoe','sow','water','harvest','talk','boat','ui','ocean','wind','bird','fire','retry','shake','warning','burn','miss','cut','splash','pour','steam','trail','leak']);
export const SOUND_CUES=Object.freeze([...cues]);
export function soundForAction(type){return ({chop:'wood',axe:'wood',gather:'harvest',collect:'harvest',mine:'stone',pickaxe:'stone',hoe:'hoe',sow:'sow',water:'water',harvest:'harvest',craft:'wood',brew:'pour',cook:'cook',celebrate:'victory',arrange:'ribbon',observe:'star',perform:'note',paint:'brush',fish:'splash',rest:'wind',talk:'talk',listen:'talk'})[type]||null;}
export function createSoundMixer({storage=safeStorage(),contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),clock=()=>globalThis.performance?.now?.()/1000||Date.now()/1000}={}){
 let preferences={...SOUND_DEFAULTS},ctx=null,master=null,noise=null,unlocked=false,blocked=false,closed=false;
 try{const saved=storage?.getItem(SOUND_KEY);preferences=normalizeSoundPreferences(saved?JSON.parse(saved):{muted:storage?.getItem('hd-workshop-muted')==='1'});}catch{}
 const buses={},scopes=new Set(),voices=new Set(),listeners=new Set(),recent=new Map(),cueCounts=Object.create(null);let produced=0,suppressed=0,error=null;
 function inspect(){return {supported:!!ctx||typeof globalThis.AudioContext==='function'||typeof globalThis.webkitAudioContext==='function',unlocked,blocked,closed,state:ctx?.state||'locked',preferences:{...preferences},voices:voices.size,spatialVoices:[...voices].filter(v=>v.panner).length,scopes:scopes.size,produced,suppressed,cueCounts:{...cueCounts},error};}
 function notify(){for(const f of listeners)try{f(inspect())}catch{}}
 function gain(node,value){if(!node)return;const time=ctx.currentTime;node.gain.cancelScheduledValues?.(time);node.gain.setValueAtTime(node.gain.value,time);node.gain.linearRampToValueAtTime(value,time+.035);}
 function apply(){if(!master)return;gain(master,blocked||preferences.muted?0:preferences.master*.62);for(const key of categories)gain(buses[key],preferences[key]);}
 function disposeVoice(v,stop=false){
  if(!voices.delete(v))return;
  if(stop)try{v.source.stop()}catch{}
  try{v.source.disconnect();v.amp.disconnect();v.filter?.disconnect();v.panner?.disconnect()}catch{}
 }
 function stopScope(scope){for(const v of [...voices])if(!scope||v.scope===scope)disposeVoice(v,true);}
 async function unlock(){
  if(closed)return false;
  try{
   if(!ctx){ctx=contextFactory();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);for(const c of categories){buses[c]=ctx.createGain();buses[c].gain.value=preferences[c];buses[c].connect(master);}}
   unlocked=true;if(!blocked&&ctx.state!=='running')await ctx.resume?.();error=null;apply();notify();return true;
  }catch(e){unlocked=false;error=e?.name==='NotAllowedError'?'等待点击开启声音':'此设备暂不支持声音';notify();return false;}
 }
 function setPreferences(partial){
  const safe={...preferences};if(partial&&typeof partial==='object')for(const k of ['muted','master',...categories])if(Object.hasOwn(partial,k))safe[k]=partial[k];
  preferences=normalizeSoundPreferences(safe);if(preferences.muted)stopScope();apply();
  try{storage?.setItem(SOUND_KEY,JSON.stringify(preferences))}catch{}
  notify();return {...preferences};
 }
 function setBlocked(value){const next=!!value;if(next===blocked)return;blocked=next;if(blocked){stopScope();ctx?.suspend?.().catch?.(()=>{});}else if(unlocked)ctx?.resume?.().catch?.(()=>{});apply();notify();}
 function createScope(label='sound'){
  const scope={label:String(label).slice(0,60),paused:false,closed:false};
  scopes.add(scope);
  return {play:(kind,options={})=>play(kind,{...options,scope}),tone:(frequency,options={})=>tone(frequency,{...options,scope}),noise:options=>hiss({...options,scope}),
   pause(){scope.paused=true;stopScope(scope)},resume(){scope.paused=false},destroy(){if(scope.closed)return;scope.closed=true;stopScope(scope);scopes.delete(scope)},inspect:()=>({label:scope.label,paused:scope.paused,closed:scope.closed,voices:[...voices].filter(v=>v.scope===scope).length})};
 }
 function permitted(scope,category,volume){
  return !closed&&!!ctx&&unlocked&&!blocked&&!preferences.muted&&preferences.master>0&&preferences[category]>0&&volume>0&&!scope?.paused&&!scope?.closed;
 }
 function prepare(category,scope,volume,delay,duration){
  if(!categories.includes(category)||!permitted(scope,category,volume)||!Number.isFinite(volume)||!Number.isFinite(delay)||!Number.isFinite(duration)||duration<=0){suppressed++;return null;}
  while(voices.size>=48)disposeVoice(voices.values().next().value,true);
  return {at:ctx.currentTime+Math.max(0,Math.min(1.5,delay)),duration:Math.max(.018,Math.min(4,duration)),volume:Math.max(.0001,Math.min(.28,volume))};
 }
 function output(amp,category,pan){
  if(Number.isFinite(pan)&&pan!==0&&typeof ctx.createStereoPanner==='function'){const node=ctx.createStereoPanner();node.pan.setValueAtTime(Math.max(-1,Math.min(1,pan)),ctx.currentTime);amp.connect(node);node.connect(buses[category]);return node;}
  amp.connect(buses[category]);return null;
 }
 function launch(source,amp,filter,scope,p,panner=null){
  const v={source,amp,filter,scope,panner};voices.add(v);produced++;source.onended=()=>disposeVoice(v);source.start(p.at);source.stop(p.at+p.duration+.025);return true;
 }
 function envelope(amp,p){amp.gain.setValueAtTime(.0001,p.at);amp.gain.linearRampToValueAtTime(p.volume,p.at+.008);amp.gain.exponentialRampToValueAtTime(.0001,p.at+p.duration);}
 function tone(frequency,{category='effects',volume=.11,duration=.2,delay=0,type='sine',scope,bend=0,pan=0}={}){
  if(!Number.isFinite(frequency)||frequency<20||frequency>16000)return false;
  const p=prepare(category,scope,volume,delay,duration);if(!p)return false;
  const source=ctx.createOscillator(),amp=ctx.createGain();source.type=['sine','triangle','square','sawtooth'].includes(type)?type:'sine';source.frequency.setValueAtTime(frequency,p.at);if(Number.isFinite(bend)&&bend)source.frequency.exponentialRampToValueAtTime(Math.max(20,Math.min(16000,frequency*2**(bend/12))),p.at+p.duration);envelope(amp,p);source.connect(amp);return launch(source,amp,null,scope,p,output(amp,category,pan));
 }
 function hiss({category='effects',volume=.1,duration=.15,delay=0,filterType='lowpass',frequency=1600,scope,pan=0}={}){
  const p=prepare(category,scope,volume,delay,duration);if(!p)return false;
  if(!noise){noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const data=noise.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+.025*(Math.random()*2-1))/1.02;last=Math.max(-.8,Math.min(.8,last));data[i]=last*.5+(Math.random()*2-1)*.13;}}
  const source=ctx.createBufferSource(),amp=ctx.createGain(),filter=ctx.createBiquadFilter();source.buffer=noise;source.loop=true;filter.type=['lowpass','highpass','bandpass'].includes(filterType)?filterType:'lowpass';filter.frequency.value=Math.max(50,Math.min(12000,Number(frequency)||1600));filter.Q.value=.6;envelope(amp,p);source.connect(filter);filter.connect(amp);return launch(source,amp,filter,scope,p,output(amp,category,pan));
 }
 function play(kind,{volume=1,lane=0,category='effects',scope,pan=0,sourceId=''}={}){
  if(!cues.has(kind)||!Number.isFinite(volume)||volume<=0)return false;
  const time=clock(),key=(scope?.label||'global')+':'+kind+':'+String(sourceId).slice(0,60),prior=recent.get(key);if(prior!=null&&time-prior<.045){suppressed++;return false;}recent.set(key,time);if(recent.size>160)recent.delete(recent.keys().next().value);
  const count=produced,v=Math.min(1,volume),t=(f,d=.2,a=.11,delay=0,type='sine',bend=0)=>tone(f,{category,scope,volume:a*v,duration:d,delay,type,bend,pan}),n=(d=.15,a=.1,f=1600)=>hiss({category,scope,volume:a*v,duration:d,frequency:f,pan});
  if(kind==='note')t(midi(60+[0,4,7,11][Math.abs(Math.floor(lane))%4]),.3,.22);
  else if(kind==='victory')for(const [i,k] of [60,64,67,72,76].entries())t(midi(k),.65,.16,i*.105);
  else if(['failure','retry','shake','warning','burn','miss','leak'].includes(kind)){t(midi(50),.22,.09);t(midi(45),.35,.07,.12);}
  else if(kind==='footstep'){n(.06,.055,750);t(90,.05,.04,0,'triangle');}
  else if(['wood','cut','push'].includes(kind)){n(.09,.15,1800);t(kind==='cut'?180:115,.1,.13,0,'triangle',-5);}
  else if(kind==='stone'){n(.085,.13,4500);t(635,.16,.08,0,'triangle',-2);t(1120,.2,.035,.015);}
  else if(kind==='hoe'){n(.23,.14,650);t(95,.09,.06);}
  else if(kind==='sow'){for(let i=0;i<3;i++)t(midi(60+i*3),.06,.06,i*.05);}
  else if(['water','pour','splash','steam'].includes(kind)){n(.42,.11,2200);t(710,.15,.035,.05,'sine',-4);}
  else if(kind==='harvest'){n(.16,.08,1400);for(let i=0;i<3;i++)t(midi(67+i*4),.2,.085,i*.065);}
  else if(kind==='firework'){n(.55,.2,1200);t(100,.4,.12,0,'triangle',-9);t(830,.32,.055,.06);}
  else if(kind==='boat'){t(174.6,.7,.055,0,'sine');t(220,.7,.045,.03);}
  else if(kind==='ocean')n(3.2,.105,640);
  else if(kind==='wind')n(2.8,.06,1350);
  else if(kind==='fire'){n(.16,.075,2700);t(210,.055,.035,0,'triangle');}
  else if(kind==='bird'){t(1780,.12,.032,0,'sine',4);t(1980,.12,.025,.16,'sine',-5);}
  else if(kind==='talk'){t(midi(64),.07,.035);t(midi(67),.07,.025,.085);}
  else if(kind==='ui'||kind==='trail')t(midi(72),.07,.035);
  else if(Object.hasOwn(cueNotes,kind))t(midi(cueNotes[kind]),.18,.11);
  if(produced>count){cueCounts[kind]=(cueCounts[kind]||0)+1;return true;}return false;
 }
 function attach(target=globalThis.window,doc=globalThis.document){
  if(!target||!doc)return ()=>{};
  const gesture=e=>{if(e.isTrusted)void unlock();},hide=()=>setBlocked(doc.hidden),blur=()=>setBlocked(true),focus=()=>setBlocked(doc.hidden),end=e=>e.persisted?setBlocked(true):destroy(),show=()=>setBlocked(doc.hidden);
  target.addEventListener('pointerdown',gesture,true);target.addEventListener('keydown',gesture,true);target.addEventListener('blur',blur);target.addEventListener('focus',focus);target.addEventListener('pagehide',end);target.addEventListener('pageshow',show);doc.addEventListener('visibilitychange',hide);hide();
  return ()=>{target.removeEventListener('pointerdown',gesture,true);target.removeEventListener('keydown',gesture,true);target.removeEventListener('blur',blur);target.removeEventListener('focus',focus);target.removeEventListener('pagehide',end);target.removeEventListener('pageshow',show);doc.removeEventListener('visibilitychange',hide)};
 }
 function destroy(){if(closed)return;closed=true;stopScope();for(const s of scopes)s.closed=true;scopes.clear();ctx?.close?.().catch?.(()=>{});listeners.clear();recent.clear();}
 return {unlock,play,tone,createScope,inspect,setPreferences,toggleMute:()=>setPreferences({muted:!preferences.muted}).muted,setBlocked,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn)},attach,destroy};
}
let singleton=null;
export function getSoundMixer(){if(!singleton||singleton.inspect().closed){singleton=createSoundMixer();if(globalThis.window&&globalThis.document)singleton.attach();}return singleton;}
