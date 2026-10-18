import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url))),out=resolve(process.env.HD_QA_OUT||'qa/v280/native-module-bootstrap'),baseline=false;await mkdir(out,{recursive:true});
const account='11111111-1111-4111-8111-111111111111';let current;
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://local').pathname;
 if(pathname==='/play'){current.documents++;return res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end('<!doctype html><body data-theme="'+current.theme+'"><main>Isolated module bootstrap fixture</main><script type="module" src="/src/lan-main.js"></script>');}
 if(pathname==='/api/lan/me')return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({account:{id:account,profile:{theme:current.theme}}}));
 if(pathname==='/executed'){current.executions++;return res.writeHead(204).end();}
 const module=body=>res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'}).end(body);
 if(pathname==='/src/worldSession.js')return module('export function worldStorageTheme(){return document.body.dataset.theme;}');
 if(pathname==='/src/lanStewardUI.js')return module('export function createPersonalStewardUI(){return {};}');
 if(pathname==='/src/lanGameDock.js')return module('export function createLanGameDock(){window.__fixtureDockReady=true;}');
 if(pathname==='/src/app.js'){
  current.requests++;
  if((current.mode==='permanent'&&!current.networkRestored)||current.mode==='no-storage'||current.mode==='transient'&&current.requests===1)return res.writeHead(503,{'Content-Type':'text/javascript'}).end('/* explicit isolated static transport failure */');
  return module('window.__hdIslandAppEntered=true;fetch("/executed",{method:"POST"});'+(current.mode==='runtime'?'throw Error("fixture initialization failed after execution");':'window.__fixtureReady=true;'));
 }
 const file=resolve(root,'.'+pathname);if(!file.startsWith(join(root,'src')+sep))return res.writeHead(404).end();
 return module(await readFile(file,'utf8'));
}catch{res.writeHead(500).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch(browserLaunchOptions()),base='http://127.0.0.1:'+server.address().port,report={scope:'Real owned DOM and actual LAN bootstrap/storage/identity modules, with minimal app/steward/dock/world stubs and explicit HTTP503 or post-entry runtime failure. No game renderer, authority, saves, models, user browser or human acceptance.',baseline,cases:[],passed:false};
try{
 for(const[theme,mode]of baseline?[['origami','transient']]:[['pixel','transient'],['origami','transient'],['origami','permanent'],['pixel','runtime'],['pixel','no-storage']]){
  current={theme,mode,requests:0,executions:0,documents:0,errors:[]};report.cases.push(current);const row=current,context=await browser.newContext(),page=await context.newPage(),url=base+'/play?theme='+theme+'&recoveryReturn=fictional-return';
  await context.addInitScript(({account,noStorage,theme})=>{if(noStorage)Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem(){return null},setItem(){throw Error('Fixture session storage unavailable')},removeItem(){},length:0,key(){return null}}});const key='hd-lan:'+account+':fixture-progress';if(localStorage.getItem(key)===null)localStorage.setItem(key,'retained');if(!noStorage){const intent='hd-lan:'+account+':recovery-return:'+theme;if(sessionStorage.getItem(intent)===null)sessionStorage.setItem(intent,JSON.stringify({nonce:'fictional-return',at:Date.now()}));}},{account,noStorage:mode==='no-storage',theme});
  page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(url);
   if(mode==='transient'){
    await page.waitForFunction(()=>window.__fixtureReady&&window.__fixtureDockReady,null,{timeout:baseline?1600:6000});
    assert.equal(row.requests,2);assert.equal(row.documents,2);assert.equal(row.executions,1);assert.equal(page.url(),url);assert.deepEqual(row.errors,[]);
   }else{
    await page.locator('#islandModuleRetry').waitFor({timeout:6000});
    if(mode==='permanent'){await page.waitForFunction(()=>document.querySelector('#islandModuleFailure')?.dataset.automatic==='false',null,{timeout:6000});assert.equal(row.requests,3);assert.equal(row.documents,3);assert.equal(row.executions,0);}
    else{await page.waitForTimeout(1200);assert.equal(row.requests,1);assert.equal(row.documents,1);assert.equal(row.executions,mode==='runtime'?1:0);}
    assert.equal(await page.locator('#islandModuleRetry').getAttribute('href'),url);if(mode==='permanent'){row.networkRestored=true;await page.locator('#islandModuleRetry').click();await page.waitForFunction(()=>window.__fixtureReady&&window.__fixtureDockReady,null,{timeout:6000});assert.equal(row.requests,4);assert.equal(row.documents,4);assert.equal(row.executions,1);assert.equal(page.url(),url);row.manualRecoveryCompleted=true;}
   }
   assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-progress')),'retained');if(mode!=='no-storage')assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('recovery-return:'+document.body.dataset.theme)).nonce),'fictional-return');row.passed=true;
  }catch(e){row.failure=e.stack;process.exitCode=1;throw e;}finally{await context.close();}
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
