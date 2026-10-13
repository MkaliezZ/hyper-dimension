// Native art stays on disk; decoded surfaces match the actual canvas scale.
export function terrainDensity(matrix,tiles,limitBytes){
 const projected=Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d));
 const desired=Math.max(1,Math.ceil(projected*4)/4),area=tiles.reduce((sum,t)=>sum+t.bounds.w*t.bounds.h,0);
 const affordable=area?Math.max(1,Math.floor(Math.sqrt(limitBytes*.85/(area*4))*4)/4):desired;
 return Math.min(desired,affordable);
}
export function terrainSurfaceSize(source,tile,density=Infinity){
 const factor=Math.min(1,density*Math.max(tile.bounds.w/source.width,tile.bounds.h/source.height));
 return {width:Math.max(1,Math.round(source.width*factor)),height:Math.max(1,Math.round(source.height*factor))};
}
