import {chromium} from 'playwright-core';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),out=[];
try{for(const variant of ['medium-all','medium-actors','native-raster']){
 const p=await browser.newPage({viewport:{width:1440,height:950}});
 await p.route('**/api/**',r=>r.fulfill({status:503,body:'{}'}));
 await p.route('**/src/*.js',async route=>{const response=await route.fetch();let source=await response.text(),file=new URL(route.request().url()).pathname;
 if(file.endsWith('/rasterQuality.js'))source=source.replace("const frozen=await freezeRaster(surface);entry.surface=frozen.image;","const frozen={bytes:0};entry.surface=surface;");
 if(variant==='medium-all')source=source.replaceAll("imageSmoothingQuality='high'","imageSmoothingQuality='medium'");
 if(variant==='medium-actors'&&file.endsWith('/characters.js'))source=source.replace("ctx.save();ctx.translate(a.x,a.y);","ctx.save();ctx.imageSmoothingQuality='medium';ctx.translate(a.x,a.y);");
 if(variant==='native-raster'&&file.endsWith('/rasterQuality.js'))source=source.replace('const e=surfaceFor(source,theme),factor=e.factor;','const e={surface:source,factor:1},factor=e.factor;');
 await route.fulfill({response,body:source});
 });
 await p.goto('http://127.0.0.1:4174/?qa=1');await p.waitForTimeout(2200);
 const r=await p.evaluate(()=>new Promise(resolve=>{let last=performance.now(),start=last,samples=[];function step(t){samples.push(t-last);last=t;if(t-start>4500){const sorted=samples.toSorted((a,b)=>a-b);resolve({frames:samples.length,avg:(t-start)/samples.length,p50:sorted[Math.floor(samples.length*.5)],p95:sorted[Math.floor(samples.length*.95)]})}else requestAnimationFrame(step)}requestAnimationFrame(step)}));
 out.push({variant,...r});console.log(JSON.stringify(out.at(-1)));await p.close();
}}finally{await browser.close();await writeFile('qa/v23/isolation.json',JSON.stringify(out,null,2))}

