import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
await mkdir('qa',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],out=[];
try{
 for(const port of [4173,4174]){
  const page=await browser.newPage({viewport:{width:1280,height:950}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"QA offline"}'}));
  await page.goto('http://127.0.0.1:'+port+'/?qa=1');
  await page.evaluate(async()=>{const {mountRoomGame}=await import('/src/roomGames.js');const {artReady}=await import('/src/artStore.js');await artReady;const root=document.createElement('div');root.id='qaGame';root.style='position:fixed;inset:20px 260px;background:var(--ui-paper);padding:24px;z-index:999;overflow:auto';document.body.append(root);window.qaMount=(id,difficulty)=>{window.qaInstance?.destroy();window.qaInstance=mountRoomGame(root,id,()=>{},{seed:7143,difficulty})}});
  for(let difficulty=1;difficulty<=3;difficulty++)for(let id=0;id<25;id++){await page.evaluate(([id,d])=>qaMount(id,d),[id,difficulty]);await page.waitForTimeout(30);const s=await page.evaluate(()=>qaInstance.inspect());out.push({port,id,difficulty,kind:s.kind,seed:s.level?.seed});}
  for(const id of [3,7,0,18]){await page.evaluate(id=>qaMount(id,2),id);await page.waitForTimeout(200);await page.screenshot({path:'qa/v18-initial-'+port+'-'+id+'.png'});}
  await page.close();
 }
 console.log(JSON.stringify({mounts:out.length,errors},null,2));
}finally{await browser.close();}
