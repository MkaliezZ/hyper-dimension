const limit=128*1024*1024;

// A few bounded ranges avoid a slow single CDN connection delaying the entire
// short film. Every byte is still checked against the published file hash.
export async function bufferFilm(url,{sha256,signal,onProgress=()=>{}}={}){
 const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 let received=0;
 async function read(response,expected,total,write){
  const reader=response.body.getReader();let count=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;
   count+=value.length;if(count>expected||received+value.length>limit)throw Error('Showcase range exceeds its byte budget');
   write(value,count-value.length);received+=value.length;onProgress(received,total);
  }}finally{reader.releaseLock();}
  if(count!==expected)throw Error('Showcase range is incomplete');
 }
 try{
  const first=await fetch(url,{signal:controller.signal,headers:{Range:'bytes=0-0'}});let bytes;
  if(first.status===206){
   const match=/^bytes 0-0\/(\d+)$/.exec(first.headers.get('content-range')||''),total=Number(match?.[1]);
   if(!Number.isSafeInteger(total)||total<1||total>limit)throw Error('Invalid showcase range length');
   bytes=new Uint8Array(total);await read(first,1,total,(value,offset)=>bytes.set(value,offset));
   const count=Math.min(4,total-1),span=Math.ceil((total-1)/Math.max(1,count)),tasks=[];
   for(let start=1;start<total;start+=span){const end=Math.min(total-1,start+span-1);
    tasks.push((async()=>{
     const response=await fetch(url,{signal:controller.signal,headers:{Range:`bytes=${start}-${end}`}});
     if(response.status!==206||response.headers.get('content-range')!==`bytes ${start}-${end}/${total}`)throw Error('Invalid showcase range response');
     await read(response,end-start+1,total,(value,offset)=>bytes.set(value,start+offset));
    })());
   }
   await Promise.all(tasks);
  }else if(first.status===200){
   // Servers without ranges retain a single bounded full-file request.
   const length=Number(first.headers.get('content-length'))||0;
   if(length>limit)throw Error('Showcase film exceeds the memory budget');
   const chunks=[];let count=0,reader=first.body.getReader();
   try{for(;;){const {value,done}=await reader.read();if(done)break;count+=value.length;
    if(count>limit)throw Error('Showcase film exceeds the memory budget');chunks.push(value);onProgress(count,length);
   }}finally{reader.releaseLock();}
   if(length&&count!==length)throw Error('Showcase film is incomplete');
   bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  }else throw Error('Video download failed');
  const digest=await crypto.subtle.digest('SHA-256',bytes),actual=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
  if(actual!==sha256)throw Error('Showcase film checksum mismatch');
  signal?.throwIfAborted();return bytes;
 }catch(error){controller.abort();throw error;}
 finally{signal?.removeEventListener('abort',abort);}
}
