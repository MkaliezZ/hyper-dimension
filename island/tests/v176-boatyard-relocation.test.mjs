import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptOpenRoomGeography} from '../server/lanGeographyMigration.mjs';
import {advanceResidents} from '../server/lanRoomResidents.mjs';
import {residentSchedule} from '../src/residentSchedule.js';
import {ISLAND_GEOGRAPHY} from '../src/islandGeography.js';
import {worldSlots,worldWalkableForTheme,findWorldPathForTheme} from '../src/world.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const OLD={20:{x:1644,y:1200},23:{x:1800,y:744}};
const route=(theme,from,to,avoid=[])=>{const points=findWorldPathForTheme(theme,from,to,avoid);if(distance(points.at(-1)||from,to)>18)throw Error('unreachable');return points;};
function assertClear(theme,from,points){for(const to of points){const n=Math.max(1,Math.ceil(distance(from,to)/3));for(let i=0;i<=n;i++)assert(worldWalkableForTheme(theme,from.x+(to.x-from.x)*i/n,from.y+(to.y-from.y)*i/n),'route stays on traversable land');from=to;}}
function worker(id,buildingId,point){return {person:{actorId:id,npcId:5,kind:'ai',ownerAccountId:'host',job:'船匠'},...point,path:[],walking:false,updatedAt:1000,meeting:{id:'fixture-work-'+id,kind:'work',buildingId,recipeId:'fixture-recipe',output:'fixture-output',elapsed:7,duration:12,until:1000000,phase:'working',target:{...point}}};}
function room(theme){return {id:'fictional-room',phase:'open',geographyVersion:ISLAND_GEOGRAPHY.version,owner:'host',theme,members:{host:{...ISLAND_GEOGRAPHY.spawn,lastSeen:1000,companions:[]}},residents:[]};}

for(const theme of ['pixel','origami'])test(theme+' persisted resident and visitor work follows relocated venues without resetting position, identity or earned progress',()=>{
 const r=room(theme),resident=worker('resident-shipwright',23,OLD[23]),visitor=worker('visitor-pyrotechnician',20,OLD[20]);r.residents=[resident];r.members.host.companions=[visitor];
 const snapshots=[resident,visitor].map(c=>structuredClone(c)),doc={rooms:{[r.id]:r}},result=adaptOpenRoomGeography(doc,2000);
 assert.equal(result.changed,true);assert.equal(result.relocated,0,'no character teleport');assert.deepEqual(result.rooms,[r.id]);
 for(const [i,c]of [resident,visitor].entries()){
  const before=snapshots[i],entry=worldSlots(theme).find(s=>s.id===c.meeting.buildingId).entry;
  assert.deepEqual(c.person,before.person);assert.equal(c.x,before.x);assert.equal(c.y,before.y);assert.equal(c.meeting.id,before.meeting.id);
  for(const key of ['buildingId','recipeId','output','elapsed','duration','until'])assert.equal(c.meeting[key],before.meeting[key]);
  assert.equal(c.meeting.phase,'approaching');assert(distance(c.meeting.target,entry)<65);assert(distance(c.meeting.target,before.meeting.target)>400);assert(c.path.length>0);assert(distance(c.path.at(-1),c.meeting.target)<.01);assertClear(theme,c,c.path);
 }
 const after=structuredClone(doc);assert.equal(adaptOpenRoomGeography(doc,3000).changed,false);assert.deepEqual(doc,after,'migration is idempotent');
});

for(const theme of ['pixel','origami'])test(theme+' cached shipwright working schedule walks to the coastal shipyard after load',()=>{
 const r=room(theme),environment={hour:9,cycles:5+9/24,season:'spring'},plan=residentSchedule(5,environment),c={person:{actorId:'shipwright',npcId:5,kind:'ai',ownerAccountId:'host',job:'船匠'},...OLD[23],path:[],updatedAt:1000,visitAt:0,visitIndex:0,scheduleKey:plan.day+':'+plan.period+':'+plan.eventActive};r.residents=[c];
 const before={x:c.x,y:c.y};advanceResidents(r,1000,route,environment);assert.deepEqual({x:c.x,y:c.y},before,'loading does not teleport');assert(c.path.length);assertClear(theme,c,c.path);
 const destination=worldSlots(theme).find(s=>s.id===23).entry;assert(distance(c.path.at(-1),destination)<24);
 for(let i=1;i<=1500&&c.path.length;i++){const at=1000+i*100;r.members.host.lastSeen=at;const previous={x:c.x,y:c.y};advanceResidents(r,at,route,environment);assert(distance(c,previous)<=6.201,'ordinary walking speed');assert(worldWalkableForTheme(theme,c.x,c.y));}
 assert.equal(c.path.length,0);assert(distance(c,destination)<24);assert(c.activity.includes('船坞'));assert.equal(c.person.actorId,'shipwright');assert(!c.homeRest);
});

test('unaffected work, completed rooms and conversations retain their serialized data',()=>{
 const r=room('pixel'),unchanged=worker('unchanged',0,{...worldSlots('pixel').find(s=>s.id===0).entry}),conversation=worker('conversation',23,OLD[23]);conversation.meeting.kind='conversation';r.residents=[unchanged,conversation];const closed=room('origami');closed.id='closed';closed.phase='closed';closed.residents=[worker('historic-work',23,OLD[23])];
 const doc={rooms:{open:r,closed}},before=structuredClone(doc);assert.equal(adaptOpenRoomGeography(doc,2000).changed,false);assert.deepEqual(doc,before);
});
