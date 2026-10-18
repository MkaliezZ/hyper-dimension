// Execute one authoritative transaction at a time. An independent foreground
// setting can pass work that has not started, but never an active transaction
// or an explicit checkpoint. Alternate promoted settings with FIFO work.
export function createActionQueue(){
 const jobs=[];let running=false,lastForeground=false;
 async function drain(){
  if(running)return;running=true;
  try{
   while(jobs.length){
    const barrier=jobs.findIndex(job=>job.barrier),limit=barrier<0?jobs.length:barrier;
    const promoted=lastForeground?-1:jobs.findIndex((job,index)=>index<limit&&job.foreground);
    const [job]=jobs.splice(promoted<0?0:promoted,1);lastForeground=job.foreground;
    try{job.resolve(await job.run());}catch(error){job.reject(error);}
   }
  }finally{running=false;}
 }
 return {enqueue(run,{foreground=false,barrier=false}={}){
  const result=new Promise((resolve,reject)=>jobs.push({run,foreground,barrier,resolve,reject}));
  queueMicrotask(drain);return result;
 }};
}
