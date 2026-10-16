// Use actual monotonic RAF timestamps after bounded visible rendering delays.
// This changes presentation frequency, never the world clock or service receipts.
export function installVisibleSlowFrames({normalMs=75,stallMs=650,every=12}={}){
 const request=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),pending=new Map();let sequence=0;
 window.nativeTaskFramePolicy={normalMs,stallMs,every};
 window.requestAnimationFrame=callback=>{
  const id=++sequence,entry={timer:null,frame:null};pending.set(id,entry);
  entry.timer=setTimeout(()=>{entry.frame=request(at=>{if(!pending.delete(id))return;callback(at);});},id%every===0?stallMs:normalMs);return id;
 };
 window.cancelAnimationFrame=id=>{const entry=pending.get(id);if(!entry)return;pending.delete(id);clearTimeout(entry.timer);if(entry.frame!==null)cancel(entry.frame);};
}
