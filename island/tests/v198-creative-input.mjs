import assert from 'node:assert/strict';
import {HOME_NOTES,melodyChallenge,swatchChallenge,swatchFeedback} from '../src/homeCreativeActivities.js';
export async function playCreative(page,inspect,id){
 const g=(await inspect()).residences.interior.game;
 if(id===12){
  const c=melodyChallenge(g.day),audio=()=>page.evaluate(async()=>{const {getSoundMixer}=await import('/src/soundMixer.js');return getSoundMixer().inspect();});
  const before=await audio();await page.locator('[data-home-listen]').click();await page.waitForFunction(()=>document.querySelector('.home-melody-reference .sounding'),null,{timeout:5000});assert.equal(await page.locator('.home-piano .pressed').count(),1);assert((await audio()).produced>before.produced);
  await page.locator('[data-home-listen]').click();assert.equal(await page.locator('.home-piano .pressed').count(),0);
  const press=async(note,beats)=>{const r=await page.locator('[data-home-key="'+note+'"]').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height*.82);await page.mouse.down();if(beats===2)await new Promise(r=>setTimeout(r,740));await page.mouse.up();};
  await press(0,1);assert.deepEqual((await inspect()).residences.interior.game.values,[{note:0,beats:1}]);await page.locator('[data-home-melody-undo]').click();
  await page.locator('.home-piano').focus();await page.keyboard.down('a');await new Promise(r=>setTimeout(r,740));await page.keyboard.up('a');assert.deepEqual((await inspect()).residences.interior.game.values,[{note:0,beats:2}]);await page.locator('[data-home-melody-undo]').click();
  await page.locator('[data-home-sheet]').click();assert.equal(await page.locator('.home-melody-folio.show-sheet').count(),1);
  for(let i=0;i<8;i++){const p=c.solution[i];await press(i===2?(p.note+1)%7:p.note,p.beats);}
  assert(await page.locator('.home-game-save').isDisabled());await page.locator('[data-home-melody-slot="2"]').click();await press(c.solution[2].note,c.solution[2].beats);assert.deepEqual((await inspect()).residences.interior.game.values,c.solution);
  // Leaving the activity during playback must cancel scheduled notes and its scope.
  const scopes=(await audio()).scopes;await page.locator('[data-home-listen]').click();await page.locator('.home-room [data-home-zone="letters"]').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.zone==='letters',null,{timeout:15000});assert.equal((await audio()).scopes,scopes-1);assert.equal(await page.locator('[data-home-listen]').count(),0);
  await page.locator('.home-room [data-home-zone="piano"]').click();await page.waitForFunction(()=>window.islandInspect().residences.interior?.zone==='piano',null,{timeout:15000});assert.equal((await audio()).scopes,scopes);assert((await inspect()).residences.interior.game.solved);
 }else if(id===13){
  const c=swatchChallenge(g.day),choose=async values=>{for(let i=0;i<4;i++){await page.locator('[data-home-swatch-role="'+i+'"]').click();await page.locator('[data-home-swatch="'+values[i]+'"]').click();}};
  assert(await page.locator('[data-home-swatch-try]').isDisabled());const wrong=c.secret.map((n,i)=>i===1?(n+1)%6:n);await choose(wrong);await page.locator('[data-home-swatch-try]').click();assert.equal(await page.locator('.home-swatch-history>button').count(),1);assert.deepEqual((await inspect()).residences.interior.game.values,[wrong]);assert(await page.locator('.home-game-save').isDisabled());assert(await page.locator('[data-home-swatch-try]').isDisabled());
  const f=swatchFeedback(c.secret,wrong);assert.equal(await page.locator('.home-swatch-pegs .exact').count(),f.exact);assert.equal(await page.locator('.home-swatch-pegs .misplaced').count(),f.misplaced);
  await page.locator('[data-home-swatch-clear]').click();assert(await page.locator('[data-home-swatch-try]').isDisabled());await choose(c.secret);await page.locator('[data-home-swatch-try]').click();assert.equal(await page.locator('.home-swatch-history>button').count(),2);assert.equal(await page.locator('.home-swatch-history>button:last-child .exact').count(),4);assert((await inspect()).residences.interior.game.solved);
 }
 assert((await inspect()).residences.interior.game.solved);
}
