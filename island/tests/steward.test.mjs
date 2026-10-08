import test from 'node:test';import assert from 'node:assert/strict';
import {localSteward,providerFailure} from '../server/stewardFallback.mjs';
test('provider billing is explicit and not reported as successful Hermes',()=>{
 const f=providerFailure('Hermes RuntimeError: DeepSeek HTTP 402');
 const data=localSteward({day:3,inventory:{wood:1,ore:0},built:[{id:0}],recipes:[{id:'recipe_lantern'}],economy:{arrivals:2}},'准备灯笼',f);
 assert.equal(data.source,'local');assert.equal(data.errorCode,'provider_balance');assert.equal(data.commands.length,0);
 assert.match(data.answer,/HTTP 402/);assert.match(data.answer,/木材 ×1/);assert.match(data.answer,/石英 ×1/);assert.match(data.answer,/蜂蜡 ×1/);assert.match(data.answer,/植物纤维 ×1/);assert.match(data.answer,/未派发新任务/);
});
test('fallback cannot claim locked recipes or manufacture successful actions',()=>{
 const data=localSteward({day:1,inventory:{},built:[],recipes:[],economy:{arrivals:0}},'帮我准备夜集',providerFailure('timeout'));
 assert.ok(!data.answer.includes('材料已齐'));assert.equal(data.commands.length,0);assert.equal(data.retryAfter,30);
});
