import test from 'node:test';import assert from 'node:assert/strict';import {hoeStroke,hoeToolPose,HOE_GROUND_POINTS}from '../src/toolMotion.js';import{TOOL_ART,heldToolGeometry}from '../src/toolArt.js';

test('both real hoe blades meet soil at the existing 52 percent contact cue',()=>{
 for(const theme of ['pixel','origami'])for(const handY of [-38,-34,-30,-27])for(const t of [.52,.57,.62]){
  const spec=TOOL_ART[theme].hoe,reach=heldToolGeometry('hoe',theme,spec.frame,54).shaftLength,pose=hoeStroke(t,handY,reach),g=heldToolGeometry('hoe',theme,spec.frame,54,pose.angle);
  assert(pose.contact);assert(Math.abs(handY+g.tip.y)<1e-9);assert(g.tip.x>25);assert(spec.file.includes(theme));
 }
});
test('stroke raises, strikes and returns smoothly without a loop jump or premature soil burst',()=>{
 const a=hoeStroke(0),b=hoeStroke(1);assert(Math.abs(a.angle-b.angle)<1e-9);assert(hoeStroke(.27).angle<a.angle);assert.equal(hoeStroke(.519).soil,null);assert.equal(hoeStroke(.52).soil,0);assert.equal(hoeStroke(.9).soil,null);
 for(let i=1;i<=240;i++)assert(Math.abs(hoeStroke(i/240).angle-hoeStroke((i-1)/240).angle)<.08);
});

test('all eight facing directions put the blade on their projected work point in both artworks',()=>{
 for(const theme of ['pixel','origami'])for(let heading=0;heading<8;heading++){
  const hand={x:[1,2,3].includes(heading)?-19:19,y:-35},base=heldToolGeometry('hoe',theme,TOOL_ART[theme].hoe.frame,54),p=hoeToolPose(.56,heading,hand,.3,base.shaftLength),g=heldToolGeometry('hoe',theme,TOOL_ART[theme].hoe.frame,p.size,p.angle),mirror=[1,2,3].includes(heading)?-1:1;
  assert(Math.abs(hand.x+g.tip.x*mirror-HOE_GROUND_POINTS[heading][0])<1e-9);assert(Math.abs(hand.y-.3+g.tip.y-HOE_GROUND_POINTS[heading][1])<1e-9);assert(p.size>25&&p.size<85);
 }
});
