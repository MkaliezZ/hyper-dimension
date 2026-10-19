import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {runtimeConfig} from '../server/runtimeConfig.mjs';

test('A2A announced actions require real tool receipts, bounded continuation and verified observation',{timeout:30000},async()=>{
 const result=await promisify(execFile)(runtimeConfig.paths.modelPython,['-X','utf8',resolve(import.meta.dirname,'v301-a2a-completion.test.py')],{windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.match(result.stderr,/Ran 8 tests/);assert.match(result.stderr,/OK/);
});
