import test from 'node:test';import assert from 'node:assert/strict';import {allowLocalAgentRequest} from '../server/localAgentAccess.mjs';
test('local agent permits same-origin JSON and local command-line clients',()=>{
 const headers={host:'127.0.0.1:4174','content-type':'application/json'};
 assert.ok(allowLocalAgentRequest({method:'POST',headers},4174));
 assert.ok(allowLocalAgentRequest({method:'POST',headers:{...headers,origin:'http://127.0.0.1:4174','sec-fetch-site':'same-origin'}},4174));
});
test('local agent rejects foreign sites, rebound hosts, null origin and simple form POSTs',()=>{
 const base={host:'127.0.0.1:4174','content-type':'application/json'};
 for(const patch of [{origin:'https://example.com'},{host:'attacker.example:4174'},{origin:'null'},{'sec-fetch-site':'cross-site'},{'content-type':'text/plain'},{'content-type':'application/x-www-form-urlencoded'},{origin:'http://127.0.0.1:9999'}]){
  assert.equal(allowLocalAgentRequest({method:'POST',headers:{...base,...patch}},4174),false);
 }
});

