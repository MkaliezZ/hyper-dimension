import {terrainViewport} from './mapTileLayout.js';
export const SEA_CELL=384;
let status={ready:false};
export function seaTileStatus(){return {...status};}
export function seaTilePlacements(view,extent,cell=SEA_CELL){
 const minX=Math.max(0,Math.floor(view.x/cell)),minY=Math.max(0,Math.floor(view.y/cell)),maxX=Math.min(Math.ceil(extent.width/cell)-1,Math.floor((view.x+view.w)/cell)),maxY=Math.min(Math.ceil(extent.height/cell)-1,Math.floor((view.y+view.h)/cell)),tiles=[];
 for(let row=minY;row<=maxY;row++)for(let col=minX;col<=maxX;col++)tiles.push({col,row,x:col*cell,y:row*cell,flipX:col%2===1,flipY:row%2===1,size:cell});
 return tiles;
}
export function drawSeaTiles(ctx,image,theme,extent){
 if(!image.complete||!image.naturalWidth)return false;
 const view=terrainViewport(ctx.getTransform(),ctx.canvas.width,ctx.canvas.height);if(!view)return false;
 ctx.save();ctx.beginPath();ctx.rect(0,0,extent.width,extent.height);ctx.clip();ctx.imageSmoothingEnabled=theme!=='pixel';ctx.imageSmoothingQuality='high';
 // Reflection makes every shared edge sample the same source edge, including corners.
 const tiles=seaTilePlacements(view,extent);
 status={ready:true,theme,worldCell:SEA_CELL,sourceWidth:image.naturalWidth,sourceHeight:image.naturalHeight,visibleTiles:tiles.length};
 for(const t of tiles){
  ctx.save();ctx.translate(t.x+(t.flipX?t.size:0),t.y+(t.flipY?t.size:0));ctx.scale(t.flipX?-1:1,t.flipY?-1:1);ctx.drawImage(image,0,0,t.size,t.size);ctx.restore();
 }
 ctx.restore();return true;
}
