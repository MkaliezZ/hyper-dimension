export async function solvePacking(page,inspect,root=''){
 const first=await inspect(),modern=!!first.premium;if(modern)await page.locator((root||'body')+' [data-action="start"]:enabled').click();
 const level=first.level;
 for(const move of level.solution){
  await page.locator(root+' [data-piece="'+move.piece+'"]').click();
  for(let i=0;i<move.rotation;i++)await page.locator(root||'body').getByRole('button',{name:modern?'旋转 · R':'旋转 90°',exact:true}).click();
  await page.locator(root+' [data-cell="'+(move.anchor??move.index)+'"]').click();
 }
}
