import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveResponseCache,applySaveResponseActions} from '../src/saveResponse.js';

const url='http://127.0.0.1:4175/api/saves/pixel/save';
function response(cache,version,actions,{url:target=url,headers={},actionsVersion=null,metadataOnly=true,ok=true}={}){
 return cache.prepare({url:target,headers,actionsVersion,metadataOnly,ok,status:ok?200:409,text:JSON.stringify({document:{version,state:{coins:9},actions}})});
}
test('ordinary clock receipt transfers only changed action paths and retains immutable history',()=>{
 const cache=createSaveResponseCache();
 const base={sequence:10,active:null,receipts:Array.from({length:1500},(_,i)=>({id:i,text:'已核对的游戏记录'.repeat(50)})),farm:{activeSeconds:6,leases:{}}};
 const first=response(cache,'v1',base);assert.deepEqual(first.data.document.actions,base);
 const expected=structuredClone(base);expected.farm.activeSeconds=11;
 const next=response(cache,'v2',expected,{actionsVersion:'v1'});
 assert(!Object.hasOwn(next.data.document,'actions'));assert(!Object.hasOwn(next.data.document,'state'));
 assert(Buffer.byteLength(JSON.stringify(next.data))<600);
 const merged=applySaveResponseActions(next.data.document,{version:'v1',actions:base});
 assert.deepEqual(merged.actions,expected);assert.equal(merged.actions.receipts,base.receipts);
 assert.equal(base.farm.activeSeconds,6);assert.equal(merged.actions.farm.activeSeconds,11);
 assert.equal(JSON.parse(next.text).document.state.coins,9);
});
test('the captured base is used even when current records have moved to another version',()=>{
 const cache=createSaveResponseCache(),base={sequence:1,receipts:[],resident:{leases:{1:{id:'one'}}}};
 response(cache,'v1',base);const captured={version:'v1',actions:base};
 const expected={sequence:2,receipts:[{id:'done'}],resident:{leases:{}}};
 const next=response(cache,'v2',expected,{actionsVersion:'v1'});
 assert.deepEqual(applySaveResponseActions(next.data.document,captured).actions,expected);
 assert.equal(captured.actions.resident.leases[1].id,'one');
});
test('lost response retries, stale bases and cache eviction receive a complete action book',()=>{
 const cache=createSaveResponseCache(1),a={sequence:1,receipts:[]};
 response(cache,'v1',a);response(cache,'v2',{...a,sequence:2},{actionsVersion:'v1'});
 const retry=response(cache,'v2',{...a,sequence:2},{actionsVersion:'v1'});
 assert.equal(retry.data.document.actions.sequence,2);assert(!retry.data.document.actionsDelta);
 response(cache,'other',{sequence:99},{url:url.replace('pixel','origami')});
 const miss=response(cache,'v3',{sequence:3},{actionsVersion:'v2'});
 assert.equal(miss.data.document.actions.sequence,3);assert(!miss.data.document.actionsDelta);
});
test('account, theme and origin are separate metadata baselines',()=>{
 const cache=createSaveResponseCache(),a={sequence:1};
 response(cache,'same-version',a,{headers:{'X-HD-Island':'owner-a'}});
 for(const options of [
  {headers:{'X-HD-Island':'owner-b'}},
  {url:url.replace('pixel','origami'),headers:{'X-HD-Island':'owner-a'}},
  {url:url.replace('4175','4174'),headers:{'X-HD-Island':'owner-a'}}
 ]){
  const other=response(cache,'v2',{sequence:7},{...options,actionsVersion:'same-version'});
  assert(other.data.document.actions);assert(!other.data.document.actionsDelta);
 }
});
test('open response warms the worker book; errors do not change its confirmed version',()=>{
 const cache=createSaveResponseCache();
 const open=response(cache,'v1',{sequence:1},{metadataOnly:false,url:url.replace(/\/save$/,'/open')});
 assert(!open.data);assert.equal(JSON.parse(open.text).document.actions.sequence,1);
 response(cache,'bad',{sequence:999},{ok:false});
 const next=response(cache,'v2',{sequence:2},{actionsVersion:'v1'});
 assert(next.data.document.actionsDelta);assert.equal(applySaveResponseActions(next.data.document,{version:'v1',actions:{sequence:1}}).actions.sequence,2);
});
test('unmatched or malformed metadata cannot overwrite the captured action book',()=>{
 const base={version:'v1',actions:{sequence:1,receipts:[{id:'keep'}]}};
 for(const delta of [{baseVersion:'v0',changes:[]},{baseVersion:'v1',changes:null},{baseVersion:'v1',changes:[{operation:'set',path:['__proto__','polluted'],encoded:'true'}]}]){
  assert.throws(()=>applySaveResponseActions({actionsDelta:delta},base));
  assert.equal(base.actions.sequence,1);assert.equal(base.actions.receipts[0].id,'keep');
 }
 assert.equal({}.polluted,undefined);
});
