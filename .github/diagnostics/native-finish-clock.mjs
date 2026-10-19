import assert from 'node:assert/strict';

export const FINISH_CLOCK_MARKER='HD_OWNED_FINISH_CLOCK:';
// Observation only: the native fetch, signal, timer, response and request bytes
// pass through unchanged. Timestamps originate in the same dedicated Worker.
export const finishClockPrelude=`
const ownedFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=(url,init={})=>{
 let body;try{body=JSON.parse(init.body);}catch{}
 if(init.method==='POST'&&body?.kind==='field'&&body.operation==='finish'){
  const emit=phase=>console.debug(${JSON.stringify(FINISH_CLOCK_MARKER)}+JSON.stringify({requestId:body.requestId,phase,at:performance.now(),origin:performance.timeOrigin}));
  emit('start');init.signal?.addEventListener('abort',()=>emit('abort'),{once:true});
 }
 return ownedFetch(url,init);
};
`;

export function assertNativeFinishClock(events,requestId){
 const rows=events.filter(row=>row.requestId===requestId),starts=rows.filter(row=>row.phase==='start'),aborts=rows.filter(row=>row.phase==='abort');
 assert.equal(starts.length,2,'Exactly one identical completion replay must reach native fetch');
 assert.equal(aborts.length,1,'The original native fetch must actually expire');
 assert(rows.every(row=>Number.isFinite(row.at)&&row.at>=0&&Number.isFinite(row.origin)&&row.origin===starts[0].origin),'One native Worker clock must own all observed times');
 const abortMs=aborts[0].at-starts[0].at,retryMs=starts[1].at-starts[0].at;
 assert(abortMs>=11500,'Retain the original12000ms fetch expiration gate');
 assert(retryMs>=11500,'Retain the original completion replay timing gate');
 assert(starts[1].at-aborts[0].at>=200,'The existing250ms retry delay must follow the real abort');
 return{abortMs,retryMs,clockOrigin:starts[0].origin,clock:'native Worker performance.now',originalFetchTimeoutMs:12000};
}
