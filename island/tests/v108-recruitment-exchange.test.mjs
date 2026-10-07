import test from 'node:test';
import assert from 'node:assert/strict';
import {recruitmentExchange} from '../src/recruitmentExchange.js';
// DOM image construction is stubbed; this suite checks escaped markup, not pixels.
globalThis.Image=class {addEventListener(){} set src(value){this.url=value} };
const contract=()=>({profile:{name:'岩川',appearance:'male_1'},runs:[{source:'hermes',parent:{id:'parent-1',status:'completed',tools:['recruitment_delegate'],answer:'请准备 **木材**。'},child:{id:'child-1',parentId:'parent-1',status:'completed',tools:['recruitment_take_step'],answer:'已接受分工，物资尚未交付。'}}]});
test('only complete matching Hermes parent/child exchanges appear as an agreement',()=>{
 assert.match(recruitmentExchange(contract(),{},'origami'),/已接受分工/);
 for(const alter of [c=>c.runs[0].source='local',c=>c.runs[0].child.parentId='other',c=>c.runs[0].parent.status='running',c=>c.runs[0].child.tools=[],c=>c.runs[0].parent.answer='']){const c=contract();alter(c);assert.equal(recruitmentExchange(c,{},'origami'),'');}
});
test('model prose and names remain escaped in both themes while emphasis stays readable',()=>{
 for(const theme of ['pixel','origami']){const c=contract();c.profile.name='<img onerror=alert(1)>';c.runs[0].child.answer='**<script>alert(1)</script>** `wood`';const html=recruitmentExchange(c,{butlerAvatar:'female_4'},theme);assert(!html.includes('<script>'));assert(!html.includes('<img onerror'));assert.match(html,/<strong>&lt;script&gt;/);assert.match(html,/<code>wood<\/code>/);assert(!html.includes('avatar-half'));assert.match(html,/avatar-portraits-/);}
});
