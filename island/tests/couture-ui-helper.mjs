// Runs legal wardrobe controls for every current client; it never mutates gameplay state.
export async function completeCoutureClients(page){
 const game=()=>page.evaluate(()=>window.islandInspect().roomGame);
 for(let attempts=0;attempts<8;attempts++){
  const s=await game();if(s.result)return s.result;
  if(s.runway){await page.waitForFunction(()=>{const s=window.islandInspect().roomGame;return !!s.result||!s.runway});continue}
  const brief=s.level.briefs?.[s.clientIndex]||s.level;
  for(const [slot,item] of brief.solutions[0].entries()){
   await page.locator('[data-action="wardrobeTab"][data-value="'+slot+'"]').click();
   await page.locator('[data-item="'+item+'"]').click();
  }
  await page.locator('[data-action="submit"]').click();
  await page.waitForFunction(index=>{const s=window.islandInspect().roomGame;return !!s.result||s.clientIndex>index},s.clientIndex);
 }
 throw new Error('Couture clients did not finish through legal input');
}
