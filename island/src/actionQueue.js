// Execute one authoritative transaction at a time. An independent foreground
// setting can pass work that has not started, but never an active transaction
// or an earlier explicit checkpoint. A foreground checkpoint may itself pass
// unstarted background work;later jobs still cannot cross it. Alternate
// promoted requests with FIFO work.
export function createActionQueue(){
 const jobs=[];let running=false,lastForeground=false;
 async function drain(){
  if(running)return;running=true;
  try{
   while(jobs.length){
    const barrier=jobs.findIndex(job=>job.barrier);
    const promoted=lastForeground?-1:jobs.findIndex((job,index)=>job.foreground&&(barrier<0||index<=barrier));
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
