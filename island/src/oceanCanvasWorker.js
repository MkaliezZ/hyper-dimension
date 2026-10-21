import {serveGpuWorkerEndpoint} from './gpuWorkerEndpoint.js';
import {createCanvasOceanField,renderCanvasOcean} from './oceanCanvasRenderer.js';

const fields=new Map(),LIMIT=256*1024*1024;
let canvas=null,flight=null,fieldBytes=0;
const send=(data,transfer=[])=>self.postMessage(data,transfer);
function retire(id){const field=fields.get(id);if(!field)return;field.waterMask.width=field.waterMask.height=0;fields.delete(id);fieldBytes-=field.bytes;}
function integer(n){return Number.isInteger(n)&&n>0;}
const receive=async({data})=>{
 try{
  if(data.kind==='field'){
   const {width,height,water,cell,fieldId}=data;
   if(!integer(width)||!integer(height)||width*height>4*1024*1024||!Number.isFinite(cell)||cell<=0||water?.length!==width*height)throw Error('canvas_ocean_field_budget');
   const bytes=width*height*cell*cell*4;
   if(!Number.isSafeInteger(bytes)||bytes>LIMIT)throw Error('canvas_ocean_field_budget');
   retire(fieldId);
   while(fields.size>=2||fieldBytes+bytes>LIMIT)retire(fields.keys().next().value);
   const field=createCanvasOceanField({width,height,water,cell});field.bytes=bytes;
   fields.set(fieldId,field);fieldBytes+=bytes;send({kind:'registered',fieldId});return;
  }
  if(data.kind!=='frame')return;
  const frame=data.frame,field=fields.get(frame.fieldId);
  if(!field)throw Error('canvas_ocean_field_missing');
  if(flight)throw Error('canvas_ocean_frame_overlap');
  if(!integer(frame.width)||!integer(frame.height)||frame.width>16384||frame.height>16384||
   fieldBytes+frame.width*frame.height*4*5>LIMIT||frame.matrix?.length!==6||
   !frame.matrix.every(Number.isFinite)||!frame.view||!['x','y','w','h'].every(k=>Number.isFinite(frame.view[k]))||
   !Number.isFinite(frame.time)||!['pixel','origami'].includes(frame.theme))throw Error('canvas_ocean_frame_budget');
  const job={frame};flight=job;
  if(!canvas)canvas=new OffscreenCanvas(frame.width,frame.height);
  if(canvas.width!==frame.width)canvas.width=frame.width;
  if(canvas.height!==frame.height)canvas.height=frame.height;
  const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(...frame.matrix);ctx.imageSmoothingEnabled=frame.theme!=='pixel';
  renderCanvasOcean(ctx,field,frame.theme,frame.time,{night:frame.night||0},frame.view);
  // Complete the actual 2D producer in its own Worker, without rebuilding or
  // recoloring any pixels. The readback is not used as replacement artwork.
  // Its allocation is included in the aggregate budget above.
  ctx.getImageData(0,0,canvas.width,canvas.height);
  const bitmap=await createImageBitmap(canvas);
  if(flight!==job){bitmap.close();return;}
  try{send({kind:'frame',requestId:frame.requestId,bitmap},[bitmap]);flight=null;}
  catch(error){bitmap.close();throw error;}
 }catch(error){flight=null;send({kind:'fatal',error:error.message});}
};

serveGpuWorkerEndpoint(receive);
