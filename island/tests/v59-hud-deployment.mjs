import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const digest=b=>createHash('sha256').update(b).digest('hex');
const m=JSON.parse(await readFile('public/assets/ui-hud-v59/manifest.json','utf8'));
const paths=['src/uiArt.js','src/lanGameDock.js','src/ui-v16.css',...m.assets.map(x=>'assets/ui-hud-v59/'+x.file)];
const checks=[];
for(const port of [4173,4174,4175]){
 for(const path of paths){const local=await readFile(path.startsWith('assets/')?'public/'+path:path),r=await fetch('http://127.0.0.1:'+port+'/'+path);assert(r.ok,port+' '+path);assert.equal(digest(Buffer.from(await r.arrayBuffer())),digest(local));}
 checks.push({port,matchedFiles:paths.length,assets:28});
}
await writeFile('qa/v59/deployment.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify(checks));