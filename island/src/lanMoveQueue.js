// Movement is replaceable intent. Only the newest unsent destination is kept;
// confirmed room commands still use the durable request ID owned by lanUI.
export function createLanMoveQueue({roomId,canSend,send,onError,now=()=>performance.now(),delay=220}){
 let queued=null,sending=false,timer=null,lastAck=-Infinity,closed=false;
 function clear(){queued=null;clearTimeout(timer);timer=null;}
 function resume(){
  if(closed||sending||timer||!queued)return;
  if(queued.roomId!==roomId()){clear();return;}
  if(!canSend())return;
  const wait=lastAck+delay-now();
  if(wait>0){timer=setTimeout(()=>{timer=null;resume();},wait);return;}
  const target=queued;queued=null;sending=true;
  Promise.resolve().then(()=>send(target)).catch(e=>{clear();onError(e);}).finally(()=>{sending=false;lastAck=now();resume();});
 }
 return {move(x,y){const id=roomId();if(closed||!id||!Number.isFinite(x)||!Number.isFinite(y))return;queued={operation:'room_move',roomId:id,x,y};resume();},resume,clear,destroy(){closed=true;clear();},inspect:()=>({sending,queued:queued?{...queued}:null})};
}
