import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {readBrowserSaveJournal} from './save-journal-browser-helper.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';

const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v355/native-publication'),sha=value=>createHash('sha256').update(value).digest('hex');
await mkdir(out,{recursive:true});const report={scope:'Lightweight native DOM/IndexedDB/production SaveClient and actual HTTP/disk SaveStore, without map rendering or model calls. A real committed retirement acknowledgement is held while actual user draft edits/reload occur. Avatar action and declared0.1second active-clock save exercise atomic snapshot/stamp/retirement, exact replay and empty-browser reopen. All resources start and remain0. Not a natural-time game run, physical Mac or human acceptance.',sourceHashes:Object.fromEntries(await Promise.all(['saveClient.js','saveJournal.js','saveWorker.js'].map(async name=>[name,sha(await readFile(join(root,'src',name)))]))),cases:[],passed:false,wholeGoalComplete:false};
const persist=()=>writeFile(join(out,'report.json'),JSON.stringify(report,null,2));let browser;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami'])for(const kind of ['action','save'])for(const mode of ['clean','edit-during-commit','reload-during-commit']){
  const row={theme,kind,mode,requests:[],errors:[],passed:false};report.cases.push(row);const directory=await mkdtemp(join(out,theme+'-'+kind+'-'+mode+'-')),store=createSaveStore({directory});const seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.saveSlot='hyper-dimension-'+theme+'-v3';seed.stewardChat={draft:'before',messages:[],sequence:0};await store.open(theme,{legacyState:seed,protect:true});const before=await store.current(theme);row.initialActiveSeconds=before.actions.commerce.activeSeconds;
  const server=createServer(async(req,res)=>{try{
   const path=new URL(req.url,'http://owned').pathname;if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
   if(path==='/'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});return res.end('<!doctype html><button id="apply">确认操作</button><button id="edit">继续编辑草稿</button>');}
   if(path.startsWith('/api/saves/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks),body=raw.length?JSON.parse(raw):{},operation=path.split('/')[4]||'read';row.requests.push({operation,requestId:body.requestId,saveId:body.saveId,expectedVersion:body.expectedVersion,bodySHA256:sha(raw)});
    const value=operation==='open'?await store.open(theme,body):operation==='save'?await store.save(theme,body):operation==='action'?await store.action(theme,body):{document:await store.current(theme)};res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify(value));
   }
   const file=resolve(root,'.'+path);assert(path.startsWith('/src/')&&file.startsWith(root+sep));res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(await readFile(file));
  }catch(error){row.errors.push({message:error.message,code:error.code});res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.code}));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,context=await browser.newContext(),page=await context.newPage();page.on('pageerror',error=>row.errors.push({message:error.message}));
  await context.addInitScript(()=>{
   const Native=globalThis.Worker;window.__publicationWire=[];
   globalThis.Worker=class extends Native{
    constructor(url,options){super(url,options);if(!new URL(String(url),location.href).pathname.endsWith('/saveWorker.js'))return;const calls=new Map();let handler=null;
     this.postMessage=(data,transfer)=>{const retirement=data.operation==='commit'&&data.value.some(([key,text])=>text===null&&key.endsWith(window.__publicationKind==='action'?'-pending-action':'-pending-clock-save'));calls.set(data.id,{operation:data.operation,retirement});window.__publicationWire.push({id:data.id,operation:data.operation,phase:'sent',retirement});return Native.prototype.postMessage.call(this,data,transfer||[]);};
     Object.defineProperty(this,'onmessage',{configurable:true,get:()=>handler,set:value=>handler=value});
     this.addEventListener('message',event=>{const call=calls.get(event.data.id);window.__publicationWire.push({id:event.data.id,operation:call?.operation,phase:'received',retirement:call?.retirement});const deliver=()=>handler?.call(this,event);if(window.__armPublication&&call?.retirement&&!event.data.error){window.__armPublication=false;window.__publicationHeld=true;window.__releasePublication=deliver;}else deliver();});
    }
   };
  });
  const requestId=randomUUID();
  async function open(target,prepare,navigate=true){if(navigate)await target.goto(base);await target.evaluate(async({theme,kind,mode,prepare,requestId})=>{
   const {createSaveClient}=await import('/src/saveClient.js'),{createZeroState}=await import('/src/freshStart.js');let state;const saves=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){throw Error('Native strict Worker required');},onRemoteState:(_,next)=>state=next});state=await saves.load(theme);const f=window.publication={saves,state:()=>state,done:false,error:null,initialVersion:saves.status(theme).version};window.__publicationKind=kind;
   document.querySelector('#apply').onclick=()=>{window.__armPublication=prepare&&mode!=='clean';const run=kind==='action'?()=>saves.action(theme,{kind:'personal',operation:'avatar',target:'butler',avatarId:'female_1',day:state.day,requestId}):()=>{state.player.x=11;saves.enqueue(theme,state);saves.advanceTime(theme,.1);return saves.flush(theme);};f.promise=run().then(()=>f.done=true).catch(error=>f.error={code:error.code,message:error.message});};
   document.querySelector('#edit').onclick=()=>{state.stewardChat.draft='after';saves.enqueue(theme,state);};
  },{theme,kind,mode,prepare,requestId});}
  try{
   await open(page,true);await page.locator('#apply').click();
   if(mode!=='clean'){
    await page.waitForFunction(()=>window.__publicationHeld||publication.error,null,{timeout:12000});assert.equal(await page.evaluate(()=>publication.error),null);const canonical=await store.current(theme),snapshot=await readBrowserSaveJournal(page,seed.saveSlot),stamp=await readBrowserSaveJournal(page,'hyper-dimension-'+theme+'-journal-stamp');
    assert.deepEqual(snapshot,canonical.state,'The actual IDB state must be committed with request retirement, before acknowledging publication');assert.equal(stamp.version,canonical.version);assert.equal(await readBrowserSaveJournal(page,'hyper-dimension-'+theme+(kind==='action'?'-pending-action':'-pending-clock-save')),null);
    assert.equal(await page.evaluate(theme=>publication.saves.status(theme).version,theme),before.version,'The live version must not publish before the durable acknowledgement');
    await page.locator('#edit').click();
    if(mode==='reload-during-commit'){await page.reload();await open(page,false,false);}
    else await page.evaluate(()=>window.__releasePublication());
   }
   if(mode==='reload-during-commit')assert.equal(await page.evaluate(()=>publication.state().stewardChat.draft),'after');
   else{await page.waitForFunction(()=>publication.done||publication.error,null,{timeout:12000});assert.equal(await page.evaluate(()=>publication.error),null);}
   await page.evaluate(async theme=>{await publication.saves.checkpoint(theme);},theme);const canonical=await store.current(theme);assert.equal(canonical.state.coins,0);assert(Object.values(canonical.state.inventory).every(n=>n===0));
   if(kind==='action'){assert.equal(canonical.state.butlerAvatar,'female_1');assert.equal(canonical.actions.receipts.filter(r=>r.ticket.requestId===requestId).length,1);}
   else assert(Math.abs(canonical.actions.commerce.activeSeconds-row.initialActiveSeconds-.1)<1e-9,'The original accepted clock credit must remain unique');
   if(mode!=='clean')assert.equal(canonical.state.stewardChat.draft,'after');
   const commands=row.requests.filter(r=>kind==='action'?r.operation==='action'&&r.requestId===requestId:r.operation==='save'&&r.saveId&&r.expectedVersion===before.version);assert(commands.length>=1);assert.equal(new Set(commands.map(r=>r.bodySHA256)).size,1,'An interrupted command must keep its original bytes');
   row.wire=await page.evaluate(()=>window.__publicationWire);const fresh=await browser.newContext(),again=await fresh.newPage();await open(again,false);const reopened=await again.evaluate(()=>({coins:publication.state().coins,inventory:publication.state().inventory,avatar:publication.state().butlerAvatar,draft:publication.state().stewardChat.draft}));assert.equal(reopened.coins,0);assert(Object.values(reopened.inventory).every(n=>n===0));if(kind==='action')assert.equal(reopened.avatar,'female_1');if(mode!=='clean')assert.equal(reopened.draft,'after');await fresh.close();
   row.activeSeconds=canonical.actions.commerce.activeSeconds;row.actualEmptyBrowserReopen=true;assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;}
  finally{await page.evaluate(()=>window.__releasePublication?.()).catch(()=>{});await context.close();await new Promise(r=>server.close(r));await persist();}
 }
 report.passed=report.cases.length===12&&report.cases.every(row=>row.passed);
}finally{await browser?.close();await persist();console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,kind,mode,passed,failure})=>({theme,kind,mode,passed,failure}))}));}
