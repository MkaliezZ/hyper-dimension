import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
const {decodeTerrainPNG,readTerrainPNG,TERRAIN_PNG_LIMITS}=await import(new URL('../src/terrainPngPixels.js',import.meta.url));
// Independent fixture encoder: bitwise CRC, explicit predictor selection and
// zlib from Node, rather than reusing the production decoder's helpers.
function chunk(type,data=Buffer.alloc(0)){
 const t=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);let c=0xffffffff;
 for(const value of Buffer.concat([t,data])){c^=value;for(let bit=0;bit<8;bit++)c=(c>>>1)^(c&1?0xedb88320:0);}sum.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([size,t,data,sum]);
}
function header(w,h,{depth=8,colour=2,interlace=0}={}){const b=Buffer.alloc(13);b.writeUInt32BE(w);b.writeUInt32BE(h,4);b[8]=depth;b[9]=colour;b[12]=interlace;return chunk('IHDR',b);}
const sig=Buffer.from([137,80,78,71,13,10,26,10]);
function png({w=7,h=5,channels=3,filters=[0],before=[],after=[],split=false,scanlines,options={}}={}){
 const pixels=Buffer.from(Array.from({length:w*h*channels},(_,n)=>(n*71+(n%7)*31)%256)),rows=[];
 for(let y=0;y<h;y++){
  const f=filters[y%filters.length],row=Buffer.alloc(w*channels+1);row[0]=f;
  for(let x=0;x<w*channels;x++){
   const a=x>=channels?pixels[y*w*channels+x-channels]:0,b=y?pixels[(y-1)*w*channels+x]:0,c=y&&x>=channels?pixels[(y-1)*w*channels+x-channels]:0;
   let predictor=0;if(f===1)predictor=a;if(f===2)predictor=b;if(f===3)predictor=Math.floor((a+b)/2);
   if(f===4){const p=a+b-c,list=[a,b,c].map((v,i)=>({v,i,d:Math.abs(p-v)})).sort((x,y)=>x.d-y.d||x.i-y.i);predictor=list[0].v;}
   row[x+1]=(pixels[y*w*channels+x]-predictor+256)%256;
  }rows.push(row);
 }
 const raw=scanlines||Buffer.concat(rows),compressed=deflateSync(raw),parts=split?[compressed.subarray(0,1),compressed.subarray(1,compressed.length-2),compressed.subarray(compressed.length-2)]:[compressed];
 const expected=new Uint8ClampedArray(w*h*4);for(let n=0;n<w*h;n++){expected.set(pixels.subarray(n*channels,n*channels+3),n*4);expected[n*4+3]=channels===4?pixels[n*channels+3]:255;}
 return{bytes:Buffer.concat([sig,header(w,h,{colour:channels===4?6:2,...options}),...before,...parts.map(p=>chunk('IDAT',p)),...after,chunk('IEND')]),expected};
}
for(const channels of [3,4])for(const filter of [0,1,2,3,4])test(channels+' channels reverse PNG filter '+filter+' including first-row/first-pixel edges',async()=>{
 const {bytes,expected}=png({channels,filters:[filter]}),r=await decodeTerrainPNG(bytes);assert.equal(r.width,7);assert.equal(r.height,5);assert.deepEqual(r.data,expected);
});
test('mixed filters, split zlib/checksum IDAT, ancillary metadata and a subarray offset retain every byte',async()=>{
 const {bytes,expected}=png({h:67,filters:[0,1,2,3,4],split:true,before:[chunk('caBX',Buffer.from('owned fixture')),chunk('sRGB',Buffer.from([0]))]}),wrapped=Buffer.concat([Buffer.alloc(17),bytes,Buffer.alloc(8)]);let yielded=0;
 const r=await decodeTerrainPNG(wrapped.subarray(17,17+bytes.length),{yieldTask:async()=>{yielded++;}});assert.deepEqual(r.data,expected);assert.equal(yielded,2);
});
for(const [w,h]of [[0,1],[1,0],[4097,1],[1,4097],[4000,4000]])test('reject dimensions '+w+'x'+h+' before attempting decompression',async()=>{
 const bytes=Buffer.concat([sig,header(w,h),chunk('IDAT',Buffer.from('not zlib')),chunk('IEND')]);await assert.rejects(decodeTerrainPNG(bytes),e=>e.code==='terrain_png_budget');
});
for(const type of ['iCCP','gAMA','cHRM','cICP','mDCV','cLLI','sBIT','tRNS','acTL','PLTE'])test(type+' is delegated to the native colour/encoding decoder',async()=>{await assert.rejects(decodeTerrainPNG(png({before:[chunk(type,Buffer.from([0]))]}).bytes),e=>e.code==='terrain_png_unsupported');});
for(const options of [{depth:16},{colour:3},{interlace:1}])test('unsupported encoding '+JSON.stringify(options)+' retains the native fallback classification',async()=>{await assert.rejects(decodeTerrainPNG(png({options}).bytes),e=>e.code==='terrain_png_unsupported');});
test('corrupt framing, checksum, duplicate/missing headers and nonconsecutive data fail explicitly',async()=>{
 const original=png().bytes,corrupt=Buffer.from(original),badLength=Buffer.from(original);corrupt[40]^=1;badLength.writeUInt32BE(0xffffffff,33);
 const cases=[['signature',Buffer.from('not png')],['crc',corrupt],['header',Buffer.concat([sig,chunk('caBX'),original.subarray(8)])],['header',Buffer.concat([sig,header(7,5),original.subarray(8)])],['end',original.subarray(0,-12)],['end',Buffer.concat([original,Buffer.from([0])])],['chunk_length',badLength],['data_order',Buffer.concat([sig,header(1,1),chunk('IDAT',Buffer.from([1])),chunk('tEXt'),chunk('IDAT',Buffer.from([2])),chunk('IEND')])]];
 for(const [code,bytes]of cases)await assert.rejects(decodeTerrainPNG(bytes),e=>e.code==='terrain_png_'+code,code);
});
test('inflation cannot exceed or omit the exact expected scanlines; malformed compression and filters never fall back',async()=>{
 for(const [raw,code]of [[Buffer.alloc(4000),'decoded_budget'],[Buffer.alloc(3),'scanline_length'],[Buffer.from([5,0,0,0]),'filter']])await assert.rejects(decodeTerrainPNG(png({w:1,h:1,scanlines:raw}).bytes),e=>e.code==='terrain_png_'+code);
 const invalid=Buffer.concat([sig,header(1,1),chunk('IDAT',Buffer.from([2,3,5,7])),chunk('IEND')]);await assert.rejects(decodeTerrainPNG(invalid),e=>e.code==='terrain_png_compression');
});
test('announced oversized responses are cancelled before reading any body',async()=>{
 let cancelled=0,read=0;await assert.rejects(readTerrainPNG({headers:new Headers({'Content-Length':String(TERRAIN_PNG_LIMITS.encodedBytes+1)}),body:{async cancel(){cancelled++;},getReader(){read++;throw Error('Must not read');}}}),e=>e.code==='terrain_png_encoded_budget');assert.equal(cancelled,1);assert.equal(read,0);
});
test('unknown-size streamed responses stop, cancel and release at the encoded byte budget',async()=>{
 let reads=0,cancelled=0,released=0;const reader={async read(){reads++;return{done:false,value:new Uint8Array(1024*1024)};},async cancel(){cancelled++;},releaseLock(){released++;}};
 await assert.rejects(readTerrainPNG({headers:new Headers(),body:{getReader:()=>reader}}),e=>e.code==='terrain_png_encoded_budget');assert.equal(reads,65);assert.equal(cancelled,1);assert.equal(released,1);
});
test('valid small streamed and buffered bodies preserve their bytes',async()=>{
 const bytes=png().bytes;assert.deepEqual(await readTerrainPNG(new Response(bytes)),new Uint8Array(bytes));assert.deepEqual(await readTerrainPNG({headers:new Headers(),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}),new Uint8Array(bytes));
});
