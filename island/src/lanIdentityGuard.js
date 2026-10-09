// Transient server failures do not invalidate an island's identity.
export function identityDisposition(status,body,expectedId=null){
 if(status===401)return 'expired';
 if(status>=200&&status<300&&typeof body?.account?.id==='string'&&body.account.id)return expectedId&&body.account.id!==expectedId?'changed':'valid';
 return 'retry';
}
export async function readIdentity(fetcher){
 try{const r=await fetcher('/api/lan/me',{cache:'no-store',signal:AbortSignal.timeout(12000)});let body;try{body=await r.json()}catch{}return{status:r.status,body};}
 catch{return{status:0,body:null};}
}
