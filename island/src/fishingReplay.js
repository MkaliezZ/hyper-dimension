
import {startFishingRound,fishingAction,tickFishing,validFishingMatch} from './fishingRules.js';
const fail=()=>{throw Error('Invalid fishing input');};
export function createFishingReplay(match){return {engine:'fishing',match:structuredClone(match),elapsed:match.elapsed};}
export function applyFishingEvent(g,e){
 if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(k=>!['dt','action','neutral'].includes(k)))fail();
 if(e.neutral!==undefined){if(e.neutral!==true||Object.keys(e).length!==1)fail();if(g.match.current)g.match.current.holding=false;return;}
 if(e.dt!==undefined){if(Object.keys(e).length!==1||!Number.isFinite(e.dt)||e.dt<=0||e.dt>.05)fail();tickFishing(g.match,e.dt);g.elapsed=g.match.elapsed;return;}
 const a=e.action;if(Object.keys(e).length!==1||!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['type','x','y'].includes(k)))fail();
 if(a.type==='next'){if(Object.keys(a).length!==1||!startFishingRound(g.match))fail();return;}
 if(!['point','down','up'].includes(a.type)||a.type==='up'&&Object.keys(a).length!==1||(a.x!==undefined||a.y!==undefined)&&(!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<0||a.x>960||a.y<0||a.y>540)||a.type==='point'&&a.x===undefined)fail();
 if(!fishingAction(g.match,a))fail();
}
export function validFishingReplay(g){return g?.engine==='fishing'&&validFishingMatch(g.match)&&Number.isFinite(g.elapsed)&&g.elapsed===g.match.elapsed;}
