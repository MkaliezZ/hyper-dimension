import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundMixer,normalizeSoundPreferences,SOUND_DEFAULTS,SOUND_KEY,SOUND_CUES,soundForAction} from '../src/soundMixer.js';
import {createWorldSound} from '../src/worldSound.js';
import {ROOMS} from '../src/rooms.js';
class Param{constructor(value=0){this.value=value;this.events=[];}setValueAtTime(v,t){this.value=v;this.events.push([v,t]);}linearRampToValueAtTime(v,t){this.setValueAtTime(v,t)}exponentialRampToValueAtTime(v,t){assert(v>0);this.setValueAtTime(v,t)}cancelScheduledValues(){}}
class Node{constructor(){this.gain=new Param();this.frequency=new Param(440);this.Q=new Param();this.links=[];this.stopped=false;}connect(node){this.links.push(node)}disconnect(){this.links=[]}start(at){this.started=at;}stop(at){this.stopped=true;this.stopAt=at;if(at===undefined)this.onended?.();}}
class Context{
 constructor(){this.currentTime=0;this.sampleRate=8000;this.state='suspended';this.destination={};this.nodes=[];this.resumes=0;this.closes=0;}
 node(){const n=new Node();this.nodes.push(n);return n;}createGain(){return this.node()}createOscillator(){return this.node()}createBufferSource(){return this.node()}createBiquadFilter(){return this.node()}
 createBuffer(channels,size){const data=new Float32Array(size);return {getChannelData:()=>data};}
 async resume(){this.state='running';this.resumes++;}async suspend(){this.state='suspended';}async close(){this.state='closed';this.closes++;}
}
function fixture(values={}){
 const map=new Map(Object.entries(values)),writes=[],ctx=new Context();let created=0,time=0;
 const mixer=createSoundMixer({storage:{getItem:k=>map.get(k),setItem:(k,v)=>{map.set(k,v);writes.push(k)}},contextFactory:()=>{created++;return ctx},clock:()=>time});
 return {ctx,mixer,map,writes,created:()=>created,advance:n=>{time+=n;ctx.currentTime+=n}};
}
test('volume preferences reject unsafe values, clamp valid numbers and retain only known fields',()=>{
 assert.deepEqual(normalizeSoundPreferences(null),SOUND_DEFAULTS);
 const p=normalizeSoundPreferences({master:-1,music:2,effects:NaN,ambience:Infinity,muted:'yes',privateKey:'never'});
 assert.equal(p.master,0);assert.equal(p.music,1);assert.equal(p.effects,SOUND_DEFAULTS.effects);assert.equal(p.ambience,SOUND_DEFAULTS.ambience);assert.equal(p.muted,false);assert.equal(p.privateKey,undefined);
});
test('audio is lazy until unlock, uses one context, and adopts legacy mute only on a fresh device',async()=>{
 const f=fixture({'hd-workshop-muted':'1'});assert.equal(f.mixer.inspect().preferences.muted,true);assert.equal(f.created(),0);
 assert.equal(f.mixer.play('wood'),false);assert.equal(f.created(),0);
 await f.mixer.unlock();await f.mixer.unlock();assert.equal(f.created(),1);assert.equal(f.mixer.play('stone'),false);
 f.mixer.toggleMute();f.advance(.1);assert(f.mixer.play('stone'));assert(f.writes.every(k=>k===SOUND_KEY));
 const saved=fixture({[SOUND_KEY]:JSON.stringify({muted:false,master:.42}),'hd-workshop-muted':'1'});assert.equal(saved.mixer.inspect().preferences.muted,false);assert.equal(saved.mixer.inspect().preferences.master,.42);
});
test('master and each sound bus apply independent ramps and silent categories schedule no voices',async()=>{
 const f=fixture();await f.mixer.unlock();f.mixer.setPreferences({master:.4,music:.65,effects:0,ambience:.22});
 assert(Math.abs(f.ctx.nodes[0].gain.value-.248)<1e-8);assert.equal(f.ctx.nodes[1].gain.value,.65);assert.equal(f.ctx.nodes[2].gain.value,0);assert.equal(f.ctx.nodes[3].gain.value,.22);
 assert.equal(f.mixer.play('wood'),false);assert(f.mixer.tone(440,{category:'music'}));assert(f.mixer.play('ocean',{category:'ambience'}));
});
test('game scope pause and destroy stop its delayed notes without closing other island sounds',async()=>{
 const f=fixture();await f.mixer.unlock();const world=f.mixer.createScope('world'),game=f.mixer.createScope('game');
 assert(world.play('ocean',{category:'ambience'}));assert(game.play('victory'));const worldVoices=world.inspect().voices;assert(game.inspect().voices>=5);
 game.pause();assert.equal(game.inspect().voices,0);assert.equal(world.inspect().voices,worldVoices);assert.equal(game.play('cut'),false);
 game.resume();f.advance(.1);assert(game.play('cut'));game.destroy();assert.equal(game.inspect().voices,0);assert.equal(world.inspect().voices,worldVoices);assert.equal(f.ctx.closes,0);assert.equal(game.play('note'),false);
 world.destroy();assert.equal(f.mixer.inspect().voices,0);assert.equal(f.mixer.inspect().scopes,0);
});
test('background and global mute cancel pending voices; reopening never catches up missed sounds',async()=>{
 const f=fixture();await f.mixer.unlock();f.mixer.play('victory');assert(f.mixer.inspect().voices>0);f.mixer.setBlocked(true);assert.equal(f.mixer.inspect().voices,0);assert.equal(f.ctx.state,'suspended');assert.equal(f.mixer.play('harvest'),false);
 f.advance(20);f.mixer.setBlocked(false);assert.equal(f.mixer.inspect().voices,0);assert.equal(f.ctx.state,'running');assert(f.mixer.play('wood'));
 f.mixer.setPreferences({muted:true});assert.equal(f.mixer.inspect().voices,0);f.advance(.1);assert.equal(f.mixer.play('stone'),false);
 f.mixer.setPreferences({muted:false});assert.equal(f.mixer.inspect().voices,0);f.advance(.1);assert(f.mixer.play('stone'));
});
test('all shipped cues schedule bounded finite original sound and unknown input cannot allocate voices',async()=>{
 const f=fixture();await f.mixer.unlock();for(const cue of SOUND_CUES){f.advance(.06);assert(f.mixer.play(cue),cue);assert(f.mixer.inspect().voices<=48);}
 const count=f.mixer.inspect().produced;
 assert.equal(f.mixer.play('__proto__'),false);assert.equal(f.mixer.tone(NaN),false);assert.equal(f.mixer.tone(Infinity),false);assert.equal(f.mixer.tone(-1),false);assert.equal(f.mixer.tone(300,{category:'bad'}),false);assert.equal(f.mixer.tone(300,{duration:-1}),false);
 assert.equal(f.mixer.inspect().produced,count);
 for(const n of f.ctx.nodes)for(const p of [n.gain,n.frequency])for(const [v,t] of p.events){assert(Number.isFinite(v));assert(Number.isFinite(t));}
 f.mixer.destroy();assert.equal(f.mixer.inspect().voices,0);assert.equal(f.ctx.closes,1);await f.mixer.unlock();assert.equal(f.created(),1);
});
test('polyphony and repeated-cue flood are bounded, with source and gain disconnection',async()=>{
 const f=fixture();await f.mixer.unlock();for(let i=0;i<200;i++)f.mixer.tone(220+i,{delay:.5,duration:3});assert.equal(f.mixer.inspect().voices,48);
 assert(f.ctx.nodes.filter(n=>n.started!=null).some(n=>n.links.length===0));
 const before=f.mixer.inspect().produced;for(let i=0;i<100;i++)f.mixer.play('cut');assert.equal(f.mixer.inspect().produced-before,2); // one textured hit = noise + oscillator
});
test('storage denial, malformed JSON and unsupported audio remain usable without throwing',async()=>{
 const f=createSoundMixer({storage:{getItem(){throw Error('denied')},setItem(){throw Error('denied')}},contextFactory:()=>{throw Error('unsupported')}});
 assert.deepEqual(f.inspect().preferences,SOUND_DEFAULTS);assert.equal(await f.unlock(),false);assert.match(f.inspect().error,/不支持/);assert.equal(f.play('wood'),false);assert.doesNotThrow(()=>f.setPreferences({master:.3}));
 assert.deepEqual(fixture({[SOUND_KEY]:'broken'}).mixer.inspect().preferences,SOUND_DEFAULTS);
});
test('world sound follows actual action contact, footsteps and scene; game/splash intro silence holds',async()=>{
 const f=fixture();await f.mixer.unlock();const w=createWorldSound(f.mixer);
 w.tick(.05,{playing:false});w.contact({type:'axe'});assert.equal(f.mixer.inspect().cueCounts.wood,undefined);
 w.tick(.05,{scene:'world',playing:true,actor:{walking:false}});assert.equal(f.mixer.inspect().cueCounts.ocean,1);assert.equal(f.mixer.inspect().cueCounts.footstep,undefined);
 f.advance(.06);w.contact({type:'axe'});assert.equal(f.mixer.inspect().cueCounts.wood,1);
 w.tick(.05,{scene:'farm',playing:true});f.advance(.06);w.contact({type:'water'});assert.equal(f.mixer.inspect().cueCounts.water,1);
 const before=f.mixer.inspect().produced;w.tick(.05,{scene:'farm',game:true});assert.equal(w.inspect().voices,0);w.contact({type:'hoe'});assert.equal(f.mixer.inspect().produced,before);
 w.tick(.05,{scene:'farm',actor:{walking:true}});for(let i=0;i<10;i++){f.advance(.05);w.tick(.05,{scene:'farm',actor:{walking:true}});}assert(f.mixer.inspect().cueCounts.footstep>0);
 w.destroy();assert.equal(w.inspect().voices,0);
});
test('every actual room action plus forest/farm/mine tools has a semantic sound mapping',()=>{
 for(const action of [...ROOMS.map(r=>r.action),'axe','gather','mine','hoe','sow','water','harvest'])assert(SOUND_CUES.includes(soundForAction(action)),action);
});
