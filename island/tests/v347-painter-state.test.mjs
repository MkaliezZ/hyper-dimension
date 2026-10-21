import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const folder=fileURLToPath(new URL('../src/',import.meta.url));
async function fixture(kind,failed=false){
 const state={globalAlpha:.73,fillStyle:'#123456',font:'17px serif',textAlign:'right',strokeStyle:'#234567',lineWidth:7},ctx={...state},calls=[];
 for(const name of ['beginPath','ellipse','fill','fillRect','strokeRect','fillText','arc'])ctx[name]=(...args)=>calls.push([name,...args]);
 ctx.save=ctx.restore=()=>{throw Error('Unexpected native state-stack copy');};
 const api={},context={api,Image:class{complete=true;naturalWidth=256;},registerThemeArtwork(){},createBoatVisualMotion:()=>({}),HARBOR:{entrance:{x:20,y:20},gate:{x:40,y:30},boarding:{x:50,y:50}},harborArtRect:()=>({x:0,y:0,w:100,h:100}),PORTFOLIO_SITE:{building:{x:100,y:100,w:200,h:100},board:{x:200,y:200}},drawRaster(_ctx,_image,theme,...rect){calls.push(['raster',theme,...rect]);if(failed)throw Error('owned-artwork-failed');}};
 const name=kind==='harbor'?'harbor.js':'portfolioArt.js',source=(await readFile(folder+name,'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
 vm.runInNewContext(source+'\napi.draw='+ (kind==='harbor'?'drawHarbor':'drawPortfolioHall')+';',context);
 return{state,ctx,calls,draw:()=>api.draw(ctx,'origami',1.234)};
}
for(const kind of ['harbor','hall']){
 test(kind+' preserves all changed caller state while retaining its artwork and animation',async()=>{
  const f=await fixture(kind);f.draw();for(const[key,value]of Object.entries(f.state))assert.equal(f.ctx[key],value,key);assert(f.calls.some(c=>c[0]==='raster'));assert(f.calls.some(c=>c[0]===(kind==='harbor'?'ellipse':'arc')));if(kind==='hall')assert(f.calls.some(c=>c[0]==='fillText'&&c[1]==='访客留言'));
 });
 test(kind+' restores caller state after an artwork failure without a false successful paint',async()=>{
  const f=await fixture(kind,true);assert.throws(f.draw,/owned-artwork-failed/);for(const[key,value]of Object.entries(f.state))assert.equal(f.ctx[key],value,key);
 });
}
