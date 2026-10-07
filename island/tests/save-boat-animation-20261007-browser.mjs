import assert from 'node:assert/strict';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {chromium} from 'playwright-core';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
const out=process.argv[2]||'qa/save-stutter-v7/boats';await mkdir(out,{recursive:true});
const directory=await mkdtemp(resolve(out+'/fixture-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-BOAT-ANIMATION'});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={scope:'Actual boat artwork and harbor renderer in an isolated page. Logical boat time held constant while visual frames advance; no game state writes or model calls.',checks:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:640,height:400}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/boat-fixture',r=>r.fulfill({contentType:'text/html',body:'<canvas width="640" height="400"></canvas><script type="module">import {drawBoats} from "/src/harbor.js";import {HARBOR,setWorldTheme} from "/src/world.js";window.boatQA={drawBoats,HARBOR,setWorldTheme};</script>'}));
 await page.goto('http://127.0.0.1:'+service.port+'/boat-fixture');await page.waitForFunction(()=>!!window.boatQA);
 for(const theme of ['pixel','origami']){
  await page.waitForFunction(theme=>{
   boatQA.setWorldTheme(theme);const c=document.querySelector('canvas'),g=c.getContext('2d'),original=g.drawImage;let count=0;g.drawImage=function(...a){count++;return original.apply(this,a);};
   boatQA.drawBoats(g,[{id:9999,phase:'moored',t:0,x:boatQA.HARBOR.berth.x,y:boatQA.HARBOR.berth.y}],theme,1);g.drawImage=original;return count>0;
  },theme);
  const check=await page.evaluate(theme=>{
   const {drawBoats,HARBOR,setWorldTheme}=boatQA;setWorldTheme(theme);const g=document.querySelector('canvas').getContext('2d'),calls=[],original=g.drawImage;
   g.drawImage=function(img,...args){calls.push({asset:img.src.split('/').at(-1),x:args[4]+100,y:args[5]+131});return original.call(this,img,...args);};
   const p=.25,e=p*p*(3-2*p),b={id:theme==='pixel'?9010:9011,phase:'approaching',t:3,x:HARBOR.sea.x+(HARBOR.berth.x-HARBOR.sea.x)*e,y:HARBOR.sea.y+(HARBOR.berth.y-HARBOR.sea.y)*e},before=JSON.stringify(b);
   g.setTransform(.9,0,0,.9,-1200,-670);for(const t of [10,10.2,10.4]){g.clearRect(1200,670,740,500);drawBoats(g,[b],theme,t);}g.drawImage=original;
   return {theme,calls,logicalUnchanged:before===JSON.stringify(b),distance:Math.abs(calls.at(-1).x-calls[0].x)};
  },theme);
  assert(check.logicalUnchanged);assert(check.distance>4);assert(check.calls.every(c=>c.asset==='boats-'+theme+'-v4.png'));report.checks.push(check);
  await page.screenshot({path:out+'/'+theme+'.png'});
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser.close();await service.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
