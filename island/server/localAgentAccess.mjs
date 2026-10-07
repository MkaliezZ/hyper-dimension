// The local agent can access this PC. Reject browser requests from other sites,
// including simple text/plain POSTs, before parsing any agent request body.
export function allowLocalAgentRequest(req,port){
 const expected=new Set(['127.0.0.1:'+port,'localhost:'+port,'[::1]:'+port]);
 if(!expected.has(String(req.headers.host||'').toLowerCase()))return false;
 if(req.headers['sec-fetch-site']==='cross-site')return false;
 const origin=req.headers.origin;
 if(origin){try{const parsed=new URL(origin);if(parsed.protocol!=='http:'||!expected.has(parsed.host.toLowerCase()))return false}catch{return false}}
 if(req.method==='POST'&&!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return false;
 return true;
}

