// Reproducible loading previews composed from the original painted tiles, not the legacy map.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from '../tests/browserRuntime.mjs';
import {sha256,saveJson} from './releaseCommon.mjs';
const root=resolve(import.meta.dirname,'..'),output=resolve(root,'public/assets/map-tiles-v134');
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/preview'){res.writeHead(200,{'Content-Type':'text/html'}).end(`<!doctype html><body style="margin:0"><canvas id="map" width="1856" height="1024"></canvas><script type="module">
   import {drawTerrainTiles,terrainTileStatus} from '/src/mapTiles.js';
   const ctx=document.getElementById('map').getContext('2d');let theme='pixel',used=false;
   window.selectTheme=v=>{theme=v;};window.previewStatus=()=>({used,...terrainTileStatus()});
   function frame(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,1856,1024);used=drawTerrainTiles(ctx,theme);requestAnimationFrame(frame);}frame();
  </script>`);return;}
  if(!url.pathname.startsWith('/src/')&&!url.pathname.startsWith('/assets/')){res.writeHead(404).end();return;}
  const path=resolve(root,'.'+(url.pathname.startsWith('/assets/')?'/public':'')+url.pathname);
  if(!path.startsWith(root+sep)){res.writeHead(404).end();return;}
  const data=await readFile(path);res.writeHead(200,{'Content-Type':extname(path)==='.png'?'image/png':'text/javascript'}).end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const files=[];
try{
 browser=await chromium.launch(browserLaunchOptions());const page=await browser.newPage({viewport:{width:1856,height:1024}});
 await page.goto('http://127.0.0.1:'+server.address().port+'/preview');
 for(const theme of ['pixel','origami']){
  await page.waitForFunction(()=>typeof window.selectTheme==='function');await page.evaluate(t=>window.selectTheme(t),theme);
  await page.waitForFunction(t=>{const s=window.previewStatus();return s.used&&s.theme===t&&!s.pending&&s.ready.length===16&&!s.failed.length;},theme,{timeout:60000});
  const encoded=await page.locator('#map').evaluate(c=>c.toDataURL('image/png').split(',')[1]),bytes=Buffer.from(encoded,'base64');
  await mkdir(output,{recursive:true});await writeFile(resolve(output,theme+'-overview.png'),bytes);
  files.push({file:'public/assets/map-tiles-v134/'+theme+'-overview.png',width:1856,height:1024,bytes:bytes.length,sha256:sha256(bytes)});
 }
 await saveJson(resolve(root,'docs/terrain-previews-v134.json'),{version:134,method:'Native Canvas composition of all 15 generated terrain tiles and the complete plaza, using runtime weights and shoreline masking; no buildings or characters baked into terrain.',source:'continuous mainland and gallery atlas V134: two whole-map guides, 30 original high-resolution regional paintings; original complete plaza retained',files});
 console.log(JSON.stringify({files,passed:true}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
