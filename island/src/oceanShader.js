import {WORLD} from './world.js';
import {createOceanSurfaceClient} from './oceanSurfaceClient.js';
export {coastDistanceTexture} from './oceanShaderCore.js';
const surfaces=new WeakMap();
export function releaseOceanShader(canvas){const surface=surfaces.get(canvas);if(surface){surface.dispose();surfaces.delete(canvas);}}
export function oceanShaderStatus(canvas){return surfaces.get(canvas)?.inspect()||{backend:'canvas-compatible',ready:false,renderThread:'worker'};}
export function drawOceanShader(target,field,theme,time,env){
 if(typeof Worker!=='function'||typeof OffscreenCanvas!=='function')return false;
 let surface=surfaces.get(target.canvas);if(!surface){surface=createOceanSurfaceClient();surfaces.set(target.canvas,surface);}
 const m=target.getTransform().inverse(),bitmap=surface.frame(field,{width:target.canvas.width,height:target.canvas.height,worldWidth:WORLD.width,worldHeight:WORLD.height,inverse:[m.a,m.b,0,m.c,m.d,0,m.e,m.f,1],theme,time,night:env?.night||0});
 if(!bitmap)return false;
 target.save();try{target.setTransform(1,0,0,1,0,0);target.drawImage(bitmap,0,0);}finally{target.restore();}return true;
}
