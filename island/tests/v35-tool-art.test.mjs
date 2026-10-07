import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOL_ART,heldToolGeometry} from '../src/toolArt.js';
import {TOOLS} from '../src/equipmentRules.js';
test('all actual tool artworks have an independent grip and working end in both themes',()=>{
 for(const theme of ['pixel','origami'])for(const id of Object.keys(TOOLS)){
  const spec=TOOL_ART[theme][id];assert(spec,id+theme);
  for(const point of [spec.grip,spec.tip])assert(point.every(x=>Number.isFinite(x)&&x>=0&&x<=1));
  assert.notDeepEqual(spec.grip,spec.tip);
 }
 assert(TOOL_ART.pixel.pickaxe.grip[0]<.5);
 assert(TOOL_ART.origami.pickaxe.grip[0]>.5);
});
test('different native tool orientations reach the same requested swing direction',()=>{
 for(const theme of ['pixel','origami'])for(const id of Object.keys(TOOLS).filter(id=>id!=='watering_can'))
 for(const frame of [{w:126,h:130},{w:119,h:135},{w:186,h:120},{w:147,h:165}])
 for(const angle of [-1.9,.15,-.75]){
  const g=heldToolGeometry(id,theme,frame,54,angle);
  assert(Math.abs(Math.atan2(g.tip.y,g.tip.x)-angle)<1e-10,id+theme);
  assert(Math.abs(Math.hypot(g.tip.x,g.tip.y)-g.shaftLength)<1e-10);
 }
});
test('pouring follows the real can spout while the top handle remains at the palm',()=>{
 for(const theme of ['pixel','origami']){
  const g=heldToolGeometry('watering_can',theme,{w:143,h:107},39,.4);
  assert.equal(g.rotation,.4);assert(g.tip.x<0);assert(Number.isFinite(g.tip.y));
 }
});
test('unknown tools and invalid frames cannot produce a floating placeholder',()=>{
 assert.equal(heldToolGeometry('not-a-tool','pixel',{w:1,h:1},50),null);
 assert.equal(heldToolGeometry('pickaxe','pixel',{w:0,h:1},50),null);
});
