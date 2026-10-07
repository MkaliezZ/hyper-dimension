
import {seededRandom} from './gameLevels.js';
import {validCraftEvent} from './craftGameReplay.js';
export function createNightPartyGame(seed,difficulty='normal'){const r=seededRandom(seed);return {engine:'night',seed,elapsed:0,phase:r()*1.4,difficulty,speed:(difficulty==='easy'?2.6:3.1)+r()*.6,round:0,score:0,taps:[]};}
export const nightLight=g=>(Math.sin(g.phase*g.speed-Math.PI/2)+1)/2;
export function applyNightPartyEvent(g,e){
 if(!validCraftEvent(e))throw Error('Invalid party input');
 if(e.neutral)return;
 if(Object.hasOwn(e,'dt')){if(g.round<4){g.elapsed+=e.dt;g.phase+=e.dt;}return;}
 if(e.action.type!=='tap'||Object.keys(e.action).length!==1||g.round>=4)throw Error('Invalid light release');
 const value=nightLight(g),precise=value>=(g.difficulty==='easy'?.25:.35)&&value<=(g.difficulty==='easy'?.75:.65);
 g.taps.push({round:g.round+1,elapsed:g.elapsed,value,precise});g.round++;if(precise)g.score++;
}
export function validNightPartyGame(g){return (g?.difficulty===undefined||['normal','easy'].includes(g.difficulty))&&g?.engine==='night'&&Number.isInteger(g.seed)&&g.seed>=0&&g.seed<=0xffffffff&&Number.isFinite(g.elapsed)&&g.elapsed>=0&&Number.isFinite(g.phase)&&g.phase>=0&&Number.isFinite(g.speed)&&g.speed>=(g.difficulty==='easy'?2.6:3.1)&&g.speed<=(g.difficulty==='easy'?3.2:3.7)&&Number.isInteger(g.round)&&g.round>=0&&g.round<=4&&Number.isInteger(g.score)&&g.score>=0&&g.score<=g.round&&Array.isArray(g.taps)&&g.taps.length===g.round;}
