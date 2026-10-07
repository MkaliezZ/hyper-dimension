import {chromium} from 'playwright-core';import {mkdir,writeFile} from 'node:fs/promises';
const tag=process.argv[2]||'before';await mkdir('qa/v23',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),results=[];
try{for(const [theme,dpr] of [['origami',1],['pixel',1],['origami',2]]){
 const p=await browser.newPage({viewport:{width:1440,height:950},deviceScaleFactor:dpr}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated performance QA"}'}));
 if(tag==='before')await p.route('**/src/rasterQuality.js',async route=>{
  const response=await route.fetch(),source=await response.text();
  const cached="const frozen=await freezeRaster(surface);entry.surface=frozen.image;";
  if(!source.includes(cached))throw Error('V22 control cache patch no longer matches renderer');
  await route.fulfill({response,body:source.replace(cached,"const frozen={bytes:0};entry.surface=surface;")});
 });
 await p.route('**/src/app.js',async route=>{
  const response=await route.fetch();let source=await response.text();
  source+='\nconst perfQA=window.__perfQA={calls:{},frames:[],long:[]};\nconst timeQA=(name,fn)=>function(...args){const start=performance.now();try{return fn.apply(this,args)}finally{const dt=performance.now()-start,m=perfQA.calls[name]??={n:0,sum:0,max:0};m.n++;m.sum+=dt;m.max=Math.max(m.max,dt)}};\n';
  for(const name of ['render','update','renderUI','drawWorld','drawBuilding','drawCharacter','nameplate','verticalBuildingName','drawSpeech'])source+=name+'=timeQA("'+name+'",'+name+');\n';
  source+='let qaLast=0;function qaFrame(t){if(qaLast)perfQA.frames.push(t-qaLast);qaLast=t;requestAnimationFrame(qaFrame)}requestAnimationFrame(qaFrame);new PerformanceObserver(list=>perfQA.long.push(...list.getEntries().map(e=>({time:e.startTime,duration:e.duration})))).observe({type:"longtask",buffered:true});';
  await route.fulfill({response,body:source});
 });
 await p.goto('http://127.0.0.1:'+(theme==='pixel'?4173:4174)+'/?qa=1');
 await p.waitForTimeout(2800);await p.waitForFunction(()=>window.islandInspect?.().rendering.raster.ready>=4&&window.islandInspect().rendering.raster.pending===0);
 const cdp=await p.context().newCDPSession(p);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 await p.evaluate(()=>{window.__perfQA.calls={};window.__perfQA.frames=[];window.__perfQA.long=[]});
 await p.waitForTimeout(8000);
 // Continuous map movement and zoom exposes raster/compositor costs.
 for(let i=0;i<3;i++){await p.mouse.move(700,500);await p.mouse.down();await p.mouse.move(880,520,{steps:24});await p.mouse.up();await p.mouse.wheel(0,i%2?120:-120);await p.waitForTimeout(450)}
 await p.waitForTimeout(2500);
 const profile=(await cdp.send('Profiler.stop')).profile;
 const data=await p.evaluate(()=>{const s=window.islandInspect(),a=window.__perfQA,sorted=a.frames.toSorted((a,b)=>a-b);const g=document.createElement('canvas').getContext('webgl'),ext=g?.getExtension('WEBGL_debug_renderer_info');return {theme:s.theme,dpr:devicePixelRatio,rendering:s.rendering,zoom:s.zoom,now:s.now,npcs:s.npcs.length,visitors:s.visitors.length,calls:a.calls,frames:{n:sorted.length,avg:sorted.reduce((a,b)=>a+b,0)/sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],over34:sorted.filter(x=>x>34).length},long:a.long,gpu:ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'}});
 const hottest=profile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,18).map(n=>({name:n.callFrame.functionName,url:n.callFrame.url.split('/').at(-1),hits:n.hitCount}));
 results.push({...data,errors,hottest});await writeFile('qa/v23/'+tag+'-'+theme+'-'+dpr+'-cpu.json',JSON.stringify(profile));console.log(JSON.stringify(results.at(-1)));await p.close();
}}finally{await browser.close();await writeFile('qa/v23/'+tag+'-performance.json',JSON.stringify(results,null,2))}

