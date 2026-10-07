import {chromium} from 'playwright-core';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chooseAction} from './v19-play-helpers.mjs';
await mkdir('qa/v19',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const previous=process.env.V19_GAME_IDS?JSON.parse(await readFile('qa/v19/browser-play.json','utf8').catch(()=>'{}')):{};const rerun=(process.env.V19_GAME_IDS||'').split(',').map(Number);const results=(previous.results||[]).filter(r=>!rerun.includes(r.id)),errors=[];
try{
 const ids=process.env.V19_GAME_IDS?process.env.V19_GAME_IDS.split(',').map(Number):[0,1,2,4,5,6,8,10,12,13,14,15,16,17,18,19,20,21,22,23,24];
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.route('**/api/**',r=>r.fulfill({status:503,body:'{"error":"isolated QA"}',contentType:'application/json'}));
 page.on('pageerror',e=>errors.push(e.message));
 for(const id of ids){
  await page.goto('http://127.0.0.1:4174/src/arcade.html?qa=1&game='+id+'&theme=origami&difficulty=2&seed=731');
  await page.locator('[data-action="start"]:enabled').waitFor();await page.clock.install();
  await page.locator('[data-action="start"]').click();
  await page.evaluate(async source=>{
   const {photoSubject,potteryAccuracy,neighbors}=await import('/src/workshopRules.js');
   const choose=new Function('photoSubject','potteryAccuracy','neighbors','return ('+source+')')(photoSubject,potteryAccuracy,neighbors);
   let cursor=0,dockLeg=0;window.botErrors=[];window.botActions=0;
   const pointer=(type,p)=>{const canvas=document.querySelector('.wk-canvas'),r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.x+p.x/960*r.width,clientY:r.y+p.y/540*r.height,pointerId:7,pointerType:'mouse',buttons:type==='pointerup'?0:1,button:0}));};
   window.botTimer=setInterval(()=>{
    const s=arcadeInspect();if(!s||s.phase!=='playing')return;s._testStep=cursor;s._dockLeg=dockLeg;
    const a=choose(s);cursor=s._testStep||0;dockLeg=s._dockLeg||0;if(!a)return;
    window.botActions++;
    try{
     if(a.type==='point'){pointer('pointermove',a);return}
     if(a.type==='down'){pointer('pointermove',a);pointer('pointerdown',a);return}
     if(a.type==='up'){window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7}));return}
     if(['lane','releaseLane','move','steer','brake'].includes(a.type)){
      let code,down=true;
      if(a.type==='lane'||a.type==='releaseLane'){code=['KeyA','KeyS','KeyD','KeyF'][a.lane];down=a.type==='lane'}
      if(a.type==='move')code=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'][a.dir];
      if(a.type==='steer'){code={left:'ArrowLeft',right:'ArrowRight',forward:'ArrowUp'}[a.key];down=a.down}
      if(a.type==='brake'){code='Space';down=a.down}
      window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,cancelable:true}));return;
     }
     let selector='[data-action="'+a.type+'"]';
     for(const key of ['value','index','station','item'])if(a[key]!=null)selector+='[data-'+key+'="'+a[key]+'"]';
     if(a.type==='cell')selector='[data-cell="'+a.index+'"]';
     if(a.type==='focus'){selector='[data-action="focus"][data-delta="'+(a.delta<0?-2:2)+'"]';}
     const b=document.querySelector(selector);if(!b)throw Error('Missing control '+selector);b.click();
    }catch(e){window.botErrors.push(e.message);}
   },1000/30);
  },chooseAction.toString());
  let state;
  for(let block=0;block<60;block++){
   await page.clock.runFor(5000);state=await page.evaluate(()=>arcadeInspect());if(state.result)break;
  }
  const bot=await page.evaluate(()=>{clearInterval(botTimer);return {errors:botErrors,actions:botActions}});
  if(!state.result?.passed||bot.errors.length){await page.screenshot({path:'qa/v19/browser-failed-'+id+'.png',fullPage:true});throw Error(JSON.stringify({id,result:state.result,phase:state.phase,mode:state.mode,status:state.status,bot,state}));}
  await page.clock.runFor(2800);
  await page.locator('[data-action="claim"]').waitFor();
  if([2,6,15,16,20,23].includes(id))await page.screenshot({path:'qa/v19/win-origami-'+id+'.png'});
  const before=await page.evaluate(()=>arcadeInspect().result);
  await page.locator('[data-action="claim"]').click();assert.equal(await page.locator('.arcade-grid').count(),1);
  results.push({id,kind:state.kind,score:before.score,quality:before.quality,seconds:Math.round(before.seconds),actions:bot.actions,errors:bot.errors});console.log('PASS',id,state.kind,Math.round(state.t)+'s',bot.actions+' inputs');
 }
 assert.deepEqual(errors,[]);
 await page.close();
}finally{await browser.close();await writeFile('qa/v19/browser-play.json',JSON.stringify({results,errors},null,2))}
