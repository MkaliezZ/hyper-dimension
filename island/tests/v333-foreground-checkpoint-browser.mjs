import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';

const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v333/native-foreground-checkpoint');await mkdir(out,{recursive:true});
const variants=['current'];
const gate=()=>{let release;return{promise:new Promise(r=>release=r),release:()=>release()};};
async function bounded(promise,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label)),10000))]);}finally{clearTimeout(timer);}}
const report={scope:'Actual native SaveClient Worker/IndexedDB,HTTP SaveStore/disk and native user button. Hold actual committed save responses,retain later simulation edits and prove a mutation still waits. Model submission is only an observed callback,not a real provider call,whole game,hosted recovery or human acceptance. No user data or clocks changed.',cases:[],passed:false,wholeGoalComplete:false};
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const variant of variants)for(const theme of ['pixel','origami'])for(const mode of ['foreground','ordinary']){
  const row={variant,theme,mode,requests:[],errors:[],passed:false};report.cases.push(row);
  const directory=await mkdtemp(join(out,theme+'-'+mode+'-')),store=createSaveStore({directory});await store.openClient(theme,{});
  const entered=[null,gate(),gate(),gate()],release=[null,gate(),gate(),gate()];let saves=0,actions=0;
  const server=createServer(async(req,res)=>{try{
   const path=new URL(req.url,'http://owned').pathname;
   if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
   if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><button id="send">交给管家</button><p id="status"></p>');}
   if(path.startsWith('/api/saves/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?JSON.parse(Buffer.concat(chunks)):undefined,operation=path.split('/')[4]||'read';
    let result;
    if(operation==='open')result=await store.openClient(theme,body);
    else if(operation==='save'){
     result=await store.save(theme,body);const n=++saves;assert(n<=3,'Unexpected extra save');
     row.requests.push({operation,n,version:result.document.version,userMessages:result.document.state.stewardChat?.messages?.filter(m=>m.role==='user').length||0});entered[n].release();await release[n].promise;
    }else if(operation==='action'){actions++;result=await store.action(theme,body);row.requests.push({operation,requestId:body.requestId});}
    else result={document:await store.current(theme)};
    res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
   }
   const file=resolve(root,'.'+path);assert(path.startsWith('/src/')&&file.startsWith(root+sep));res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
  }catch(error){row.errors.push({message:error.message,code:error.code});res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',error=>row.errors.push({message:error.message}));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.evaluate(async({theme,mode})=>{
    const {createSaveClient}=await import('/src/saveClient.js');let state;
    const client=createSaveClient({loadLocal:()=>({saveSlot:'hyper-dimension-'+theme+'-v3',workshopBests:{}}),storeLocal(){throw Error('Strict Worker journal required');},onRemoteState:(_,next)=>state=next});state=await client.load(theme);
    const fixture=window.checkpointFixture={client,theme,state:()=>state,promises:[],checkpointDone:false,error:null};
    const watch=p=>{fixture.promises.push(p);p.catch(error=>fixture.error=error.message);return p;};
    document.querySelector('#send').onclick=()=>{
     state.stewardChat??={messages:[]};state.stewardChat.messages.push({id:1,role:'user',text:'保留这次的分工指令',status:'sent',day:state.day});client.enqueue(theme,state);
     watch(client.checkpoint(theme,{foreground:mode==='foreground'}).then(()=>{fixture.checkpointDone=true;document.querySelector('#status').textContent='本次指令已保存';}));
    };
    fixture.begin=()=>{state.player.x++;client.enqueue(theme,state);watch(client.flush(theme));};
    fixture.ordinaryWaiter=()=>watch(client.flush(theme));
    fixture.laterEdit=()=>{state.player.y++;client.enqueue(theme,state);watch(client.flush(theme));};
    fixture.mutate=()=>watch(client.action(theme,{kind:'personal',operation:'avatar',target:'butler',avatarId:'female_5',day:state.day,requestId:crypto.randomUUID()}));
    fixture.finish=()=>Promise.all(fixture.promises);
    fixture.begin();
   },{theme,mode});
   await bounded(entered[1].promise,'First real save did not commit');await page.evaluate(()=>{checkpointFixture.ordinaryWaiter();});
   await page.locator('#send').click();assert.equal(await page.evaluate(()=>checkpointFixture.checkpointDone),false,'The earlier active save still blocks');
   release[1].release();await bounded(entered[2].promise,'User-input save did not commit');
   const second=await store.current(theme);assert.equal(second.state.stewardChat.messages[0].text,'保留这次的分工指令','The actual canonical second save must contain the user input');
   await page.evaluate(()=>checkpointFixture.laterEdit());release[2].release();await bounded(entered[3].promise,'Later simulation save did not commit');
   const releaseBeforeLaterSave=mode==='foreground';
   if(releaseBeforeLaterSave)await page.waitForFunction(()=>checkpointFixture.checkpointDone||checkpointFixture.error,null,{timeout:3000});else await page.waitForTimeout(350);
   row.beforeLaterReply=await page.evaluate(()=>({done:checkpointFixture.checkpointDone,error:checkpointFixture.error}));assert.equal(row.beforeLaterReply.error,null);assert.equal(row.beforeLaterReply.done,releaseBeforeLaterSave);
   await page.evaluate(()=>{checkpointFixture.mutate();});await page.waitForTimeout(150);assert.equal(actions,0,'A mutation must still wait for the actual later save');
   release[3].release();await page.evaluate(()=>checkpointFixture.finish());await page.evaluate(()=>checkpointFixture.client.idle(checkpointFixture.theme));
   const final=await store.current(theme);assert.equal(final.state.stewardChat.messages[0].text,'保留这次的分工指令');assert.equal(final.state.player.y,second.state.player.y+1);assert.equal(final.state.butlerAvatar,'female_5');assert.equal(final.state.coins,0);assert(Object.values(final.state.inventory).every(v=>v===0));assert.equal(actions,1);assert.equal(saves,3);assert.deepEqual(row.errors,[]);
   row.canonicalInputPreserved=true;row.laterEditPreserved=true;row.mutationWaited=true;row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;}
  finally{for(const g of release)g?.release();await context.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(row=>row.passed);
}finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,variant,mode,passed,failure,beforeLaterReply})=>({theme,variant,mode,passed,failure,beforeLaterReply}))},null,2));}
