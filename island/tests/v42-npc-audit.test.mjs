import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createState,RESIDENTS} from '../src/world.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateNpcProfileAudit,npcAuditProfile,npcAuditEntries,editNpcProfile,NPC_AUDIT_LIMIT} from '../src/npcProfileAudit.js';
import {createSaveStore} from '../server/saveStore.mjs';
const input=(s,id,changes={})=>{const p=npcAuditProfile(s,id);return Object.fromEntries(['name','personality','lifeGoal','speechStyle'].map(k=>[k,changes[k]??p[k]??'']))};
const edit=(s,id,changes,options={})=>editNpcProfile(s,id,input(s,id,changes),{expectedVersion:npcAuditProfile(s,id).version,requestId:'r-'+Math.random(),now:1791072000000,...options});
test('all 15 AI residents and the steward retain before/after content and immutable roles',()=>{
 const s=createState(),money=s.coins,bag=JSON.stringify(s.inventory);
 for(let id=0;id<16;id++){
  const p=npcAuditProfile(s,id),r=edit(s,id,{personality:'细心、温和，先完成自己的工作，再照顾朋友。'});
  assert(r.ok&&r.changed);assert.equal(r.version,p.version+1);assert.equal(r.entry.before.personality,p.personality);
  assert.equal(r.entry.after.personality,s.npcProfiles[id].personality);
  assert.equal(npcAuditProfile(s,id).kind,RESIDENTS[id].kind);assert.equal(npcAuditProfile(s,id).job,RESIDENTS[id].job);
 }
 assert.equal(npcAuditEntries(s).length,16);assert.equal(s.coins,money);assert.equal(JSON.stringify(s.inventory),bag);
});
test('empty edit produces no audit, no version increase, and no economic mutation',()=>{
 const s=createState();const r=edit(s,0,{});assert(r.ok&&!r.changed);assert.equal(s.npcProfileAudit.totalCount,0);assert.equal(npcAuditProfile(s,0).version,RESIDENTS[0].version);
});
test('duplicate operation is idempotent and changed reuse or stale writes are rejected',()=>{
 const s=createState(),i=input(s,0,{name:'新岛民'}),options={expectedVersion:RESIDENTS[0].version,requestId:'one-write',now:1791072000000};
 assert(editNpcProfile(s,0,i,options).changed);assert(editNpcProfile(s,0,i,options).replayed);
 assert.equal(s.npcProfileAudit.totalCount,1);assert.equal(editNpcProfile(s,0,{...i,name:'另一个名字'},options).code,'request_conflict');
 assert.equal(edit(s,0,{personality:'不该覆盖'},{expectedVersion:0}).code,'version_conflict');
});
test('restoring earlier content creates a forward version instead of rewinding',()=>{
 const s=createState(),r=edit(s,15,{name:'暮云'});
 edit(s,15,{name:'晨风'});const restored=editNpcProfile(s,15,r.entry.before,{expectedVersion:3,requestId:'restore',now:1791072000001,restoreFrom:r.entry.id});
 assert(restored.changed);assert.equal(restored.version,4);assert.equal(restored.entry.source,'restore');assert.equal(restored.entry.before.name,'晨风');
 assert.equal(npcAuditProfile(s,15).name,RESIDENTS[15].name);assert.equal(npcAuditEntries(s,15).length,3);
});
test('required fields, invalid ids, unauthorized fields and bad revisions are rejected',()=>{
 const s=createState();
 for(const [id,data,opts] of [[-1,input(s,0),{}],[16,input(s,0),{}],[0,input(s,0,{name:''}),{}],[0,input(s,0,{personality:'x'.repeat(161)}),{}],[0,{...input(s,0),kind:'hermes'},{}],[0,input(s,0),{expectedVersion:NaN}],[0,input(s,0),{now:Infinity}]]){
  const r=editNpcProfile(s,id,data,{expectedVersion:0,requestId:'invalid',now:1791072000000,...opts});assert(!r.ok);
 }
 assert.deepEqual(s.npcProfiles,{});
});
test('legacy edited profiles keep their revision without inventing earlier history',()=>{
 const s=createState();s.npcProfiles[0]={name:'原有名字',personality:'原有性格',version:7};
 hydrateNpcProfileAudit(s);assert.equal(npcAuditEntries(s).length,0);const r=edit(s,0,{name:'新名字'});assert.equal(r.entry.beforeVersion,7);assert.equal(r.version,8);assert.equal(r.entry.before.name,'原有名字');
});
test('history remains bounded, total count remains accurate and absent restoration is rejected',()=>{
 const s=createState();let first;
 for(let n=0;n<140;n++){const r=edit(s,0,{name:'岛民'+n},{requestId:'seq-'+n});if(!first)first=r.entry.id;}
 assert.equal(s.npcProfileAudit.entries.length,NPC_AUDIT_LIMIT);assert.equal(s.npcProfileAudit.totalCount,140);
 assert.equal(edit(s,0,{name:'旧名字'},{restoreFrom:first}).code,'missing_record');
 assert(JSON.stringify(s).length<200000);
});
test('returned history cannot mutate saved records and corrupted imported entries are removed',()=>{
 const s=createState();edit(s,0,{name:'小岛记录'});const e=npcAuditEntries(s)[0];e.after.name='外部修改';assert.equal(npcAuditEntries(s)[0].after.name,'小岛记录');
 const valid=s.npcProfileAudit.entries[0];s.npcProfileAudit.entries.push({...valid,id:'profile-999',npcId:100},{...valid},{...valid,id:'profile-998',requestId:'bad',at:'not-a-date'});
 hydrateNpcProfileAudit(s);assert.equal(s.npcProfileAudit.entries.length,1);
});
test('day-one reset keeps identity history together while clearing earned progress',()=>{
 const s=createState();edit(s,15,{name:'守望管家'});s.day=22;s.coins=999;s.inventory.wood=80;
 const zero=createZeroState(s);assert.equal(zero.day,1);assert.equal(zero.coins,0);assert(Object.values(zero.inventory).every(v=>v===0));
 assert.equal(npcAuditProfile(zero,15).name,'守望管家');assert.equal(npcAuditEntries(zero,15).length,1);
});
test('disk reload, independent themes, backup restore and exported import preserve exact audit contents',async()=>{
 await mkdir('qa/v42',{recursive:true});const directory=await mkdtemp(resolve('qa/v42/audit-store-')),store=createSaveStore({directory});
 const pixel=createZeroState();edit(pixel,0,{name:'像素记录'});
 let d=(await store.open('pixel',{legacyState:pixel})).document;await store.open('origami',{legacyState:createZeroState()});
 const backup=await store.backup('pixel',{expectedVersion:d.version});edit(d.state,0,{name:'后来修改'});
 d=(await store.save('pixel',{state:d.state,expectedVersion:d.version})).document;
 assert.equal(npcAuditProfile((await createSaveStore({directory}).current('pixel')).state,0).name,'后来修改');
 assert.equal(npcAuditEntries((await store.current('origami')).state).length,0);
 d=(await store.restore('pixel',{id:backup.id,expectedVersion:d.version})).document;assert.equal(npcAuditEntries(d.state)[0].after.name,'像素记录');
 const exported=structuredClone(d);edit(d.state,15,{name:'管家新名'});d=(await store.save('pixel',{state:d.state,expectedVersion:d.version})).document;
 d=(await store.import('pixel',{data:exported,expectedVersion:d.version})).document;
 assert.equal(npcAuditEntries(d.state).length,1);assert.equal(npcAuditProfile(d.state,15).version,RESIDENTS[15].version);
});
