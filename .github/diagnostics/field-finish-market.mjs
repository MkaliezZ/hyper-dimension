// Deliberately create one real controller-owned NPC mining job before the
// original shelf case. Autonomous schedules cannot guarantee fault coverage.
// Original work, timeout, sale, stock, reload and fault-occurrence gates remain.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.env.HD_DIAGNOSTIC_APP_ROOT||'island');
const {chromium}=createRequire(join(root,'package.json'))('playwright-core');
const launch=chromium.launch.bind(chromium),preparations=[];
const expose=`
window.__ownedMineReceiptPreparation=async()=>{
 const ticket=await serverFieldNpc.begin({npcId:15},{mineIndex:1,resource:'stone'});
 if(!ticket)throw Error('The declared mining job must have a live lease');
 const beforeHp=state.oreNodes[1].hp;
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,ticket.readyAt-Date.now()+50)));
 const result=await serverFieldNpc.finish(ticket);
 return {requestId:ticket.requestId,actorId:ticket.actorId,startedAt:ticket.startedAt,readyAt:ticket.readyAt,finishedAt:Date.now(),gain:result.receipt.gain,beforeHp,afterHp:state.oreNodes[1].hp,pending:!!saves.pendingAction(theme),receipts:saves.status(theme).actions.receipts.filter(row=>row.ticket.requestId===ticket.requestId).length};
};`;
chromium.launch=async(...args)=>{
 const browser=await launch(...args),newContext=browser.newContext.bind(browser);
 browser.newContext=async(...args)=>{
  const context=await newContext(...args),route=context.route.bind(context),newPage=context.newPage.bind(context);let prepared=false;
  context.route=(pattern,handler,...options)=>route(pattern,actual=>{
   if(pattern!=='**/src/app.js')return handler(actual);
   // Preserve the existing observation route and unmodified application source.
   return handler(new Proxy(actual,{get(target,key){
    if(key==='fetch')return async(...args)=>{const response=await target.fetch(...args);return new Proxy(response,{get(value,name){if(name==='text')return async()=>await value.text()+expose;const member=Reflect.get(value,name,value);return typeof member==='function'?member.bind(value):member;}});};
    const member=Reflect.get(target,key,target);return typeof member==='function'?member.bind(target):member;
   }}));
  },...options);
  context.newPage=async(...args)=>{
   const page=await newPage(...args),goto=page.goto.bind(page);
   page.goto=async(...args)=>{
    const response=await goto(...args);
    if(!prepared&&new URL(args[0]).pathname==='/play'){
     prepared=true;await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
     const result=await page.evaluate(()=>window.__ownedMineReceiptPreparation());
     assert.deepEqual(result.gain,{stone:1});assert.equal(result.beforeHp-result.afterHp,1);assert.equal(result.receipts,1);assert.equal(result.pending,false);assert(result.readyAt-result.startedAt===20000&&result.finishedAt>=result.readyAt+11500);
     preparations.push(result);
    }
    return response;
   };return page;
  };return context;
 };return browser;
};
process.env.HD_QA_WORK_JOURNAL='1';process.chdir(root);
await import(pathToFileURL(join(root,'tests/v321-field-finish-market-browser.mjs')));
assert(!process.exitCode);assert.equal(preparations.length,2);
console.log(JSON.stringify({explicitControllerPreparation:true,actualTwentySecondWorkAndOriginalTwelveSecondExpiration:true,oneRealReceiptPerStyle:true,allOriginalShelfAndFaultGatesRetained:true,autonomousNpcMovementClaimed:false}));
