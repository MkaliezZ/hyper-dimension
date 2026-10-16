import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';

const root=resolve('.'),out=resolve(process.env.HD_QA_OUT||'qa/v232/farm-component');await mkdir(out,{recursive:true});
const report={scope:'Actual browser component with controlled acknowledged/local farm snapshots and request spy. Not a complete gameplay, real server harvest or human test.',cases:[],passed:false};
const server=createServer(async(req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body></body></html>');return;}
 try{const name=new URL(req.url,'http://127.0.0.1').pathname;if(!name.startsWith('/src/')||extname(name)!=='.js'||name.includes('..'))throw Error('route');const file=resolve(root,'.'+name);if(!file.startsWith(root))throw Error('path');res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}
});
let browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  const result=await page.evaluate(async theme=>{
   const {createServerFarm}=await import('/src/serverFarmUI.js');
   const state={plots:Array.from({length:8},()=>({stage:3,crop:'wheat',growth:0}))};state.plots[1].stage=4;
   const book={plots:structuredClone(state.plots),leases:{}};book.plots[1].stage=3;
   const status={state,actions:{farm:book}},calls=[];let persists=0;
   const farm=createServerFarm({saves:{status:()=>status,pendingAction:()=>null,action:async(_,input)=>{calls.push(input);return{state,ticket:{requestId:input.requestId,actor:'npc',actorId:0,index:1,step:'harvest',crop:'wheat'},receipt:null};}},theme:()=>theme,persist:()=>persists++,applyState(){},startAnimation(){},stopAnimation(){},onReceipt(){},onRelease(){},toast(){}});
   const deferred=await farm.beginNpc({npcId:0},{farmIndex:1,resource:'wheat'},'harvest');const before={deferred:deferred===null,calls:calls.length,persists,jobs:farm.inspect().jobs.length,ready:farm.ready(1,4,'wheat')};
   book.plots[1].stage=4;const wrongCrop=farm.ready(1,4,'carrot'),ticket=await farm.beginNpc({npcId:0},{farmIndex:1,resource:'wheat'},'harvest');
   return{before,after:{calls:calls.length,persists,jobs:farm.inspect().jobs.length,step:calls[0]?.step,ticket:!!ticket,wrongCrop}};
  },theme);
  assert.deepEqual(result.before,{deferred:true,calls:0,persists:0,jobs:0,ready:false});assert.deepEqual(result.after,{calls:1,persists:1,jobs:1,step:'harvest',ticket:true,wrongCrop:false});report.cases.push({theme,...result,passed:true});await page.close();
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
