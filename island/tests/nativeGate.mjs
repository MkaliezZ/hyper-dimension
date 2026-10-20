// Fixture-only deadline: a held route is never evidence of a completed action.
export async function nativeGate(promise,label,{schedule=setTimeout,cancel=clearTimeout}={}){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=schedule(()=>reject(Error('Native fixture gate timed out: '+label)),30000);})]);}
 finally{cancel(timer);}
}
