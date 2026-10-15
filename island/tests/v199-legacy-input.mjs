import assert from 'node:assert/strict';
import {originChallenge,postChallenge,postStep,postWalk} from '../src/homeLegacyActivities.js';
import {hydrateWonders,WONDER_DEFINITIONS} from '../src/eventWonders.js';
export function fixtureWonders(state){const w=hydrateWonders(state);for(const [i,id]of ['seashell_cup','market_lantern','couture_ribbon','fireworks_orbit'].entries())w.owned[id]={id,name:WONDER_DEFINITIONS[id].name,rarity:WONDER_DEFINITIONS[id].rarity,day:i+1,eventId:'fictional-home-event-'+i,eventName:['海风钓赛','海风集市','衣橱舞会','烟花小会'][i],color:0,marks:0,wins:1,colors:['sea'],sourceVersion:5};return state;}
export async function playLegacy(page,inspect,id){
 const g=(await inspect()).residences.interior.game;
 if(id===14){
  const complete=async mode=>{const c=originChallenge(g.day,fixtureWonders({}),mode);for(const [i,pair]of c.solution.entries()){await page.locator('[data-home-origin-item="'+pair.itemId+'"]').click();await page.locator('[data-home-origin-slot="'+i+'"]').click();await page.locator('[data-home-origin-source="'+pair.sourceId+'"]').click();}assert((await inspect()).residences.interior.game.solved);};
  assert.equal(await page.locator('[data-origin-mode="owned"]').getAttribute('aria-pressed'),'true');await page.locator('[data-origin-mode="practice"]').click();assert((await page.locator('.home-origin-heading').innerText()).includes('虚构'));await complete('practice');await page.locator('[data-home-reset]').click();assert(!(await inspect()).residences.interior.game.solved);await page.locator('[data-origin-mode="owned"]').click();await complete('owned');
 }else{
  const c=postChallenge(g.day),dir=c.solution[0],key={U:'ArrowUp',D:'ArrowDown',L:'ArrowLeft',R:'ArrowRight'};await page.locator('.home-post-stage').focus();await page.keyboard.press(key[dir]);assert.equal((await inspect()).residences.interior.game.values[0],dir);await page.locator('[data-home-post-undo]').click();assert.equal((await inspect()).residences.interior.game.values[0],'');
  const floor=Array.from({length:49},(_,i)=>i).find(i=>{const route=postWalk(c,c.initial,i);return route&&route.length>=2;});assert.notEqual(floor,undefined);await page.locator('[data-home-post-cell="'+floor+'"]').click();const steps=postWalk(c,c.initial,floor).length;await page.waitForFunction(n=>window.islandInspect().residences.interior.game.values[0].length===n,steps);await page.locator('[data-home-reset]').click();assert.equal((await inspect()).residences.interior.game.values[0],'');
  for(const d of c.solution)await page.locator('[data-home-post-dir="'+d+'"]').click();assert((await inspect()).residences.interior.game.solved);await page.locator('.home-post-parcels').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));});assert.equal(await page.locator('.home-post-parcels .delivered').count(),3);
 }
 assert((await inspect()).residences.interior.game.solved);
}
