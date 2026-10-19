import {coastDistanceTexture,createOceanRenderer} from './oceanShaderCore.js';
import {afterGpuCommands} from './gpuCompletion.js';
const fields=new Map();let renderer=null,flight=null;
const send=(data,transfer=[])=>self.postMessage(data,transfer);
function initialize(){
 if(renderer)return renderer;
 renderer=createOceanRenderer(new OffscreenCanvas(300,150),{
  onLost(){flight?.cancel?.();flight=null;send({kind:'lost'});},
  onRestored(){renderer=null;send({kind:'restored'});}
 });return renderer;
}
self.onmessage=({data})=>{
 try{
  if(data.kind==='field'){
   const {width,height,water,cell}=data;
   if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4*1024*1024||!Number.isFinite(cell)||cell<=0||water?.length!==width*height)throw Error('ocean_field_budget');
   const pixels=coastDistanceTexture({width,height,water,cell});fields.set(data.fieldId,{width,height,pixels});while(fields.size>2)fields.delete(fields.keys().next().value);send({kind:'registered',fieldId:data.fieldId});return;
  }
  if(data.kind!=='frame')return;const frame=data.frame,field=fields.get(frame.fieldId);if(!field)throw Error('ocean_field_missing');if(flight)throw Error('ocean_frame_overlap');
  const target=initialize();if(target.lost){send({kind:'lost'});return;}
  const job={frame,cancel:null};flight=job;target.draw(frame,field);
  // Finish the producer's actual GPU work before handing its bitmap to Canvas.
  // No main-thread drawImage can force this shader's pending GPU readback.
  job.cancel=afterGpuCommands(target.gl,()=>{
   if(flight!==job)return;const bitmap=target.canvas.transferToImageBitmap();
   try{send({kind:'frame',requestId:frame.requestId,bitmap},[bitmap]);flight=null;}catch(error){bitmap.close();throw error;}
  },error=>{if(flight!==job)return;flight=null;send(target.gl.isContextLost()?{kind:'lost'}:{kind:'fatal',error:error.message});});
 }catch(error){flight?.cancel?.();flight=null;send({kind:'fatal',error:error.message});}
};
