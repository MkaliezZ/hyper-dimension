import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {CUSTOM_CONTENT_LIMITS,validateCustomArt} from '../src/customContent.js';

const fail=message=>Object.assign(Error(message),{status:400,code:'cocreation_art_invalid'});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=bytes=>{let value=0xffffffff;for(const b of bytes)value=crcTable[(value^b)&255]^(value>>>8);return (value^0xffffffff)>>>0;};
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
export function inspectCoCreationPNG(input){
 const bytes=Buffer.from(input);
 if(bytes.length<57||bytes.length>CUSTOM_CONTENT_LIMITS.artBytes||!bytes.subarray(0,8).equals(signature))throw fail('请上传不超过 256 KiB 的 PNG 图片');
 let offset=8,width,height,channels,palette=null,transparency=null,ended=false,seenData=false,closedData=false;const parts=[];
 while(offset<bytes.length){
  if(offset+12>bytes.length)throw fail('PNG 数据被截断');
  const n=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),end=offset+12+n;
  if(end>bytes.length||!/^[A-Za-z]{4}$/.test(type)||crc(bytes.subarray(offset+4,offset+8+n))!==bytes.readUInt32BE(offset+8+n))throw fail('PNG 分块长度或校验无效');
  const data=bytes.subarray(offset+8,offset+8+n);
  if(offset===8&&type!=='IHDR')throw fail('PNG 缺少图片头');
  if(type==='IHDR'){
   if(width!==undefined||n!==13)throw fail('PNG 图片头重复或无效');
   width=data.readUInt32BE(0);height=data.readUInt32BE(4);channels=({0:1,2:3,3:1,4:2,6:4})[data[9]];
   if(width<32||width>512||height<32||height>512||data[8]!==8||!channels||data[10]||data[11]||data[12])throw fail('素材需为 32–512 像素、8 位、非交错 PNG');
  }else if(type==='PLTE'){
   if(palette||seenData||!n||n%3||n>768)throw fail('PNG 调色板无效');palette=data;
  }else if(type==='tRNS'){
   if(transparency||seenData)throw fail('PNG 透明度块无效');transparency=data;
  }else if(type==='IDAT'){
   if(closedData)throw fail('PNG 图片数据不连续');seenData=true;parts.push(data);
  }else if(type==='IEND'){
   if(n||!seenData||end!==bytes.length)throw fail('PNG 图片结尾无效');ended=true;break;
  }else{
   if(type==='acTL'||type==='fcTL'||type==='fdAT'||type[0]===type[0].toUpperCase())throw fail('不支持动画 PNG 或未知必需图片块');
  }
  if(seenData&&type!=='IDAT')closedData=true;
  offset=end;
 }
 if(!ended)throw fail('PNG 图片不完整');
 const color=bytes[25];if([0,4].includes(color)&&palette)throw fail('灰度 PNG 不能包含调色板');if(color===3&&(!palette||transparency&&transparency.length>palette.length/3)||color===0&&transparency&&transparency.length!==2||color===2&&transparency&&transparency.length!==6||[4,6].includes(color)&&transparency)throw fail('PNG 颜色或透明度配置无效');
 const stride=width*channels,expected=(stride+1)*height;let raw;
 try{raw=inflateSync(Buffer.concat(parts),{maxOutputLength:expected+1});}catch{throw fail('PNG 图片数据无法解码或超出尺寸');}
 if(raw.length!==expected)throw fail('PNG 图片数据与声明尺寸不符');
 let previous=Buffer.alloc(stride),visible=false;
 for(let y=0;y<height;y++){
  const start=y*(stride+1),filter=raw[start],row=Buffer.from(raw.subarray(start+1,start+1+stride));if(filter>4)throw fail('PNG 行过滤器无效');
  for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0;row[x]=(row[x]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}
  for(let x=0;x<stride;x+=channels){if(color===3){if(row[x]>=palette.length/3)throw fail('PNG 调色板索引越界');visible||=(transparency?.[row[x]]??255)>0;}else if(color===6||color===4)visible||=row[x+channels-1]>0;else if(transparency&&color===0)visible||=row[x]!==transparency.readUInt16BE(0);else if(transparency&&color===2)visible||=[0,1,2].some(i=>row[x+i]!==transparency.readUInt16BE(i*2));else visible=true;}
  previous=row;
 }
 if(!visible)throw fail('素材不能完全透明');
 return {sha256:sha(bytes),width,height,bytes:bytes.length};
}

export function createCoCreationAssets({directory}){
 const root=resolve(directory,'_cocreation','art');
 function path(hash){if(!/^[a-f0-9]{64}$/.test(hash||''))throw fail('素材摘要无效');return join(root,hash+'.png');}
 return {
  async put(bytes){const info=inspectCoCreationPNG(bytes),file=path(info.sha256);await mkdir(root,{recursive:true});try{await writeFile(file,bytes,{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;const existing=await readFile(file);if(!existing.equals(Buffer.from(bytes)))throw fail('已有素材校验失败，原件已保留');}return info;},
  async read(hash){const bytes=await readFile(path(hash));if(sha(bytes)!==hash)throw fail('已有素材校验失败，原件已保留');return {bytes,info:inspectCoCreationPNG(bytes)};},
  async verify(items){for(const item of items){const art=validateCustomArt(item.art);for(const theme of ['pixel','origami']){let result;try{result=await this.read(art[theme].sha256);}catch(error){if(error.code==='ENOENT')throw fail('缺少'+theme+'素材，请先上传两套图片');throw error;}if(result.info.width!==art[theme].width||result.info.height!==art[theme].height)throw fail('素材尺寸与作品声明不符');}}return true;}
 };
}
