// Keep the same immutable request ID across explicit busy responses and lost replies.
// Authentication, validation and unknown errors must still fail immediately.
export async function postLanFixture(request,url,options,{attempts=4}={}){
 const trace=[];
 for(let attempt=0;attempt<attempts;attempt++){
  // Playwright only retries ECONNRESET here; HTTP errors still reach the checks below.
  const response=await request.post(url,{...options,maxRetries:2});if(response.ok())return {response,trace};
  const text=await response.text();let body;try{body=JSON.parse(text);}catch{}
  trace.push({status:response.status(),code:body?.code||null,body:text.slice(0,500)});
  if(attempt+1>=attempts||![429,503].includes(response.status())||!['lan_busy','save_busy','world_session_busy','lan_rate'].includes(body?.code))throw Error('LAN fixture POST failed: '+JSON.stringify(trace));
  await new Promise(r=>setTimeout(r,Math.max(250,Math.min(2000,Number(body.retryAfter||1)*1000))));
 }
}
