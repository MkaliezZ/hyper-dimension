import {chromium} from 'playwright-core';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
import {writeFile} from 'node:fs/promises';
import {solvePacking} from './v18-play-helpers.mjs';
const results=[];
try{
for(const port of [4173,4174]){
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated gameplay QA"}'}));
 await page.goto('http://127.0.0.1:'+port+'/?qa=1');await page.waitForTimeout(500);
 await page.evaluate(async()=>{const {mountRoomGame}=await import('/src/roomGames.js');const {artReady}=await import('/src/artStore.js');await artReady;const el=document.createElement('div');el.id='qaGame';el.style='position:fixed;inset:90px 250px;background:#f2e4c7;padding:30px;z-index:999;overflow:auto';document.body.append(el);window.qaMount=(id)=>{window.qaInstance?.destroy();window.qaReceipt=null;window.qaInstance=mountRoomGame(el,id,r=>window.qaReceipt=r,{seed:7143,difficulty:1})};});
 async function info(){return page.evaluate(()=>window.qaInstance.inspect())}
 async function clickCell(i){await page.locator('#qaGame [data-cell="'+i+'"]').click()}
 for(const id of [3,7,9,11]){
  await page.evaluate(id=>window.qaMount(id),id);let s=await info(),kind=s.kind;
  if(kind==='packing'){await solvePacking(page,info,'#qaGame')}
  else if(kind==='memory'){await page.waitForFunction(()=>!window.qaInstance.inspect().preview);const values=s.values;for(let v=0;v<values.length/2;v++){const pair=values.map((x,i)=>x===v?i:-1).filter(i=>i>=0);for(const i of pair)await clickCell(i)}}
  else if(kind==='match'){
   for(let k=0;k<30&&!(await info()).done;k++){
    await page.waitForFunction(()=>!qaInstance.inspect().busy);
    const move=await page.evaluate(async()=>{const {suggestMatchMove}=await import('/src/classicRules.js');return suggestMatchMove(qaInstance.inspect())});
    assert.ok(move,'match board has a legal move');await clickCell(move[0]);await clickCell(move[1]);
    await page.waitForFunction(()=>!qaInstance.inspect().busy||qaInstance.inspect().done,{},{timeout:20000});
   }
  }else if(kind==='link'){
   for(let k=0;k<30&&!(await info()).done;k++){
    const move=(await info()).legalMove;assert.ok(move,'link board has a reachable pair');await clickCell(move.a);await clickCell(move.b);
    await page.waitForFunction(()=>!qaInstance.inspect().busy||qaInstance.inspect().done);
   }
  }else if(kind==='orders'){
   const ids=id===2?['fish','wheat','tomato','rice']:['herb','mint','lavender','wax'];
   for(const order of s.level.orders){for(const i of order.ingredients)await page.locator('#qaGame .activity-item').nth(i).click();for(let i=0;i<order.ingredients.length;i++)await page.getByRole('button',{name:'处理食材',exact:true}).click();await page.getByRole('button',{name:'入锅温煮',exact:true}).click();await page.waitForTimeout(order.cook*1000+150);await page.getByRole('button',{name:'装盘 / 装瓶',exact:true}).click();}
  }else if(['dress','decorate'].includes(kind)){
   const items=s.level.arrangement.items;
   for(let i=0;i<3;i++){await page.locator('#qaGame [data-item="'+items[i]+'"]').click();await page.locator('#qaGame [data-slot="'+i+'"]').click();}
  }else if(kind==='puzzle'){
   for(let i=0;i<s.order.length;i++){const z=await info();if(z.order[i]!==i){await clickCell(i);await clickCell(z.order.indexOf(i));}}
  }else if(kind==='maze'){
   const z=await info(),walls=new Set(z.walls);let p=z.position;
   for(const target of [...z.targets,z.exit]){const queue=[[p]],seen=new Set([p]);let path;while(queue.length){const a=queue.shift(),last=a.at(-1);if(last===target){path=a;break}for(const n of [last-8,last+8,last-1,last+1])if(n>=0&&n<48&&!seen.has(n)&&!walls.has(n)&&Math.abs(n%8-last%8)+Math.abs(Math.floor(n/8)-Math.floor(last/8))===1){seen.add(n);queue.push([...a,n])}}assert.ok(path);for(const n of path.slice(1))await clickCell(n);p=target;}
  }else if(['trace','fishing','notes','launch','boat'].includes(kind)){
   if(kind==='notes')await page.locator('#qaGame [data-session="pause"]').click();
   const canvas=page.locator('#qaGame .activity-canvas'),box=await canvas.boundingBox(),point=(x,y)=>({x:box.x+x/600*box.width,y:box.y+y/340*box.height});
   if(kind==='trace'){await page.waitForTimeout(80);const z=await info(),first=point(z.path[0].x,z.path[0].y);await page.mouse.move(first.x,first.y);await page.mouse.down();for(const p of z.path){const a=point(p.x,p.y);await page.mouse.move(a.x,a.y);await page.waitForTimeout(18)}await page.mouse.up();}
   if(kind==='fishing'){
    for(let k=0;k<500&&!(await info()).done;k++){const z=await info();const hold=z.bar>z.fishY;await page.keyboard[hold?'down':'up']('Space');await page.waitForTimeout(25);}await page.keyboard.up('Space');
   }
   if(kind==='notes'){for(let k=0;k<300&&!(await info()).done;k++){const z=await info(),n=z.notes.find(n=>!n.hit&&!n.miss&&Math.abs(z.t-n.at)<.1);if(n)await page.keyboard.press(['a','s','d','f'][n.lane]);await page.waitForTimeout(25);}}
   if(kind==='launch'){const z=await info();for(const p of z.targets){const a=point(p.x,p.y);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.waitForTimeout((s.level.launch.charge+.12)*1000);await page.mouse.up();await page.waitForTimeout(750);}}
   if(kind==='boat'){
    await page.waitForTimeout(80);let z=await info();for(const p of [...z.buoys,{x:540,y:285}]){const a=point(p.x,p.y);await page.mouse.move(a.x,a.y);await page.mouse.down();for(let k=0;k<200;k++){z=await info();if(Math.hypot(z.pos.x-p.x,z.pos.y-p.y)<22)break;await page.waitForTimeout(50)}await page.mouse.up();await page.waitForTimeout(100)}await page.waitForTimeout(500);
   }
  }else if(kind==='connect'){for(const name of await page.evaluate(()=>window.qaInstance.config.steps))await page.locator('#qaGame').getByRole('button',{name,exact:true}).click();}
  else if(kind==='balance'){const controls=await page.evaluate(()=>window.qaInstance.config.controls);for(let i=0;i<controls.length;i++){const val=(controls[i][1]+controls[i][2])/2;await page.locator('#qaGame input').nth(i).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))},val)}await page.waitForFunction(()=>qaInstance.inspect().stable>=qaInstance.inspect().stableSeconds);await page.locator('#qaGame').getByRole('button',{name:'确认状态',exact:true}).click();}
  else if(kind==='sort'){const config=await page.evaluate(()=>window.qaInstance.config);for(let i=0;i<config.items.length;i++){await page.locator('#qaGame [data-item="'+i+'"]').click();await page.locator('#qaGame .sort-bin').nth(config.items[i][1]).click();}}
  else if(kind==='dial'){for(const target of await page.evaluate(()=>window.qaInstance.config.targets)){let angle=Number((await page.locator('#qaGame #heading').innerText()).replace('°',''));while(angle!==target){await page.locator('#qaGame').getByRole('button',{name:'顺时针 +15°',exact:true}).click();angle=(angle+15)%360}await page.locator('#qaGame').getByRole('button',{name:'锁定航标',exact:true}).click();}}
  else if(kind==='focus'){
   for(const shot of s.level.photos){await page.locator('#qaGame #photoSubject').click({force:true});await page.locator('#qaGame #photoFocus').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))},shot.focus);await page.locator('#qaGame').getByRole('button',{name:'按下快门',exact:true}).click();}
  }
  s=await info();if(!s.done){console.log('UNFINISHED',port,id,kind,JSON.stringify(s));await page.screenshot({path:'qa/v18-failed-'+port+'-'+id+'.png'});throw Error('Unfinished game '+id)}
  const claim=page.locator('#qaGame').getByRole('button',{name:/领取/});
  assert.equal(await claim.count(),1,'game passes '+id+' '+kind);
  await claim.click();assert.equal(await page.evaluate(()=>window.qaReceipt?.passed),true);
  results.push({port,id,kind,quality:await page.evaluate(()=>window.qaReceipt.quality)});console.log('PASS',port,id,kind);
 }
 assert.deepEqual(errors,[]);await page.close();
}
 await writeFile('qa/v18-games-qa.json',JSON.stringify({passes:results.length,results},null,2));
}finally{await browser.close()}console.log(JSON.stringify({passes:results.length,kinds:[...new Set(results.map(r=>r.kind))]}));

