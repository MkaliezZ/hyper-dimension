import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {AVATARS} from '../src/avatarCatalog.js';
const out=resolve(process.env.HD_QA_OUT||'qa/v153/native-portraits');await mkdir(out,{recursive:true});
process.env.DEEPSEEK_API_KEY='';
const directory=await mkdtemp(join(out,'private-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-PORTRAITS'}),base='http://127.0.0.1:'+service.port;
const report={scope:'Real native LAN /play chooser; fictional accounts and isolated saves, no models or user data.',cards:[],checks:[],errors:[]};let browser;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const account=await service.identities.register({login:'portrait_'+theme,password:'fictional-password',name:'样片岛主',islandName:'立绘测试岛',avatar:'male_0',theme}),tenant=await service.tenants.get(account.token);
  const context=await browser.newContext({viewport:{width:1600,height:1200},deviceScaleFactor:1});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  for(const kind of ['npc','hermes'])await context.route('**/api/'+kind+'/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"models disabled in isolated test"}'}));
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!document.getElementById('app').hasAttribute('aria-busy'),null,{timeout:60000});
  if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
  const saveTheme=await page.evaluate(()=>islandInspect().saveTheme),slot=(await tenant.saves.current(saveTheme)).state.saveSlot;
  await page.locator('#stewardBtn').click();await page.locator('#stewardAppearance').click();
  for(const gender of ['男','女']){
   await page.locator('[data-gender="'+gender+'"]').click();
   for(const avatar of AVATARS.filter(a=>a.gender===gender)){
    const selector='[data-avatar="'+avatar.id+'"]';
    await page.locator(selector).click();await page.waitForSelector(selector+'.selected');
    assert.equal((await tenant.saves.current(saveTheme)).state.butlerAvatar,avatar.id,'Avatar choice must be confirmed in this owner save');
   }
   const cards=page.locator('.avatar-card');
   for(let i=0;i<await cards.count();i++){
    const card=cards.nth(i),id=await card.getAttribute('data-avatar');await card.scrollIntoViewIfNeeded();await page.waitForTimeout(70);
    const snapshot=join(out,theme+'-'+id+'.png');await card.screenshot({path:snapshot});
    report.cards.push({theme,id,file:snapshot,...await card.evaluate(el=>{const svg=el.querySelector('svg'),image=el.querySelector('image'),b=el.getBoundingClientRect(),r=svg.getBoundingClientRect();return {name:el.querySelector('b')?.textContent,viewBox:svg.getAttribute('viewBox'),width:r.width,height:r.height,left:r.x-b.x,top:r.y-b.y,background:getComputedStyle(el).backgroundColor,imageHref:image.getAttribute('href'),aspect:svg.getAttribute('preserveAspectRatio')};})});
   }
  }
  await page.locator('[data-avatar="default"]').click();await page.waitForSelector('[data-avatar="default"].selected');
  assert.equal((await tenant.saves.current(saveTheme)).state.butlerAvatar,'default');
  for(const width of [390,768]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   for(const card of await page.locator('.avatar-card').all()){assert((await card.locator(':scope > svg').boundingBox()).width>40);}
   await page.screenshot({path:join(out,theme+'-'+width+'.png')});
  }
  await page.setViewportSize({width:1600,height:1200});await page.locator('[data-gender="女"]').click();await page.locator('[data-avatar="female_0"]').click();await page.waitForSelector('[data-avatar="female_0"].selected');
  await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!document.getElementById('app').hasAttribute('aria-busy'),null,{timeout:60000});
  await page.locator('#stewardBtn').click();await page.locator('#stewardAppearance').click();await page.locator('[data-gender="女"]').click();assert(await page.locator('[data-avatar="female_0"]').evaluate(e=>e.classList.contains('selected')));
  const saved=(await tenant.saves.current(saveTheme)).state;assert.equal(saved.butlerAvatar,'female_0');assert.equal(saved.saveSlot,slot);
  report.checks.push({theme,all13ChoicesConfirmed:true,refreshPreservedAppearance:true,sameSaveSlot:true,narrowWidths:[390,768],portraitAspectPreserved:true});
  await context.close();
 }
 assert.equal(report.errors.length,0);
 const python=process.env.HD_TEST_PYTHON||join(resolve(import.meta.dirname,'..'),'.runtime/python',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 const probeScript=`import json,sys,math,re
from PIL import Image
d=json.load(open(sys.argv[1],encoding="utf-8"))
probes=[("male_1",365,350),("male_1",720,350),("male_2",1083,350),("male_4",360,693),("male_5",375,513),("female_0",737,563)]
checked=[]
for id,x,y in probes:
 r=next(c for c in d["cards"] if c["id"]==id and c["theme"]=="origami")
 vx,vy,vw,vh=map(float,r["viewBox"].split());scale=min(r["width"]/vw,r["height"]/vh)
 cx=r["left"]+(r["width"]-vw*scale)/2+(x-vx)*scale;cy=r["top"]+(r["height"]-vh*scale)/2+(y-vy)*scale
 im=Image.open(r["file"]).convert("RGB");actual=im.getpixel((round(cx),round(cy)));background=im.getpixel((20,im.height-10))
 difference=max(abs(actual[i]-background[i]) for i in range(3))
 assert difference<=3,(id,actual,background,difference)
 checked.append({"id":id,"source":[x,y],"backgroundDifference":difference})
r=next(c for c in d["cards"] if c["id"]=="default" and c["theme"]=="pixel");im=Image.open(r["file"]).convert("RGB")
actual=im.getpixel((30,19));background=im.getpixel((20,im.height-10))
assert max(abs(actual[i]-background[i]) for i in range(3))<=3,"Default steward leaked the preceding atlas row"
print(json.dumps({"foreignArtProbes":checked,"defaultTopStripAbsent":True}))
`;
 const input=join(out,'pixel-probes-input.json');await writeFile(input,JSON.stringify(report));
 const {stdout}=await promisify(execFile)(python,['-X','utf8','-c',probeScript,input],{windowsHide:true,timeout:20000,maxBuffer:8000});report.pixelChecks=JSON.parse(stdout);
 for(const card of report.cards)assert.equal(card.aspect,'xMidYMid meet');
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e.message);}
finally{await browser?.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,pixelChecks:report.pixelChecks,failure:report.failure}));}

