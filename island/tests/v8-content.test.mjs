import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {RAW_MATERIALS,ALL_RECIPES,ITEM_BY_ID,hydrateContent,recipeGate,commitRecipe,resourceLoot,itemUse} from '../src/contentCatalog.js';
import {hydrateTown} from '../src/townSimulation.js';import {createState} from '../src/world.js';import {AVATARS} from '../src/avatarCatalog.js';
const fresh=()=>hydrateTown(createState());
test('50 source materials and 300 building recipes have complete, acyclic dependencies',()=>{
 assert.equal(RAW_MATERIALS.length,50);assert.equal(ALL_RECIPES.length,300);assert.equal(Object.keys(ITEM_BY_ID).length,350);
 assert.equal(new Set(ALL_RECIPES.map(r=>r.name)).size,300);
 const used=new Set(ALL_RECIPES.flatMap(r=>Object.keys(r.cost)));for(const m of RAW_MATERIALS)assert.ok(used.has(m.id),'used material '+m.id);
 for(let b=0;b<25;b++)assert.equal(ALL_RECIPES.filter(r=>r.building===b).length,12);
 const visited=new Set(),active=new Set();
 function visit(id){if(visited.has(id))return;assert.ok(!active.has(id),'cyclic '+id);active.add(id);const r=ALL_RECIPES.find(r=>r.item===id);if(r)for(const k of Object.keys(r.cost)){assert.ok(ITEM_BY_ID[k],'defined input '+k);visit(k)}active.delete(id);visited.add(id)}
 for(const r of ALL_RECIPES)visit(r.item);
});
test('all 300 craft transactions require unlocks and materials, debit once, never grant free results',()=>{
 const s=fresh();for(const r of ALL_RECIPES){s.roomGames[r.building]={plays:10};s.facilities[r.building].quality=80;for(const [k,n] of Object.entries(r.cost))s.inventory[k]=n;const before=s.inventory[r.item]||0;assert.equal(commitRecipe(r,s),true,r.name);assert.equal(s.inventory[r.item],before+1);for(const k of Object.keys(r.cost))assert.equal(s.inventory[k],0,r.name+' input '+k);assert.equal(commitRecipe(r,s),false);assert.equal(s.inventory[r.item],before+1)}
 const locked=fresh(),r=ALL_RECIPES.find(r=>r.tier===2);for(const [k,n] of Object.entries(r.cost))locked.inventory[k]=n;assert.equal(recipeGate(r,locked).ready,false);assert.equal(commitRecipe(r,locked),false);
});
test('source harvesting validates all 50 materials and grants only requested native source',()=>{
 for(const m of RAW_MATERIALS){const s=fresh(),before=s.inventory[m.id];assert.deepEqual(resourceLoot(m.source,s,2,m.id),[{id:m.id,amount:2}]);assert.equal(s.inventory[m.id],before+2);assert.equal(s.discovered[m.id],true);}
 const s=fresh();assert.deepEqual(resourceLoot('forest',s,3,'iron'),[]);assert.deepEqual(resourceLoot('mine',s,3,'lantern'),[]);
});
test('starter tools are granted once and unconfirmed display previews cannot spend stock or grant quality',()=>{
 const s=fresh(),counts={...s.inventory};hydrateContent(s);for(const id of ['hoe','pickaxe','watering_can','axe','sickle','rod'])assert.equal(s.inventory[id],counts[id]);
 s.inventory.lantern=1;const f=s.facilities[0],base=f.quality;for(let i=0;i<10;i++){const preview=itemUse('lantern',s);assert.equal(preview.ok,true);assert.equal(preview.route,'placement');}assert.equal(s.inventory.lantern,1);assert.equal(f.quality,base);
 s.inventory.tea=1;assert.equal(itemUse('tea',s).ok,true);assert.equal(s.inventory.tea,0);assert.equal(itemUse('tea',s).ok,false);
});
test('both styles have 700 concrete item drawings and 12 selectable avatar identities',()=>{
 const d=JSON.parse(fs.readFileSync('public/assets/art-frames-v8.json','utf8'));assert.equal(AVATARS.filter(a=>a.gender==='男').length,6);assert.equal(AVATARS.filter(a=>a.gender==='女').length,6);
 for(const theme of ['pixel','origami']){assert.equal(d['items-'+theme+'-materials-v8.png'].frames.length,50);for(let p=0;p<5;p++)assert.equal(d['items-'+theme+'-products-'+p+'-v8.png'].frames.length,60);for(const gender of ['male','female'])assert.equal(d['avatars-'+theme+'-'+gender+'-v8.png'].frames.length,30);assert.equal(d['avatar-portraits-'+theme+'-v8.png'].frames.length,12);}
 for(const [file,a] of Object.entries(d)){assert.ok(fs.existsSync('public/assets/'+file));for(const f of a.frames)assert.ok(f.w>8&&f.h>8&&f.x>=0&&f.y>=0&&f.x+f.w<=a.width&&f.y+f.h<=a.height)}
});


test('advanced agent preparation walks dependencies down to native sources',async()=>{
 const {planRecipeAssignment}=await import('../src/craftPlanning.js'),s=fresh(),r=ALL_RECIPES.find(r=>r.building===2&&r.tier===2),task={goal:'workshop',buildingId:2,recipeId:r.id,assignmentId:'test'};
 const first=planRecipeAssignment(r,s,task);assert.equal(first.preparing,true);assert.ok(first.resource||first.recipeId!==r.id);
 for(const m of RAW_MATERIALS)s.inventory[m.id]=100;
 const second=planRecipeAssignment(r,s,task);assert.ok(second.recipeId!==r.id);assert.equal(second.preparing,true);
 for(const item of ALL_RECIPES)s.inventory[item.item]=100;
 const last=planRecipeAssignment(r,s,task);assert.equal(last.recipeId,r.id);assert.equal(last.preparing,undefined);
});
