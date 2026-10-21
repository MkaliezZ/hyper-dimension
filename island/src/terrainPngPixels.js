// Bounded RGB8/RGBA8 terrain decoding. Keep pixels in a CPU image before the
// existing CPU resize/mask pass; no browser Blob-image GPU readback is needed.
// Other PNG encodings/colour profiles retain the caller's native decoder.
export const TERRAIN_PNG_LIMITS=Object.freeze({encodedBytes:64*1024*1024,dimension:4096,pixels:12_000_000});
const error=(code)=>Object.assign(Error(code),{code});
const signature=[137,80,78,71,13,10,26,10],table=new Uint32Array(256);
for(let n=0;n<256;n++){let value=n;for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;table[n]=value>>>0;}
function crc(bytes,start,end){let value=0xffffffff;for(let n=start;n<end;n++)value=table[(value^bytes[n])&255]^(value>>>8);return(value^0xffffffff)>>>0;}
function concat(chunks,length){const result=new Uint8Array(length);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;}
export async function readTerrainPNG(response){
 const announced=Number(response.headers?.get?.('Content-Length'));
 if(announced>TERRAIN_PNG_LIMITS.encodedBytes){try{await response.body?.cancel?.();}catch{}throw error('terrain_png_encoded_budget');}
 if(!response.body?.getReader){const result=new Uint8Array(await response.arrayBuffer());if(result.length>TERRAIN_PNG_LIMITS.encodedBytes)throw error('terrain_png_encoded_budget');return result;}
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>TERRAIN_PNG_LIMITS.encodedBytes)throw error('terrain_png_encoded_budget');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 return concat(chunks,length);
}
async function inflate(bytes,expected){
 if(typeof DecompressionStream!=='function')throw error('terrain_png_unsupported');
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader(),result=new Uint8Array(expected);let at=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;if(at+value.length>expected)throw error('terrain_png_decoded_budget');result.set(value,at);at+=value.length;}
 }catch(e){throw typeof e.code==='string'&&e.code.startsWith('terrain_png_')?e:error('terrain_png_compression');}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(at!==expected)throw error('terrain_png_scanline_length');return result;
}
function paeth(a,b,c){const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;}
export async function decodeTerrainPNG(input,{yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length>TERRAIN_PNG_LIMITS.encodedBytes)throw error('terrain_png_encoded_budget');
 if(bytes.length<45||!signature.every((v,n)=>bytes[n]===v))throw error('terrain_png_signature');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),parts=[];let width=0,height=0,channels=0,seenHeader=false,seenData=false,dataEnded=false,ended=false,length=0;
 for(let at=8;at<bytes.length;){
  if(at+12>bytes.length)throw error('terrain_png_chunk_length');const size=view.getUint32(at),end=at+size+12;if(end>bytes.length)throw error('terrain_png_chunk_length');
  const type=String.fromCharCode(...bytes.subarray(at+4,at+8));if(!/^[A-Za-z]{4}$/.test(type)||crc(bytes,at+4,end-4)!==view.getUint32(end-4))throw error('terrain_png_crc');
  if(!seenHeader&&type!=='IHDR')throw error('terrain_png_header');
  if(type==='IHDR'){
   if(seenHeader||size!==13)throw error('terrain_png_header');seenHeader=true;width=view.getUint32(at+8);height=view.getUint32(at+12);
   if(!width||!height||width>TERRAIN_PNG_LIMITS.dimension||height>TERRAIN_PNG_LIMITS.dimension||width*height>TERRAIN_PNG_LIMITS.pixels)throw error('terrain_png_budget');
   const depth=bytes[at+16],colour=bytes[at+17];if(depth!==8||![2,6].includes(colour)||bytes[at+18]!==0||bytes[at+19]!==0||bytes[at+20]!==0)throw error('terrain_png_unsupported');channels=colour===2?3:4;
  }else if(type==='IDAT'){
   if(dataEnded)throw error('terrain_png_data_order');seenData=true;parts.push(bytes.subarray(at+8,end-4));length+=size;
  }else{
   if(seenData)dataEnded=true;
   if(type==='IEND'){if(size||!seenData||end!==bytes.length)throw error('terrain_png_end');ended=true;break;}
   if(['iCCP','gAMA','cHRM','cICP','mDCV','cLLI','sBIT','tRNS','acTL','PLTE'].includes(type))throw error('terrain_png_unsupported');
   if(type==='sRGB'&&(size!==1||bytes[at+8]>3))throw error('terrain_png_unsupported');
   if(type[0]===type[0].toUpperCase()&&type!=='PLTE')throw error('terrain_png_unsupported');
  }
  at=end;
 }
 if(!ended||!length)throw error('terrain_png_end');
 const stride=width*channels,raw=await inflate(concat(parts,length),(stride+1)*height),data=new Uint8ClampedArray(width*height*4),previous=new Uint8Array(stride),current=new Uint8Array(stride);let at=0,out=0;
 for(let y=0;y<height;y++){
  const filter=raw[at++];if(filter>4)throw error('terrain_png_filter');
  for(let x=0;x<stride;x++){const a=x>=channels?current[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0,predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?(a+b)>>>1:paeth(a,b,c);current[x]=(raw[at++]+predictor)&255;}
  for(let x=0;x<stride;x+=channels){data[out++]=current[x];data[out++]=current[x+1];data[out++]=current[x+2];data[out++]=channels===4?current[x+3]:255;}
  previous.set(current);if(y>0&&(y&31)===0)await yieldTask();
 }
 return{width,height,data};
}
