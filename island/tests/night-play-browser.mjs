import {findNightAim} from './night-trace-fixture.mjs';
export async function playNightAct(page){
 await page.waitForFunction(()=>{const r=window.islandInspect?.().roomGame;return r?.kind==='night-party'&&!r.transport&&!r.paused;},null,{timeout:45000});
 let g=await page.evaluate(()=>window.islandInspect().roomGame.game);
 if(g.engine==='night-sky'){
  if(g.phase==='between'){await page.locator('#nightSkyNext:enabled').click();g=await page.evaluate(()=>window.islandInspect().roomGame.game);}
  if(g.phase==='complete')return g;
  if(g.phase==='aim'){
   await page.locator('#launchLantern:enabled').waitFor({timeout:150000});
   g=await page.evaluate(()=>window.islandInspect().roomGame.game);const aim=findNightAim(g);
   const angle=page.locator('#nightSkyAngle'),lift=page.locator('#nightSkyLift');await angle.focus();await angle.press('Home');for(let n=0;n<aim.angle+38;n++)await angle.press('ArrowRight');
   await lift.focus();await lift.press('Home');for(let n=0;n<7;n++)await lift.press('ArrowRight');
   await page.locator('#launchLantern:enabled').click();
  }
  const round=g.round;await page.waitForFunction(n=>window.islandInspect()?.roomGame?.game?.round>n,round,{timeout:25000});
 }else{
  await page.waitForFunction(()=>{const r=window.islandInspect()?.roomGame,g=r?.game,b=document.querySelector('#launchLantern');if(!g||r.paused||r.transport||!b||b.disabled)return false;const n=(Math.sin(g.phase*g.speed-Math.PI/2)+1)/2;return n>.44&&n<.56;},null,{timeout:150000});
  await page.locator('#launchLantern').click();
 }
 return page.evaluate(()=>window.islandInspect().roomGame.game);
}
export async function playNightUI(page){while((await page.evaluate(()=>window.islandInspect().roomGame.game.round))<4)await playNightAct(page);return page.evaluate(()=>window.islandInspect().roomGame.game);}
