import {neutralKitchen} from './kitchenCutting.js';
import {neutralBrush,BRUSH_SCHEMA} from './brushStudio.js';
import {WORKSHOP_GAMES} from './workshopCatalog.js';
import {makeWorkshopLevel,createWorkshopState,workshopAction,stepWorkshop} from './workshopRules.js';
import {makeLevel,seededRandom} from './gameLevels.js';
import {makeLinkBoard,linkPath,findLinkMove,shuffleLinks,createMatchState,swapMatch,suggestMatchMove,shuffleMatch} from './classicRules.js';

// A durable rule state contains only data. No client result, quality, stock or seed
// is accepted as proof of a completed game.
export function saveMatchState(s){const out={...s,randomSeed:s.random.state()};delete out.random;return out}
export function restoreMatchState(s){const out={...structuredClone(s),random:seededRandom(s.randomSeed)};delete out.randomSeed;return out}
export function createCraftGame(id,seed,difficulty,equipment=null){
 if(WORKSHOP_GAMES[id])return {engine:'workshop',state:createWorkshopState(makeWorkshopLevel(id,seed,difficulty),equipment),elapsed:0};
 const level=makeLevel(id,{seed,difficulty}),link=[7,11].includes(id);
 return {engine:link?'link':'match',level,elapsed:0,time:0,started:!link,result:null,hintsUsed:0,
  ...(link?{values:makeLinkBoard(level).values,found:0,hints:level.hints,shuffles:level.link.shuffles,combos:0,bestCombo:0,lastPair:-99,randomSeed:(seed^0xCCA)>>>0}:{match:saveMatchState(createMatchState(level))})};
}
export function craftResult(game){return game.engine==='workshop'?game.state.result:game.result}
export function neutralCraftGame(game){
 if(game.engine==='workshop'){const s=game.state;s.holding=false;s.keys={};if(s.kind==='kitchen')neutralKitchen(s);if(s.kind==='brush'&&s.level.schemaVersion===BRUSH_SCHEMA)neutralBrush(s);}
 return game;
}
const allowedKeys=new Set(['type','x','y','value','index','delta','lane','key','down','dir','item','mark','station','a','b']);
export function validCraftEvent(event){
 if(!event||typeof event!=='object'||Array.isArray(event))return false;
 if(event.neutral===true)return Object.keys(event).length===1;
 if(Object.hasOwn(event,'dt'))return Object.keys(event).length===1&&Number.isFinite(event.dt)&&event.dt>=0&&event.dt<=.050000001;
 const a=event.action;if(Object.keys(event).length!==1||!a||typeof a!=='object'||Array.isArray(a)||typeof a.type!=='string'||!/^[-a-zA-Z]{1,32}$/.test(a.type))return false;
 return Object.entries(a).every(([k,v])=>allowedKeys.has(k)&&(typeof v==='number'?Number.isFinite(v)&&Math.abs(v)<=10000:typeof v==='boolean'||typeof v==='string'&&v.length<=80));
}
const finish=(g,passed,quality=55)=>{g.result={passed,quality:Math.max(55,Math.min(100,Math.round(quality))),score:passed?1:0,total:1,stars:passed?quality>=92?3:quality>=78?2:1:0,seconds:g.time,seed:g.level.seed}};
export function applyCraftEvent(game,event){
 if(!validCraftEvent(event))throw Error('Invalid game input');
 if(event.neutral)return neutralCraftGame(game);
 if(Object.hasOwn(event,'dt')){
  game.elapsed+=event.dt;
  if(game.engine==='workshop'){stepWorkshop(game.state,event.dt);game.state.events=[]}
  else if(!game.result&&game.started){game.time+=event.dt;if(game.engine==='link'&&game.time>=game.level.link.seconds)finish(game,false)}
  return game;
 }
 const a=event.action;
 if(game.engine==='workshop'){workshopAction(game.state,a);game.state.events=[];return game}
 if(game.result)return game;
 if(a.type==='start'){game.started=true;return game}
 if(game.engine==='link'){
  const l=game.level.link,random=seededRandom(game.randomSeed);
  if(a.type==='pair'){
   if(!Number.isInteger(a.a)||!Number.isInteger(a.b)||a.a<0||a.b<0||a.a>=game.values.length||a.b>=game.values.length||!linkPath(game.values,l.columns,l.rows,a.a,a.b))throw Error('Invalid link pair');
   game.started=true;game.values[a.a]=game.values[a.b]=null;game.found++;game.combos=game.time-game.lastPair<6?game.combos+1:1;game.bestCombo=Math.max(game.bestCombo,game.combos);game.lastPair=game.time;
   if(game.found===l.columns*l.rows/2)finish(game,true,75+20*Math.max(0,1-game.time/l.seconds)+Math.min(5,game.bestCombo)-game.hintsUsed*2);
   else if(!findLinkMove(game.values,l.columns,l.rows))game.values=shuffleLinks(game.values,l.columns,l.rows,random).values;
  }else if(a.type==='hint'){if(game.hints<=0||!findLinkMove(game.values,l.columns,l.rows))throw Error('No link hints');game.hints--;game.hintsUsed++}
  else if(a.type==='shuffle'){if(game.shuffles<=0)throw Error('No link shuffles');game.shuffles--;game.values=shuffleLinks(game.values,l.columns,l.rows,random).values}
  else throw Error('Invalid classic input');
  game.randomSeed=random.state();
 }else{
  const s=restoreMatchState(game.match);
  if(a.type==='swap'){
   if(!Number.isInteger(a.a)||!Number.isInteger(a.b)||a.a<0||a.b<0||a.a>=36||a.b>=36)throw Error('Invalid match indices');
   const r=swapMatch(s,a.a,a.b);if(!r.valid)throw Error('Invalid match move');
   if(r.won)finish(game,true,75+Math.min(17,s.moves/s.initialMoves*24)+Math.min(8,s.bestCombo*2)-game.hintsUsed*2);else if(r.lost)finish(game,false);
  }else if(a.type==='hint'){if(s.hints<=0||!suggestMatchMove(s))throw Error('No match hints');s.hints--;game.hintsUsed++}
  else if(a.type==='shuffle'){if(!shuffleMatch(s,true))throw Error('No match shuffles')}
  else throw Error('Invalid classic input');
  game.match=saveMatchState(s);
 }
 return game;
}
export function applyCraftTrace(game,events){if(!Array.isArray(events)||events.length>2048)throw Error('Invalid input batch');for(const e of events)applyCraftEvent(game,e);return game}
