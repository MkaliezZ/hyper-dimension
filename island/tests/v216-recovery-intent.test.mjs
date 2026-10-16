import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRecoveryReentry,hasRecoveryReentry,clearRecoveryReentry} from '../src/recoveryIntent.js';
test('recovery re-entry requires the durable-checkpoint session intent for this island and theme',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},options={storage,namespace:'fictional-island:',href:'http://127.0.0.1/play?theme=pixel#island',now:1000};
 const href=prepareRecoveryReentry('pixel',options),current={...options,href};
 assert.equal(hasRecoveryReentry('pixel',current),true);assert.equal(hasRecoveryReentry('origami',current),false);assert.equal(hasRecoveryReentry('pixel',{...current,namespace:'another-island:'}),false);assert.equal(hasRecoveryReentry('pixel',{...current,href:href.replace(/recoveryReturn=[^&#]+/,'recoveryReturn=unapproved')}),false);
 assert.equal(hasRecoveryReentry('pixel',{...current,now:999}),false);assert.equal(hasRecoveryReentry('pixel',{...current,now:1801000}),false);clearRecoveryReentry('pixel',current);assert.equal(hasRecoveryReentry('pixel',current),false);
});
test('an unavailable session journal leaves a usable link without granting automatic reconciliation',()=>{
 const options={storage:{getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}},namespace:'fictional:',href:'http://127.0.0.1/play',now:1000};
 const href=prepareRecoveryReentry('pixel',options);assert.equal(new URL(href).pathname,'/play');assert.equal(hasRecoveryReentry('pixel',{...options,href}),false);
});
