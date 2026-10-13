import test from 'node:test';
import assert from 'node:assert/strict';

test('unused legacy corner art stays unloaded; actual draws request only the visible theme and weighted seasons',async t=>{
 const before={Image:globalThis.Image,location:globalThis.location,document:globalThis.document},created=[],decoded=[];
 globalThis.Image=class{constructor(){created.push(this);this.complete=false;this.naturalWidth=0;}decode(){decoded.push(this.src);return Promise.resolve();}};
 globalThis.location={search:'?theme=pixel'};globalThis.document={body:{dataset:{theme:'pixel'}}};
 t.after(()=>{for(const [key,value]of Object.entries(before)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
 const {drawSeasonArtwork,seasonArtworkStatus}=await import('../src/seasonArtwork.js');
 const {activateThemeArtwork}=await import('../src/themeArtwork.js');
 assert.equal(created.length,0,'importing the environment must not decode unused v132 terrain');
 for(const theme of ['pixel','origami']){const status=seasonArtworkStatus(theme);assert.equal(status.enabled,false);assert.equal(status.variants.length,3);assert(status.variants.every(v=>!v.requested&&!v.loaded&&!v.ready));}
 const ctx={save(){},restore(){}};
 drawSeasonArtwork(ctx,'pixel',{season:'summer',transition:1});assert.equal(created.length,0);
 drawSeasonArtwork(ctx,'pixel',{season:'spring',transition:1});assert.equal(created.length,1);assert.deepEqual(decoded,['/assets/seasons-v132/pixel-spring-0-0.png']);
 drawSeasonArtwork(ctx,'pixel',{season:'spring',transition:1});assert.equal(created.length,1,'repeated frames reuse the same request');
 drawSeasonArtwork(ctx,'pixel',{previousSeason:'spring',season:'autumn',transition:.4});assert.equal(created.length,2);assert.equal(decoded.length,2);assert(!decoded.some(url=>url.includes('winter')));
 drawSeasonArtwork(ctx,'origami',{season:'winter',transition:1});assert.equal(created.length,3);assert.equal(decoded.length,2,'unactivated theme is not eagerly fetched');
 await activateThemeArtwork('origami');assert.equal(decoded.length,3);assert.equal(decoded.at(-1),'/assets/seasons-v132/origami-winter-0-0.png');
 const pixel=seasonArtworkStatus('pixel');assert.equal(pixel.enabled,true);assert.equal(pixel.coverage,'legacy-single-tile');assert.deepEqual(pixel.variants.map(v=>v.requested),[true,true,false]);
});
