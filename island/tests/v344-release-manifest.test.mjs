import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {loadManifest,sha256} from '../tools/releaseCommon.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
test('the actual shipped source manifest is accepted by the production deployment loader',async()=>{
 const manifest=await loadManifest(root);assert.equal(manifest.target,'agent-source');assert.match(manifest.release,/^hyper-dimension-v\d+-agent-source$/);
 for(const platform of ['windows-x64','macos14-arm64','macos14-x64'])assert(manifest.platforms.includes(platform),platform);
});
test('a checksum-correct future manifest format is still rejected',async()=>{
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-unsupported-manifest-')),current=JSON.parse(await readFile(join(root,'release-manifest.json'),'utf8')),bytes=Buffer.from(JSON.stringify({...current,schema:current.schema+1}));
 await writeFile(join(directory,'release-manifest.json'),bytes);await writeFile(join(directory,'release-manifest.sha256'),sha256(bytes)+'\n');
 await assert.rejects(loadManifest(directory),/Unsupported release manifest/);
});
test('the production loader still rejects a modified manifest with its old checksum',async()=>{
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-manifest-checksum-')),bytes=await readFile(join(root,'release-manifest.json'));
 await writeFile(join(directory,'release-manifest.json'),Buffer.concat([bytes,Buffer.from(' ')]));await writeFile(join(directory,'release-manifest.sha256'),sha256(bytes)+'\n');
 await assert.rejects(loadManifest(directory),/Release manifest checksum mismatch/);
});
