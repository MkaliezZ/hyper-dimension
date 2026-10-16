import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCoutureGame,validCoutureGame,COUTURE_CLOTHES} from '../src/coutureRules.js';
const fixtures=JSON.parse(await readFile(new URL('./fixtures/v233-couture-levels.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const make=f=>createCoutureGame(f.seed,f.difficulty,f.wardrobe,f.excluded,f.tags);

test('cached definitions match96pre-change seeds, difficulties, wardrobes, exclusions and themes',()=>{
 assert.equal(fixtures.length,96);
 for(const f of fixtures)for(let warm=0;warm<2;warm++){const g=make(f);assert.equal(hash(g.level),f.levelSha256);assert(validCoutureGame(g));}
});
test('mutating one returned game cannot poison another game or its validation baseline',()=>{
 const f=fixtures.at(-1),a=make(f);a.level.rounds[0].budget+=9;a.level.rounds[0].cues.reverse();a.level.models.reverse();
 assert(!validCoutureGame(a));const b=make(f);assert.equal(hash(b.level),f.levelSha256);assert(validCoutureGame(b));
});
test('warm cache never treats changed caller levels or changed setup inputs as verified',()=>{
 const f=fixtures.at(-1);
 for(const change of [g=>g.level.rounds[0].style++,g=>g.level.rounds[0].accent.minimum++,g=>g.seed=17,g=>g.difficulty='easy',g=>g.tags=['sea'],g=>g.excluded=[13,7,2]]){
  const g=make(f);assert(validCoutureGame(g));change(g);assert(!validCoutureGame(g));
 }
});
test('invalid configurations still fail before a cache result can be returned',()=>{
 const f=fixtures[0];make(f);
 for(const seed of [NaN,Infinity,-1,1.2,'0',null])assert.throws(()=>createCoutureGame(seed));
 assert.throws(()=>createCoutureGame(0,'normal',[...f.wardrobe,f.wardrobe[0]]));assert.throws(()=>createCoutureGame(0,'normal',f.wardrobe,[13,7,2],['unknown']));
});
test('cache pressure preserves determinism after older definitions are evicted',()=>{
 const f=fixtures.at(-1),before=hash(make(f).level);
 for(let seed=10000;seed<10140;seed++)assert(validCoutureGame(createCoutureGame(seed,'normal',COUTURE_CLOTHES.map(c=>c.id))));
 assert.equal(hash(make(f).level),before);assert.equal(before,f.levelSha256);
});
test('mutating supplied arrays after construction cannot change stored or future definitions',()=>{
 const f=fixtures.at(-1),wardrobe=[...f.wardrobe],excluded=[...f.excluded],tags=[...f.tags],g=createCoutureGame(f.seed,f.difficulty,wardrobe,excluded,tags);
 wardrobe.length=0;excluded.length=0;tags.length=0;assert(validCoutureGame(g));assert.equal(hash(make(f).level),f.levelSha256);
});
