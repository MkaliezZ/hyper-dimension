// A view poll can land between any two animation frames. Wait for the renderer
// to consume that receipt, then detach one coherent observation for assertions.
export async function captureLanMotionSnapshot(page,{timeout=30000}={}){
 const handle=await page.waitForFunction(()=>{
  const s=window.lanInspect?.();if(!s?.view?.room||!s.map)return false;
  const samples=(s.view.room.residents||[]).map(p=>({p:p.position,a:s.map.members.find(a=>a.id===p.actorId)})).filter(({a})=>!!a);
  if(!samples.length||samples.some(({p,a})=>a.snapshotAt!==p.updatedAt))return false;
  return structuredClone(samples);
 },null,{timeout,polling:'raf'});
 try{return await handle.jsonValue();}finally{await handle.dispose();}
}
