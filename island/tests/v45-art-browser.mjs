import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('qa/v45',{recursive:true});
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:resolve('qa/v45/art-empty-saves')},stdio:'ignore'});
const report={scope:'Actual game Canvas and SVG composition. Numerical draw-count plus visual review of saved contact sheets; no player save or external AI calls.',views:[],svg:[],errors:[],badImages:[]};let engine;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+port+'/api/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await engine.newPage({viewport:{width:1600,height:520},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badImages.push(r.url());});
 await page.route('**/__qa-art',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;color:#473924;background:#edf2e8;font-family:Arial}h1{margin:16px 30px 0;font-size:24px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;padding:16px}article{height:438px;background:#f9f4e8;border:1px solid #d1c0a6;position:relative;text-align:center}canvas{width:370px;height:388px;display:block;margin:auto}b{display:block;font-size:18px;padding:8px}.icon{width:340px;height:380px;display:inline-block}.icon svg{width:100%;height:100%}</style></head><body><h1 id="title"></h1><section class="grid" id="grid"></section></body></html>'}));
 await page.goto('http://127.0.0.1:'+port+'/__qa-art');
 for(const theme of ['pixel','origami']){
  const result=await page.evaluate(async theme=>{
   const {drawFunctionalFacility,functionalArtStatus}=await import('/src/functionalArt.js'),{itemMarkup}=await import('/src/artStore.js'),{teaCupLayout}=await import('/src/facilityArtModel.js'),{functionalDefinition}=await import('/src/facilityCatalog.js'),{FACILITY_ART_FRAMES}=await import('/src/facilityArtFrames.js');
   const start=performance.now();while(!(functionalArtStatus()[theme]?.loaded&&functionalArtStatus()[theme]?.cup.loaded)){if(performance.now()-start>15000)throw Error('art failed');await new Promise(r=>setTimeout(r,50));}
   document.getElementById('title').textContent=theme+' · 三设施 × 四视角 · 实际游戏渲染';const grid=document.getElementById('grid');grid.innerHTML='';const records=[];
   for(const [row,item] of ['c14_6','c6_8','c1_9'].entries())for(let rotation=0;rotation<4;rotation++){
    const card=document.createElement('article'),label=document.createElement('b');label.textContent=['滴灌桶','育养盒','三杯茶炉'][row]+' · '+['正面','右侧','背面','左侧'][rotation];card.append(label);const c=document.createElement('canvas');c.width=370;c.height=388;card.append(c);grid.append(card);const ctx=c.getContext('2d');let cups=0;const draw=ctx.drawImage.bind(ctx);ctx.drawImage=(img,...a)=>{if(img.src.includes('facility-cup-'))cups++;return draw(img,...a);};ctx.translate(185,373);const d=functionalDefinition(item),frame=FACILITY_ART_FRAMES[theme].rows[row][rotation],scale=Math.min(5.5,340/(d.shape.h*frame.w/frame.h));ctx.scale(scale,scale);
    drawFunctionalFacility(ctx,{item,id:'demo',rotation,x:0,y:0},theme);records.push({theme,item,rotation,cupRasterCalls:cups,cupLayout:row===2?teaCupLayout(theme,rotation,0):null});
   }
   return records;
  },theme);
  result.forEach(r=>assert.equal(r.cupRasterCalls,r.item==='c1_9'?3:0));report.views.push(...result);await page.screenshot({path:'qa/v45/'+theme+'-facility-contact-sheet.png',fullPage:true});
  const svg=await page.evaluate(async theme=>{const {itemMarkup}=await import('/src/artStore.js');document.getElementById('grid').innerHTML='<article><b>背包 / 配方 · 三杯组件</b><div class="icon">'+itemMarkup('c1_9',theme)+'</div></article>';return {theme,cups:document.querySelectorAll('[data-tea-cup]').length,images:[...document.images].every(x=>x.complete)};},theme);
  assert.equal(svg.cups,3);report.svg.push(svg);await page.waitForTimeout(400);await page.screenshot({path:'qa/v45/'+theme+'-tea-icon.png'});
  const filled=await page.evaluate(async theme=>{const {drawFunctionalFacility}=await import('/src/functionalArt.js');const grid=document.getElementById('grid');grid.innerHTML='';const records=[];for(let rotation=0;rotation<4;rotation++){const article=document.createElement('article');article.innerHTML='<b>待客三杯 · '+rotation+'</b><canvas width="370" height="388"></canvas>';grid.append(article);const c=article.querySelector('canvas'),ctx=c.getContext('2d');let cups=0;const d=ctx.drawImage.bind(ctx);ctx.drawImage=(img,...a)=>{if(img.src.includes('facility-cup-'))cups++;d(img,...a)};ctx.translate(185,373);ctx.scale(5.5,5.5);drawFunctionalFacility(ctx,{item:'c1_9',id:'tea',rotation,x:0,y:0},theme,{s:{functionalFacilities:{units:{tea:{phase:'ready',enabled:true,servings:3}}}},now:2});records.push({theme,rotation,cups});}return records},theme);
  filled.forEach(r=>assert.equal(r.cups,3));await page.screenshot({path:'qa/v45/'+theme+'-three-teas.png'});
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badImages,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await engine?.close();server.kill();await writeFile('qa/v45/art-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}