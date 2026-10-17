import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {runtimeConfig} from '../server/runtimeConfig.mjs';

test('native product pixel checks retain every pixel, fractional margins and original thresholds', {timeout:30000}, async()=>{
 const result=await promisify(execFile)(runtimeConfig.paths.modelPython,['-X','utf8',resolve(import.meta.dirname,'v264-product-pixels.test.py')],{windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.match(result.stderr,/Ran 2 tests/);
 assert.match(result.stderr,/OK/);
});
