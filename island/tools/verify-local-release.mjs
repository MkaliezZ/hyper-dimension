import {resolve} from 'node:path';import {verifyPayload} from './releaseCommon.mjs';
const root=resolve(process.argv.find(x=>x.startsWith('--root='))?.slice(7)||resolve(import.meta.dirname,'..'));
try{console.log(JSON.stringify(await verifyPayload(root,{pristine:process.argv.includes('--pristine')})));}catch(e){console.error(e.message);process.exitCode=1;}
