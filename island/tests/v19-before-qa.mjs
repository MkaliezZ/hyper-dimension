import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
await mkdir('qa/v19',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{for(const port of [4173,4174]){
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated QA"}'}));
 await page.goto('http://127.0.0.1:'+port+'/?qa=1');await page.evaluate(async()=>{const {mountRoomGame}=await import('/src/roomGames.js');const {artReady}=await import('/src/artStore.js');await artReady;const root=document.createElement('div');root.id='auditGame';root.style='position:fixed;inset:40px 220px;z-index:999;background:var(--ui-paper);padding:26px;overflow:auto';document.body.append(root);window.mountAudit=id=>{window.auditInstance?.destroy();window.auditInstance=mountRoomGame(root,id,()=>{},{seed:731,difficulty:2})}});
 for(const id of [2,6,15,16,23]){await page.evaluate(id=>mountAudit(id),id);await page.waitForTimeout(400);await page.screenshot({path:'qa/v19/before-'+port+'-'+id+'.png'});}
 await page.close();
}}finally{await browser.close();}
