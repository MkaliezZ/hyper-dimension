import assert from 'node:assert/strict';
import {archiveChallenge,strataChallenge} from '../src/homeResearchActivities.js';
export async function playResearch(page,inspect,id){
 const g=(await inspect()).residences.interior.game;
 if(id===10){
  const c=archiveChallenge(g.day),event=async i=>page.locator('[data-home-archive-event="'+i+'"]').click();
  await event(0);await page.locator('[data-home-archive-slot="0"]').click();await event(1);await page.locator('[data-home-archive-slot="1"]').click();await event(0);await page.locator('[data-home-archive-slot="1"]').click();assert.deepEqual((await inspect()).residences.interior.game.values.slice(0,2),[1,0]);
  await page.locator('[data-home-reset]').click();assert((await inspect()).residences.interior.game.values.every(v=>v===null));
  for(let i=0;i<6;i++){await event(i);await page.locator('[data-home-archive-source="'+c.events[i].correct+'"]').click();await page.locator('[data-home-archive-slot="'+c.solution.slice(0,6).indexOf(i)+'"]').click();}
  assert((await inspect()).residences.interior.game.solved);
  await event(5);await page.locator('[data-home-archive-source="'+((c.events[5].correct+1)%3)+'"]').click();assert(await page.locator('.home-game-save').isDisabled());assert((await page.locator('.home-game-feedback').innerText()).includes('重新核对'));
  await page.locator('[data-home-archive-source="'+c.events[5].correct+'"]').click();
 }else if(id===11){
  const c=strataChallenge(g.day);
  const select=async i=>{const pressed=await page.locator('[data-home-strata="'+i+'"]').getAttribute('aria-pressed');if(pressed!=='true')await page.locator('[data-home-strata="'+i+'"]').click();};
  const initial=structuredClone(g.values);await select(0);await page.locator('[data-home-strata-turn="1"]').click();assert.notDeepEqual((await inspect()).residences.interior.game.values,initial);await page.locator('[data-home-strata-undo]').click();assert.deepEqual((await inspect()).residences.interior.game.values,initial);
  await page.locator('[data-home-strata-reference]').click();assert.equal(await page.locator('.home-strata-case.show-reference').count(),1);await page.locator('[data-home-strata-reference]').click();assert.equal(await page.locator('.home-strata-case.show-reference').count(),0);
  for(let target=0;target<9;target++){
   let board=(await inspect()).residences.interior.game.values,index=board.findIndex(p=>p.tile===target);
   const active=page.locator('[data-home-strata][aria-pressed="true"]'),selected=await active.count()?await active.getAttribute('data-home-strata'):null;if(selected!==null)await page.locator('[data-home-strata="'+selected+'"]').click();
   if(index!==target){await select(index);await page.locator('[data-home-strata="'+target+'"]').click();}
   await select(target);board=(await inspect()).residences.interior.game.values;for(let n=0;n<(4-board[target].r)%4;n++)await page.locator('[data-home-strata-turn="1"]').click();
  }
  assert.equal((await page.locator('.home-strata-progress').innerText()).replace(/\s/g,''),'纹理接续12/12');
  assert.deepEqual((await inspect()).residences.interior.game.values,c.solution);
 }
 assert((await inspect()).residences.interior.game.solved);
}
