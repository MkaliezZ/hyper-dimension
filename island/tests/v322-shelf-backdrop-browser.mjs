// Original native PNG, sale and reload gates plus a held-backdrop/resume check.
// Only read-only counters are appended to the served owned fixture source.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const out=resolve(process.env.HD_QA_OUT||'qa/v322/native-shelf-backdrop');await mkdir(out,{recursive:true});
process.env.HD_QA_OUT=out;process.env.HD_QA_WORK_JOURNAL='1';
const launch=chromium.launch.bind(chromium),observations=[];
chromium.launch=async(...args)=>{
 const browser=await launch(...args),create=browser.newContext.bind(browser);
 browser.newContext=async(...args)=>{
  const context=await create(...args),route=context.route.bind(context),newPage=context.newPage.bind(context),close=context.close.bind(context),row={index:observations.length,passed:false};observations.push(row);let page,closed=false;
  context.route=(pattern,handler,...options)=>route(pattern,actual=>{
   if(pattern!=='**/src/app.js')return handler(actual);
   return handler(new Proxy(actual,{get(target,key){
    if(key==='fetch')return async(...args)=>{const response=await target.fetch(...args);return new Proxy(response,{get(value,name){
     if(name==='text')return async()=>{
      let source=await value.text();const insert=(needle,replacement)=>{assert.equal(source.split(needle).length,2);source=source.replace(needle,replacement);};
      insert('function render(){','function render(){window.__shelfPaintChecks=(window.__shelfPaintChecks||0)+1;');
      insert('function drawWorld(){','function drawWorld(){window.__shelfWorldDraws=(window.__shelfWorldDraws||0)+1;');return source;
     };const member=Reflect.get(value,name,value);return typeof member==='function'?member.bind(value):member;
    }});};const member=Reflect.get(target,key,target);return typeof member==='function'?member.bind(target):member;
   }}));
  },...options);
  context.newPage=async(...args)=>{page=await newPage(...args);return page;};
  context.close=async()=>{
   if(closed)return close();closed=true;
   try{
    assert(page&&!page.isClosed());assert.equal(await page.locator('.shopfront-modal #shopfrontForm').count(),1,'The original shelf case must reach its reopened form');
    const sample=()=>page.evaluate(()=>({checks:window.__shelfPaintChecks||0,draws:window.__shelfWorldDraws||0,clock:window.__nativeWorkObservation?.().gameSeconds,frameLoop:window.__nativeWorkObservation?.().frameLoop?.running}));
    row.before=await sample();await page.waitForTimeout(1200);row.held=await sample();
    assert(row.held.checks>row.before.checks,'Normal frame updates continue');assert(row.held.draws-row.before.draws<=1,'Retain the background, allowing one invalidation paint');assert.equal(row.held.frameLoop,true);assert(row.held.clock>row.before.clock,'The simulation clock continues while the static shelf owns input');
    await page.locator('#closeModal').click();await page.waitForFunction(before=>(window.__shelfWorldDraws||0)>=before+2,row.held.draws,{timeout:5000});row.resumed=await sample();assert.equal(row.resumed.frameLoop,true);row.passed=true;
   }catch(error){row.failure=error.stack;process.exitCode=1;}
   finally{await writeFile(join(out,'backdrop-observation-'+row.index+'.json'),JSON.stringify(row,null,2));await close();}
  };return context;
 };return browser;
};
try{await import('./v228-custom-shops-browser.mjs');assert(!process.exitCode);assert.equal(observations.length,2);assert(observations.every(row=>row.passed));}
finally{await writeFile(join(out,'backdrop-proof.json'),JSON.stringify({scope:'Owned native original shelf flow with read-only paint counters. Original5000ms PNG,finite tourist rotation,150second service,price,cost,stock and reload gates retained. No candidate source patch, actor/clock/result edit, model call or human claim.',passed:observations.length===2&&observations.every(row=>row.passed),observations,wholeGoalComplete:false},null,2));}
