import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireRoomSpot,promoteRoomSpot,releaseRoomSpot,releaseRoomGroup,inspectRoomClaims} from '../src/sceneOccupancy.js';
import {roomWalkable} from '../src/rooms.js';
const clean=()=>{for(const c of inspectRoomClaims())releaseRoomSpot(c.token);};
test('a player waiting before a later NPC gets the freed work station regardless of update order',()=>{
 clean();assert.equal(acquireRoomSpot(7,'npc-first','work').role,'work');const player=acquireRoomSpot(7,'player','work'),late=acquireRoomSpot(7,'npc-late','work');assert.equal(player.role,'queue');assert.equal(late.role,'queue');releaseRoomSpot('npc-first');assert.equal(promoteRoomSpot('npc-late'),null);assert.equal(promoteRoomSpot('player').role,'work');assert.equal(promoteRoomSpot('npc-late'),null);releaseRoomSpot('player');assert.equal(promoteRoomSpot('npc-late').role,'work');clean();
});
test('new arrivals cannot bypass a queued worker between release and promotion; leaving the queue releases the next turn',()=>{
 clean();acquireRoomSpot(11,'first','work');acquireRoomSpot(11,'waiting','work');releaseRoomSpot('first');assert.equal(acquireRoomSpot(11,'new','work').role,'queue');assert.equal(promoteRoomSpot('new'),null);releaseRoomSpot('waiting');assert.equal(promoteRoomSpot('new').role,'work');clean();
});
test('work queues are independent for all 25 rooms, preserve spacing and release only the requested group',()=>{
 clean();for(let id=0;id<25;id++){acquireRoomSpot(id,'resident-'+id,'work');acquireRoomSpot(id,'player-'+id,'work');acquireRoomSpot(id,'late-'+id,'work');}
 releaseRoomGroup('resident-');for(let id=0;id<25;id++){assert.equal(promoteRoomSpot('late-'+id),null);assert.equal(promoteRoomSpot('player-'+id).role,'work');const claims=inspectRoomClaims().filter(c=>c.room===id);for(const c of claims)assert(roomWalkable(id,c.point.x,c.point.y));assert(Math.hypot(claims[0].point.x-claims[1].point.x,claims[0].point.y-claims[1].point.y)>66);}
 clean();
});
