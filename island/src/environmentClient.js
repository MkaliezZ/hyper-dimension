import {DEFAULT_CLOCK,copyEnvironmentClock,environmentAt} from './environmentClock.js';
export function createEnvironmentClient({fetchClock=()=>fetch('/api/world/environment',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('environment_unavailable');return r.json();}),now=()=>performance.now(),wallNow=()=>Date.now()}={}){
 let clock={...DEFAULT_CLOCK,epochMs:wallNow()},serverAt=clock.epochMs,receivedAt=now(),sync='connecting',busy=null,started=false,timer=null,error=null,transitionAt=-Infinity,previous=null;
 function accept(view){const next=copyEnvironmentClock(view.clock);if(!Number.isFinite(view.serverNowMs))throw Error('invalid_environment_time');if(next.clockId===clock.clockId&&next.revision<clock.revision)throw Error('stale_environment_clock');const before=sample();clock=next;const after=environmentAt(next,view.serverNowMs);if(before.season!==after.season||before.clockId!==after.clockId||before.revision!==after.revision){previous=before;transitionAt=now();}serverAt=view.serverNowMs;receivedAt=now();sync=view.synchronization||next.source;error=null;}
 function sample(){const target=environmentAt(clock,serverAt+Math.max(0,now()-receivedAt)),transition=Math.min(1,Math.max(0,(now()-transitionAt)/4000));if(previous&&transition<1)for(const key of ['daylight','night','dawn','dusk'])target[key]=previous[key]*(1-transition)+target[key]*transition;return {...target,previousSeason:previous?.season||target.season,transition,synchronization:sync,error};}
 async function refresh(){if(busy)return busy;busy=(async()=>{try{accept(await fetchClock());}catch(e){error='environment_unavailable';sync=started?'cached':'unavailable';}finally{busy=null;}})();return busy;}
 function onVisible(){if(!document.hidden)void refresh();}
 function start(){if(started)return;started=true;void refresh();timer=setInterval(()=>{if(!document.hidden)void refresh();},60000);document.addEventListener('visibilitychange',onVisible);}
 function dispose(){if(timer)clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);started=false;timer=null;}
 return {sample,refresh,start,dispose,accept,descriptor:()=>({...clock})};
}
let shared;
export function worldEnvironment(){return shared??=createEnvironmentClient();}
