import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='qa/v45/art-recheck';await mkdir(out,{recursive:true});
const rejected=['facilities-pixel-v45.png','facilities-origami-v45.png','facilities-pixel-v45-fixed.png','facilities-origami-v45-fixed.png'];
const report={at:new Date().toISOString(),scope:'Read-only live static assets and actual Canvas/SVG renderer; no game load, save writes or model calls.',rejected:[],states:[],services:[],errors:[]};
let browser;
try{
 for(const name of rejected){await access('qa/v45/rejected-assets/'+name);await assert.rejects(access('public/assets/'+name));report.rejected.push(name);}
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const [theme,port] of [['pixel',4173],['origami',4174]]){
 const base='http://127.0.0.1:'+port;
 const files=['src/facilityArtModel.js','src/facilityArtFrames.js','src/artStore.js','src/functionalArt.js','public/assets/facilities-'+theme+'-components-v45.png','public/assets/facility-cup-'+theme+'-v45.png','public/assets/facility-nursery-back-'+theme+'-v45.png'];
 for(const file of files){const r=await fetch(base+'/'+file.replace(/^public\//,''));assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(await readFile(file)).digest('hex'));}
 for(const file of rejected)assert.equal((await fetch(base+'/assets/'+file)).status,404);
 report.services.push({theme,port,matchingFiles:files.length,rejectedDraftsReturn404:true});
 const page=await browser.newPage({viewport:{width:1600,height:540}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/__facility-review',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#edf2e8;color:#473924;font-family:Arial}h1{font-size:23px;margin:20px 24px 0}#grid{display:grid;grid-template-columns:repeat(4,1fr);padding:16px;gap:8px}article{background:#f9f4e8;border:1px solid #d1c0a6;text-align:center}b{display:block;padding:12px;font-size:18px}canvas{display:block;width:365px;height:385px;margin:auto}.svg{display:none}</style><h1 id="title"></h1><section id="grid"></section>'}));
 await page.goto(base+'/__facility-review');
 await page.evaluate(async theme=>{
 const art=await import('/src/functionalArt.js'),store=await import('/src/artStore.js'),model=await import('/src/facilityArtModel.js'),frames=await import('/src/facilityArtFrames.js'),catalog=await import('/src/facilityCatalog.js');
 const start=performance.now();while(!art.functionalArtStatus()[theme]?.loaded||!store.teaCupArtStatus(theme).loaded){if(performance.now()-start>15000)throw Error('Image load timeout');await new Promise(r=>setTimeout(r,50));}
 window.review={...art,...store,...model,...frames,...catalog};document.getElementById('title').textContent=(theme==='pixel'?'像素版':'折纸版')+' · 游戏实际渲染 · 三种设施 / 四个视角';
 const grid=document.getElementById('grid');
 for(const [row,item] of ['c14_6','c6_8','c1_9'].entries())for(let rotation=0;rotation<4;rotation++){
 const a=document.createElement('article');a.innerHTML='<b>'+['滴灌桶','育养盒','茶炉 · 固定三只杯子'][row]+' / '+['正面','右侧','背面','左侧'][rotation]+'</b><canvas width="365" height="385"></canvas>';grid.append(a);
 const ctx=a.querySelector('canvas').getContext('2d'),f=frames.FACILITY_ART_FRAMES[theme].rows[row][rotation],d=catalog.functionalDefinition(item);
 const scale=Math.min(5.5,340/(d.shape.h*f.w/f.h));ctx.translate(182,365);ctx.scale(scale,scale);art.drawFunctionalFacility(ctx,{item,id:'review',rotation,x:0,y:0},theme);
 }
 },theme);
 await page.screenshot({path:out+'/'+theme+'-facilities-reviewed.png',fullPage:true});
 const states=await page.evaluate(theme=>{
 const {drawFunctionalFacility,teaCupLayout,teaCupMarkup,FACILITY_ART_FRAMES}=window.review,grid=document.getElementById('grid');grid.innerHTML='';const result=[];
 document.getElementById('title').textContent=(theme==='pixel'?'像素版':'折纸版')+' · 茶炉逐状态复核 · 实体杯固定三只，液面随余量改变';
 for(let servings=0;servings<=3;servings++)for(let rotation=0;rotation<4;rotation++){
 const a=document.createElement('article');a.innerHTML='<b>剩余 '+servings+' 杯茶 / '+['正面','右侧','背面','左侧'][rotation]+'</b><canvas width="365" height="385"></canvas><div class="svg">'+teaCupMarkup(theme,rotation,servings)+'</div>';grid.append(a);
 const ctx=a.querySelector('canvas').getContext('2d'),original=ctx.drawImage.bind(ctx);let cupDraws=0;ctx.drawImage=(im,...args)=>{if(im.src.includes('facility-cup-'))cupDraws++;original(im,...args)};ctx.translate(182,365);ctx.scale(5.5,5.5);
 drawFunctionalFacility(ctx,{item:'c1_9',id:'review',rotation,x:0,y:0},theme,{s:{functionalFacilities:{units:{review:{phase:'ready',enabled:false,servings}}}},now:0});
 const f=FACILITY_ART_FRAMES[theme].rows[2][rotation],layout=teaCupLayout(theme,rotation,servings);
 result.push({theme,rotation,servings,cupDraws,svgCups:a.querySelectorAll('[data-tea-cup]').length,svgFilled:a.querySelectorAll('[data-filled="true"]').length,inFrame:layout.every(c=>c.x>=0&&c.y>=0&&c.x+c.w<=f.w&&c.y+c.h<=f.h),separateSilhouettes:layout.every((c,i)=>layout.every((d,j)=>i===j||Math.max(0,Math.min(c.x+c.w,d.x+d.w)-Math.max(c.x,d.x))*Math.max(0,Math.min(c.y+c.h,d.y+d.h)-Math.max(c.y,d.y))<Math.min(c.w*c.h,d.w*d.h)*.2))});
 }return result;
 },theme);
 for(const s of states){assert.equal(s.cupDraws,3);assert.equal(s.svgCups,3);assert.equal(s.svgFilled,s.servings);assert.equal(s.inFrame,true);assert.equal(s.separateSilhouettes,true);}
 report.states.push(...states);await page.screenshot({path:out+'/'+theme+'-tea-states-reviewed.png',fullPage:true});await page.close();
 }
 assert.equal(report.states.length,32);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser?.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,states:report.states.length,services:report.services,failure:report.failure}));}
