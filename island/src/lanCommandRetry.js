// A movement, arrival or departure receipt can be lost after the server applied it.
// Reuse the durable request ID and room revision; the server replays its receipt.
const transient=e=>e?.code==='lan_busy'||e?.code==='lan_move_rate'||e?.status>=500||
  (!e?.status&&['TypeError','AbortError','TimeoutError','SyntaxError'].includes(e?.name));
export async function requestLanCommand(request,body,{sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  for(let attempt=0;;attempt++){
    try{return await request('action',body);}
    catch(error){
      if(!['room_move','room_leave','room_join'].includes(body.operation)||attempt>=2||!transient(error))throw error;
      await sleep(attempt===0?300:800);
    }
  }
}
