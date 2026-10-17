import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {pack,image,info} from './v224-content-fixtures.mjs';

test('authenticated art, published recipes, both appearances and exported assets remain with their owner',async()=>{
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-v224-http-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'CUSTOM-CONTENT-ONLY'}),base='http://127.0.0.1:'+service.port;
 const call=async(path,input,account)=>{const r=await fetch(base+path,{method:input?'POST':'GET',headers:{...(input?{'Content-Type':'application/json'}:{}),...(account?{Cookie:account.cookie,'X-HD-Island':account.id}:{})},body:input?JSON.stringify(input):undefined});return {status:r.status,body:r.headers.get('Content-Type')?.includes('json')?await r.json():Buffer.from(await r.arrayBuffer()),cookie:r.headers.get('Set-Cookie')?.split(';')[0],headers:r.headers};};
 const signup=async n=>{const r=await call('/api/lan/register',{enrollmentKey:'CUSTOM-CONTENT-ONLY',login:'custom_owner_'+n,password:'fictional-content-password',name:'共创岛主'+n,islandName:'共创测试岛'+n,avatar:'female_1',theme:n?'origami':'pixel'});assert.equal(r.status,200);return {id:r.body.view.me.id,cookie:r.cookie};};
 try{
  const a=await signup(0),b=await signup(1);await call('/api/world/session',undefined,a);await call('/api/world/session',undefined,b);await call('/api/saves/pixel/open',{},a);await call('/api/saves/origami/open',{},b);
  assert.equal((await call('/api/cocreation/pixel/art',{png:image.toString('base64')})).status,401);
  const uploaded=await call('/api/cocreation/pixel/art',{png:image.toString('base64')},a);assert.equal(uploaded.status,200);assert.deepEqual(uploaded.body.art,info);
  const url='/api/cocreation/pixel/art/'+info.sha256;assert.equal((await call(url,undefined,b)).status,404);const read=await call(url,undefined,a);assert(read.body.equals(image));assert.equal(read.headers.get('Content-Type'),'image/png');assert.equal(read.headers.get('Cache-Control'),'private, no-store');const imageRead=await fetch(base+url+'?island='+a.id,{headers:{Cookie:a.cookie}});assert.equal(imageRead.status,200);assert(Buffer.from(await imageRead.arrayBuffer()).equals(image));assert.equal((await fetch(base+url+'?island='+a.id,{headers:{Cookie:b.cookie}})).status,409);assert.equal((await fetch(base+url,{headers:{Cookie:a.cookie}})).status,409);
  assert.equal((await call('/api/cocreation/pixel/art',{png:'<svg/>'},a)).status,400);
  const command=async(operation,args={})=>{const d=await call('/api/cocreation/pixel',undefined,a);const r=await call('/api/cocreation/pixel/action',{operation,requestId:randomUUID(),expectedVersion:d.body.document.version,...args},a);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
  const p=pack(),created=await command('import',{pack:p}),version=created.document.packages[p.id].versions[0];await command('submit',{packageId:p.id,version:1,hash:version.hash});await command('review',{packageId:p.id,version:1,hash:version.hash,decision:'approve',note:'双画风图片与加工流程已核对。'});const before=await call('/api/saves/pixel',undefined,a),worldKey=before.body.document.state.saveSlot;await command('activate',{packageId:p.id,version:1,hash:version.hash,worldKey});
  const pixel=await call('/api/saves/pixel',undefined,a),origami=await call('/api/saves/origami',undefined,a);assert.equal(pixel.body.document.state.customCatalog.recipes.length,2);assert.equal(origami.body.document.state.saveSlot,worldKey);assert.deepEqual(origami.body.document.state.customCatalog,pixel.body.document.state.customCatalog);const coOtherAppearance=await call('/api/cocreation/origami',undefined,a);assert.equal(coOtherAppearance.body.document.packages[p.id].active.hash,version.hash);
  const other=await call('/api/saves/origami',undefined,b);assert.equal(other.body.document.state.customCatalog,undefined);
  const exported=await call('/api/cocreation/pixel/export/'+p.id+'/1',undefined,a);assert.deepEqual(exported.body.pack,p);assert.equal(exported.body.assets.length,1);assert.equal(exported.body.assets[0].sha256,info.sha256);assert.equal(exported.body.assets[0].png,image.toString('base64'));assert.equal((await call('/api/cocreation/pixel/export/'+p.id+'/1',undefined,b)).status,404);
 }finally{await service.close();}
});
