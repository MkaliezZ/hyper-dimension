import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {verificationCommands,runVerificationTests} from '../tools/verificationCommands.mjs';
const execute=promisify(execFile),script='node --test tests/first.test.mjs && node --test tests/second.test.mjs';

async function fixture(first) {
 const root=await mkdtemp(join(tmpdir(),'hyper dimension verify-'));
 await mkdir(join(root,'tests'));
 await writeFile(join(root,'tests/first.test.mjs'),first);
 await writeFile(join(root,'tests/second.test.mjs'),"import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';test('second group observes completed first',()=>{assert.equal(readFileSync(new URL('../first.done',import.meta.url),'utf8'),'complete');writeFileSync(new URL('../second.done',import.meta.url),'complete');});\n");
 // Launch an actual independent CLI, rather than inheriting the parent test
 // runner's internal child context (which suppresses this nested test harness).
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 return {root,run:args=>execute(process.execPath,args,{cwd:root,env,windowsHide:true,timeout:15000})};
}

test('Agent verification executes both real test groups in order, including paths under a spaced temporary root',async()=>{
 const f=await fixture("import test from 'node:test';import {writeFileSync} from 'node:fs';test('first group',async()=>{await new Promise(r=>setTimeout(r,100));writeFileSync(new URL('../first.done',import.meta.url),'complete');});\n");
 await runVerificationTests(script,f.run);
 assert.equal(await readFile(join(f.root,'second.done'),'utf8'),'complete');
});

test('a failed real first test group prevents launching the isolated second group',async()=>{
 const f=await fixture("import test from 'node:test';import assert from 'node:assert/strict';test('owned intentional failure',()=>assert.fail('stop before second group'));\n");
 await assert.rejects(runVerificationTests(script,f.run));
 await assert.rejects(access(join(f.root,'second.done')),error=>error.code==='ENOENT');
});

test('the actual release default preserves its final runtime isolation group and every listed file',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')),commands=verificationCommands(pkg.scripts.test);
 assert.equal(commands.length,2);
 assert.deepEqual(commands[1],['--test','tests/v103-runtime-scope.test.mjs']);
 const files=commands.flatMap(args=>args.slice(1));
 assert.equal(new Set(files).size,files.length);
 assert(files.includes('tests/v299-agent-verification.test.mjs'));
 for(const file of files)await access(new URL('../'+file,import.meta.url));
});

test('invalid or shell-bearing verification chains are rejected before any process can start',async()=>{
 for(const value of ['',null,'node --test tests/first.test.mjs &&','python tests/first.test.mjs','node --test tests/../first.mjs','node --test tests/first.mjs;touch','node --test $(whoami)','node --test tests/first.test.mjs || node --test tests/second.test.mjs']){
  let calls=0;await assert.rejects(runVerificationTests(value,async()=>calls++));assert.equal(calls,0);
 }
});
