// A movement receipt may be lost after the server has already applied it.
// Reuse the durable request ID; never turn a retry into another destination.
const transient=e=>e?.code==='lan_busy'||e?.code==='lan_move_rate'||e?.status>=500||
  (!e?.status&&['TypeError','AbortError','TimeoutError','SyntaxError'].includes(e?.name));
export async function requestLanCommand(request,body,{sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  for(let attempt=0;;attempt++){
    try{return await request('action',body);}
    catch(error){
      if(body.operation!=='room_move'||attempt>=2||!transient(error))throw error;
      await sleep(attempt===0?300:800);
    }
  }
}
