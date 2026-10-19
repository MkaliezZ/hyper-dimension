import test from 'node:test';
import assert from 'node:assert/strict';

async function fixture(run){
 const old={location:Object.getOwnPropertyDescriptor(globalThis,'location'),document:Object.getOwnPropertyDescriptor(globalThis,'document')};
 globalThis.location={search:'?theme=pixel'};globalThis.document={body:{dataset:{theme:'pixel'}}};
 try{const module=await import('../src/themeArtwork.js?test='+crypto.randomUUID());await run(module);}
 finally{for(const[name,value]of Object.entries(old)){if(value)Object.defineProperty(globalThis,name,value);else delete globalThis[name];}}
}
function image({failures=0,valid=true,wait=null}={}){
 let assigned=0,calls=0,current='';const instance={complete:valid,naturalWidth:valid?32:0,
  get src(){return current;},set src(url){assigned++;current=url;},
  async decode(){calls++;if(wait)await wait;if(calls<=failures)throw new DOMException('The source image cannot be decoded.','EncodingError');}
 };
 return{instance,assigned:()=>assigned,calls:()=>calls};
}

test('a transient decode failure of a valid image recovers before activation succeeds',()=>fixture(async({registerThemeArtwork,activateThemeArtwork,themeArtworkStatus})=>{
 const asset=image({failures:1});registerThemeArtwork(asset.instance,'/assets/origami-overview.png','origami');
 assert.equal(asset.calls(),0,'Inactive appearance is not requested');
 await activateThemeArtwork('origami');assert.equal(asset.calls(),2);assert.equal(asset.assigned(),1,'Keep the successfully fetched valid image');
 assert.equal(themeArtworkStatus().failed,0);assert.equal(themeArtworkStatus().retrying,0);
}));

test('two transient decode failures recover on the final bounded attempt',()=>fixture(async({registerThemeArtwork,activateThemeArtwork,themeArtworkStatus})=>{
 const asset=image({failures:2});registerThemeArtwork(asset.instance,'/assets/interior.png','pixel');await activateThemeArtwork('pixel');
 assert.equal(asset.calls(),3);assert.equal(asset.assigned(),1);assert.equal(themeArtworkStatus().failed,0);
}));

test('permanently invalid artwork rejects activation after three attempts and stays visible in diagnostics',()=>fixture(async({registerThemeArtwork,activateThemeArtwork,themeArtworkStatus})=>{
 const asset=image({failures:Infinity,valid:false});registerThemeArtwork(asset.instance,'/assets/broken.png','origami');
 await assert.rejects(activateThemeArtwork('origami'),error=>error.name==='EncodingError');
 assert.equal(asset.calls(),3);assert.equal(asset.assigned(),3,'Only bounded read-only image reloads occur');
 const status=themeArtworkStatus();assert.equal(status.failed,1);assert.equal(status.retrying,0);
 assert.deepEqual(status.failures,[{url:'/assets/broken.png',theme:'origami',attempts:3,errorName:'EncodingError',errorMessage:'The source image cannot be decoded.'}]);
}));

test('overlapping activation calls share the same in-flight decode',()=>fixture(async({registerThemeArtwork,activateThemeArtwork,themeArtworkStatus})=>{
 let release;const waiting=new Promise(resolve=>release=resolve),asset=image({wait:waiting});registerThemeArtwork(asset.instance,'/assets/shared.png','pixel');
 const first=activateThemeArtwork('pixel'),second=activateThemeArtwork('pixel');assert.equal(asset.calls(),1);assert.equal(asset.assigned(),1);
 release();await Promise.all([first,second]);assert.equal(asset.calls(),1);assert.equal(themeArtworkStatus().failed,0);
}));

test('an explicit later activation can retry a failed image after its bytes become available',()=>fixture(async({registerThemeArtwork,activateThemeArtwork,themeArtworkStatus})=>{
 const asset=image({failures:3});registerThemeArtwork(asset.instance,'/assets/repaired.png','origami');
 await assert.rejects(activateThemeArtwork('origami'),error=>error.name==='EncodingError');assert.equal(themeArtworkStatus().failed,1);
 await activateThemeArtwork('origami');assert.equal(asset.calls(),4);assert.equal(themeArtworkStatus().failed,0);
}));
