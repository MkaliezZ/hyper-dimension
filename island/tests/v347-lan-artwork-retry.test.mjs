import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const{createLanArtworkLoader}=await import(new URL('../src/lanArtworkLoader.js',import.meta.url));
const ready=url=>({src:url,complete:true,naturalWidth:2304,naturalHeight:1792});
function fixture({failure=()=>false}={}){
 const calls=[],waits=[],bounds={calibrated:true};let serial=0;
 const loader=createLanArtworkLoader({overview:t=>'/assets/'+t+'-overview.png?version=169',house:t=>'/assets/'+t+'-houses.png',bounds:()=>bounds,base:()=> 'http://owned.invalid/',nonce:()=> 'owned-'+(++serial),wait:async ms=>waits.push(ms),image:async url=>{calls.push(url);if(failure(url,calls))throw Error('Controlled artwork decode failure');return ready(url);}});
 return{loader,calls,waits,bounds};
}
for(const theme of ['pixel','origami'])for(const kind of ['overview','houses'])test(theme+' recovers one transient '+kind+' PNG failure without caching incomplete art',async()=>{
 let failed=false;const f=fixture({failure:url=>!failed&&url.includes(kind)&&(failed=true)}),result=await f.loader.load(theme);assert(result.map.naturalWidth>0&&result.houses.naturalWidth>0);assert.equal(result.bounds,f.bounds);assert.equal(f.calls.length,3);assert.deepEqual(f.waits,[250]);
 const retried=new URL(f.calls.find(u=>u.includes('hdArtworkRetry')));assert.equal(retried.origin,'http://owned.invalid');assert.equal(retried.pathname,'/assets/'+theme+'-'+kind+'.png');if(kind==='overview')assert.equal(retried.searchParams.get('version'),'169');const again=await f.loader.load(theme);assert.equal(again,result);assert.equal(f.calls.length,3);
});
test('three failed attempts stop, discard the failed promise and permit a fresh later entry',async()=>{
 let failing=true;const f=fixture({failure:url=>failing&&url.includes('overview')});await assert.rejects(f.loader.load('pixel'),/Controlled/);assert.equal(f.calls.filter(u=>u.includes('overview')).length,3);assert.deepEqual(f.waits,[250,750]);failing=false;const result=await f.loader.load('pixel');assert(result.map&&result.houses);assert.equal(f.calls.filter(u=>u.includes('overview')).length,4);
});
test('concurrent room requests share one complete layer, while themes keep separate artwork',async()=>{
 const f=fixture(),a=f.loader.load('pixel'),b=f.loader.load('pixel');assert.equal(a,b);const[first,second,other]=await Promise.all([a,b,f.loader.load('origami')]);assert.equal(first,second);assert.notEqual(first,other);assert.equal(f.calls.length,4);
});
test('a resolved but undecoded image is not accepted as a ready map',async()=>{
 let calls=0;const loader=createLanArtworkLoader({overview:()=>'/map.png',house:()=>'/house.png',bounds:()=>[],base:()=> 'http://owned.invalid/',wait:async()=>{},image:async url=>{calls++;return url.includes('map')?{complete:true,naturalWidth:0,naturalHeight:0}:ready(url);}});await assert.rejects(loader.load('pixel'),/Incomplete island artwork/);assert.equal(calls,4);
});
test('invalid themes cannot trigger asset requests or a cached fallback',async()=>{
 const f=fixture();await assert.rejects(f.loader.load('unknown'),/Invalid island artwork theme/);assert.equal(f.calls.length,0);
});
