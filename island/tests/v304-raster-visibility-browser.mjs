import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';

const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v304/native-raster-visibility');await mkdir(out,{recursive:true});
const source=(await readFile(join(root,'src/rasterQuality.js'),'utf8')).replaceAll('\r\n','\n');
const baseline=source.replace("import {rasterOutsideCanvas} from './rasterVisibility.js';\n",'').replace(',draws:0,culled:0','').replace(' if(rasterOutsideCanvas(ctx,e.surface,rect)){stats.culled++;return;}stats.draws++;\n','');
const pin='60e9f523692c3723539a82542b260212fa574f2d316faf8a7cc23ce78f5355e4';assert.equal(createHash('sha256').update(baseline).digest('hex'),pin,'The comparison must retain the actual pre-change implementation');
const report={scope:'Owned native Canvas and the actual local building/residence/dock artwork in both styles, compared to the SHA-pinned original raster module before culling. Includes real reconstruction Workers, both backing densities, transforms, source crops, reverse rectangles, filters, shadows and destructive compositing. No game state, clock, providers, user browser or human acceptance.',baselineNormalizedSha256:pin,cases:[],errors:[],passed:false};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><main>Owned native raster comparison</main>');return;}
 if(url.pathname==='/src/raster-before-v304.js'){res.setHeader('Content-Type','text/javascript');res.end(baseline);return;}
 const folder=url.pathname.startsWith('/src/')?root:join(root,'public'),file=resolve(folder,'.'+url.pathname);assert(file.startsWith(folder+sep));assert(url.pathname.startsWith('/src/')||url.pathname.startsWith('/assets/'));res.setHeader('Content-Type',extname(file)==='.js'?'text/javascript':'image/png');res.end(await readFile(file));
 }catch(error){res.statusCode=500;res.end(error.message);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch(browserLaunchOptions());
 const page=await browser.newPage();page.on('pageerror',error=>report.errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const data=await page.evaluate(async()=>{
  const old=await import('/src/raster-before-v304.js'),current=await import('/src/rasterQuality.js'),{HOME_ATLAS_BOUNDS}=await import('/src/homeAtlasBounds.js'),{HOUSE_ATLAS_BOUNDS}=await import('/src/houseAtlasBounds.js');
  const canvas=()=>{const c=document.createElement('canvas');c.width=640;c.height=440;return c;},a=canvas(),b=canvas(),ac=a.getContext('2d',{willReadFrequently:true}),bc=b.getContext('2d',{willReadFrequently:true});
  let oldDraws=0,newDraws=0;const oldDraw=ac.drawImage.bind(ac),newDraw=bc.drawImage.bind(bc);ac.drawImage=(...args)=>{oldDraws++;return oldDraw(...args);};bc.drawImage=(...args)=>{newDraws++;return newDraw(...args);};
  const rows=[];
  for(const theme of ['pixel','origami'])for(const kind of ['buildings','homes','dock']){
   const art=kind==='homes'?HOME_ATLAS_BOUNDS[theme]:HOUSE_ATLAS_BOUNDS[theme],image=new Image();image.src=kind==='dock'?'/assets/dock-'+theme+'-v17.png':art.src;await image.decode();
   old.drawRaster(ac,image,theme,0,0,100,80);current.drawRaster(bc,image,theme,0,0,100,80);
   const started=performance.now();while(old.rasterQualityStatus().pending||current.rasterQualityStatus().pending){if(performance.now()-started>60000)throw Error('Original reconstruction wait exceeded');await new Promise(r=>setTimeout(r,25));}
   const crop=kind==='dock'?{x:0,y:0,w:image.naturalWidth,h:image.naturalHeight}:art.bounds[0];
   const specs=[
    {name:'visible',rect:[60,50,250,190]},
    {name:'offscreen',rect:[-800,40,250,190]},
    {name:'crop-pan',matrix:[1.8,0,0,1.8,-150,20],rect:[crop.x,crop.y,crop.w,crop.h,20,30,250,190]},
    {name:'subpixel-edge',rect:[-249.5,20,250,190]},
    {name:'rotation-shear',matrix:[.86,.5,-.2,.9,360,20],rect:[-10,-10,250,190]},
    {name:'reverse-destination',rect:[300,250,-250,-190]},
    {name:'copy-outside-clears',composite:'copy',rect:[-800,40,250,190]},
    {name:'filtered-overflow',filter:'drop-shadow(45px 0px 12px red)',rect:[-270,40,250,190]},
    {name:'shadow-overflow',shadowOffsetX:800,rect:[-800,40,250,190]},
    {name:'reconstructed-natural-size',rect:[-image.naturalWidth*(theme==='pixel'?1:2)+2,-10]}
   ];
   for(const density of [1,2])for(const spec of specs){
    a.width=b.width=640*density;a.height=b.height=440*density;const before=[oldDraws,newDraws];
    for(const ctx of [ac,bc]){ctx.fillStyle='#526a78';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);const m=spec.matrix||[1,0,0,1,0,0];ctx.setTransform(...m.map(value=>value*density));ctx.globalAlpha=.73;ctx.globalCompositeOperation=spec.composite||'source-over';ctx.filter=spec.filter||'none';ctx.shadowColor='rgba(255,200,20,.9)';ctx.shadowOffsetX=spec.shadowOffsetX||0;}
    old.drawRaster(ac,image,theme,...spec.rect);current.drawRaster(bc,image,theme,...spec.rect);
    const aa=ac.getImageData(0,0,a.width,a.height).data,bb=bc.getImageData(0,0,b.width,b.height).data;let changed=0,max=0;for(let i=0;i<aa.length;i++){const delta=Math.abs(aa[i]-bb[i]);if(delta)changed++;max=Math.max(max,delta);}
    rows.push({theme,kind,density,spec:spec.name,changedChannels:changed,maxDelta:max,originalDraws:oldDraws-before[0],currentDraws:newDraws-before[1]});
   }
  }
  return{cases:rows,original:old.rasterQualityStatus(),current:current.rasterQualityStatus()};
 });
 report.cases=data.cases;report.original=data.original;report.current=data.current;assert.equal(report.cases.length,120);assert(report.cases.every(row=>row.changedChannels===0));assert(report.cases.filter(row=>row.spec==='offscreen').every(row=>row.originalDraws===1&&row.currentDraws===0));assert(report.cases.filter(row=>['copy-outside-clears','filtered-overflow','shadow-overflow'].includes(row.spec)).every(row=>row.currentDraws===1));assert.equal(data.original.ready,data.current.ready);assert.equal(data.original.processed,data.current.processed);assert.equal(data.original.failures,0);assert.equal(data.current.failures,0);assert(data.current.culled>=12);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,culled:report.current?.culled,failure:report.failure}));}
