import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {RAW_MATERIALS} from '../src/contentCatalog.js';

const out=resolve(process.env.HD_QA_OUT||'qa/v213/native-task-chains');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(out,'fictional-lan-'));
const service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-TASK-CHAIN'}),base='http://127.0.0.1:'+service.port;
const report={scope:'Native manual-chat queue registration, actual NPC movement/tool actions and authoritative task receipts, mid-chain reload and empty-browser reopen. Fictional accounts, zero initial materials, needs fixture, deterministic model reply; providers blocked, no accelerated clock, no user browser/data. Not real model decision or human acceptance.',cases:[],passed:false};let browser;
try{
 browser=await chromium.launch(browserLaunchOptions());
 const results=await Promise.allSettled(['pixel','origami'].map(async theme=>{
  const row={theme,errors:[],passed:false};report.cases.push(row);
  const account=await service.identities.register({login:'chain_'+theme,password:'fictional-chain-password',name:'顺序分工岛主',islandName:'队列验证岛',avatar:'female_1',theme});
  const tenant=await service.tenants.get(account.token);await tenant.saves.open(theme,{});
  const original=await tenant.saves.current(theme),state=structuredClone(original.state);for(let i=0;i<16;i++)state.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};await tenant.saves.save(theme,{state,expectedVersion:original.version});
  const shell=RAW_MATERIALS.find(i=>i.source==='shore').id;
  const commands=[{id:'first',npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'先到林地收两份木材'},
   {id:'second',npcId:5,goal:'dock',resource:shell,quantity:1,intent:'再到海边拾取材料',dependsOn:['first']},
   {id:'third',npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'最后回林地补两份木材',dependsOn:['second']}];
  const open=async()=>{
   const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;
    if(path==='/api/hermes/command')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'hermes',model:'deepseek-flash',answer:'已提出三步顺序分工，等实际动作完成后记录。',runId:'fictional-chain-'+theme,commands,plans:[],parties:[],operations:[]})});
    if(/^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick')return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Isolated queue validation: providers disabled"}'});return r.continue();});
   const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));await page.goto(base+'/play?qa=1');
   await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!islandInspect().startup.busy&&!document.querySelector('#islandBootNotice'),null,{timeout:60000});return{context,page};
  };
  let {context,page}=await open();
  try{
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   await page.locator('#stewardBtn').click();await page.locator('#hermesInput').fill('请让同一位居民先收木材，再去海边，最后回林地；按顺序完成。');await page.locator('#hermesSend').click();
   await page.waitForFunction(()=>islandInspect().agentTaskLedger.filter(t=>['first','second','third'].includes(t.id)).length===3,null,{timeout:30000});
   await page.waitForFunction(()=>islandInspect().chat.messages.some(m=>m.status==='done'&&m.text.includes('三步顺序分工')));assert.equal(await page.locator('#stewardTasks .steward-task-dependency').count(),2);await page.screenshot({path:join(out,theme+'-queued.png')});await page.locator('#closeModal').click();
   const initial=await page.evaluate(()=>({x:islandInspect().npcs[5].x,y:islandInspect().npcs[5].y}));
   await page.waitForFunction(()=>islandInspect().agentTaskLedger.find(t=>t.id==='first')?.status==='done',null,{timeout:120000});
   const beforeReload=(await tenant.saves.current(theme)).state.agentTaskLedger.filter(t=>['first','second','third'].includes(t.id));assert.notEqual(beforeReload[2].status,'done');row.partialProgressBeforeReload=beforeReload.map(t=>({id:t.id,status:t.status,completed:t.completed}));
   await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!islandInspect().startup.busy,null,{timeout:60000});
   await page.waitForFunction(()=>islandInspect().agentTaskLedger.find(t=>t.id==='third')?.status==='done',null,{timeout:240000});
   const final=await tenant.saves.current(theme),tasks=commands.map(c=>final.state.agentTaskLedger.find(t=>t.id===c.id));assert(tasks.every((t,i)=>t.status==='done'&&t.completed===commands[i].quantity&&t.evidence.length===1));
   const receipts=final.actions.receipts.filter(r=>r.outcome==='finished'&&commands.some(c=>c.id===r.ticket.assignmentId));assert.equal(receipts.length,3);assert.deepEqual(receipts.map(r=>r.ticket.assignmentId),['first','second','third']);
   const position=await page.evaluate(()=>({x:islandInspect().npcs[5].x,y:islandInspect().npcs[5].y}));assert(receipts.some(r=>r.ticket.intent.goal==='dock'));row.realTaskReceipts=receipts.map(r=>({assignmentId:r.ticket.assignmentId,requestId:r.ticket.requestId,gain:r.gain}));row.initial=initial;row.finalPosition=position;
   await context.close();({context,page}=await open());const reopened=await page.evaluate(()=>islandInspect().agentTaskLedger);assert(commands.every(c=>reopened.find(t=>t.id===c.id)?.completed===c.quantity));await page.locator('#stewardBtn').click();await page.screenshot({path:join(out,theme+'-completed-reopened.png')});assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(e){row.failure=e.stack;row.diagnostic=await page.evaluate(()=>({startup:window.islandInspect?.().startup,tasks:window.islandInspect?.().agentTaskLedger,npc:window.islandInspect?.().npcs[5]})).catch(()=>null);await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});throw e;}
  finally{await context.close();}
 }));const failures=results.filter(r=>r.status==='rejected');if(failures.length)throw failures[0].reason;report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser?.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
