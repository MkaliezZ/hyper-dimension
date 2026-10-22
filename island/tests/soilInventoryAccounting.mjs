import assert from 'node:assert/strict';

// NPCs keep working during the real growth wait. Account for their paid output
// without accepting an unexplained bag or relaxing the player's one-use check.
export function assertSoilInventory(document,{crafted,fertilized,recipe}){
 const state=document.state,rows=Object.entries(state.resourceLedger.receipts).filter(([,r])=>r.delta?.c14_8);
 const playerId=crafted.resourceReceiptId,farmId='farm:'+fertilized.ticket.epoch+':'+fertilized.ticket.sequence;
 assert.equal(typeof playerId,'string');
 const produced=Object.fromEntries([...Object.entries(recipe.cost).map(([id,n])=>[id,-n]),['c14_8',1]]);
 const player=rows.find(([id])=>id===playerId),farm=rows.find(([id])=>id===farmId);
 assert(player&&farm,'player production and fertilizer consumption must both persist');
 assert.equal(player[1].category,'craft');assert.deepEqual(player[1].delta,produced);
 assert.equal(farm[1].category,'player_farm');assert.deepEqual(farm[1].delta,{c14_8:-1});
 const npcRows=rows.filter(([id])=>id!==playerId&&id!==farmId);
 for(const [id,receipt]of npcRows){
  assert.match(id,/^npc-work:[a-zA-Z0-9-]+:craft$/,'additional compost needs a unique NPC craft operation');
  assert.equal(receipt.category,'craft');assert.deepEqual(receipt.delta,produced,'NPC compost pays the complete recipe cost');
 }
 assert.equal(state.inventory.c14_8-npcRows.length,0,'the player bag was consumed once; only paid NPC bags remain');
 return {playerProduced:1,playerConsumed:1,npcProduced:npcRows.length,remaining:state.inventory.c14_8,npcReceiptIds:npcRows.map(([id])=>id)};
}
