import assert from 'node:assert/strict';
import {WORLD,SLOTS,RESIDENTS,setWorldTheme,worldWalkable,findPath,nearestWalkable} from '../src/world.js';
for(const theme of ['pixel','origami']){setWorldTheme(theme);for(const s of SLOTS){assert.equal(s.view,'elevated-front');assert.ok(s.x>0&&s.x<WORLD.width);const target=nearestWalkable(s.entry.x,s.entry.y);const path=findPath({x:780,y:465},target);assert.ok(path.length||Math.hypot(target.x-780,target.y-465)<36,theme+' building unreachable '+s.id);for(const n of path)assert.ok(worldWalkable(n.x,n.y));}for(const r of RESIDENTS)assert.ok(worldWalkable(...r.start));console.log(theme+': 25 entrances reachable, 16 spawn positions clear');}
setWorldTheme('pixel');
