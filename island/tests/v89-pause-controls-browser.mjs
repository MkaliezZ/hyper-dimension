import {chromium} from 'playwright-core';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const directory=await mkdtemp(resolve('qa/v89/pause-fixture-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-PAUSE'}),base='http://127.0.0.1:'+service.port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),report={scope:'Actual browser view mounted with real seeded game, mocked transport and no save/model calls. Pause during in-flight acknowledgement must respond immediately and remain paused after transport resolves.',checks:[]};
try{const page=await browser.newPage();await page.goto(base+'/login');for(const theme of ['pixel','origami'])for(const kind of ['market','couture']){
 const result=await page.evaluate(async({theme,kind})=>{
  const rules=await import('/src/'+(kind==='market'?'marketRules':'coutureRules')+'.js'),view=await import('/src/'+(kind==='market'?'marketView':'coutureView')+'.js'),root=document.createElement('div');document.body.append(root);
  const options={theme,profile:id=>({name:'隔离居民'+id,color:'#c38b72'}),portrait:()=>'',ready:()=>true,arrived:()=>false,model:()=>null,layout:{buyers:[{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}]}},game=kind==='market'?rules.createMarketGame(123):rules.createCoutureGame(123),controls={trace(){},claim(){},exit(){},saveOutcome(){}};
  const api=kind==='market'?view.mountMarket(root,{game},controls,options):view.mountCouture(root,{game},controls,options);api.setTransportPaused(true);root.querySelector('#'+kind+'Pause').click();const immediate=api.inspect().paused,clock=api.inspect().game.clock;api.setTransportPaused(false);await new Promise(r=>setTimeout(r,100));const retained=api.inspect().paused,clockUnchanged=api.inspect().game.clock===clock;root.querySelector('#'+kind+'Pause').click();const resumed=!api.inspect().paused;api.destroy();root.remove();return {immediate,retained,clockUnchanged,resumed};
 },{theme,kind});assert.deepEqual(result,{immediate:true,retained:true,clockUnchanged:true,resumed:true});report.checks.push({theme,kind,...result});}
 report.passed=true;
}finally{await browser.close();await service.close();await writeFile('qa/v89/pause-controls.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
