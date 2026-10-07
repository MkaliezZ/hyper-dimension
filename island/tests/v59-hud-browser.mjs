import {chromium} from 'playwright-core';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createLanHttpServer} from '../server/lanServer.mjs';
const out='qa/v59';await mkdir(out,{recursive:true});
const directory=await mkdtemp(resolve(out+'/fixture-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'HUD-V59-FIXTURE'}),base='http://127.0.0.1:'+service.port;
const report={checks:[],errors:[],badAssets:[],fixture:directory};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
let page;
try{
const c=await browser.newContext({viewport:{width:1440,height:1000}});page=await c.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url());});
await page.goto(base+'/?qa=1');await page.locator('#lanRegisterTab').click();
for(const [id,value] of [['lanLogin','hud_v59'],['lanPassword','fixture-password'],['lanName','美术验收'],['lanIsland','图标验收岛'],['lanEnrollment','HUD-V59-FIXTURE']])await page.locator('#'+id).fill(value);
await page.locator('#lanTheme').selectOption('pixel');await page.locator('#lanAuthSubmit').click();await page.waitForSelector('#lanCreateForm');
const token=(await c.cookies()).find(x=>x.name==='hd_lan_session').value;
for(const theme of ['pixel','origami']){await service.tenants.open(token,theme,{});const tenant=await service.tenants.get(token),doc=await tenant.saves.current(theme),state=structuredClone(doc.state);state.freshStartPending=false;await tenant.saves.save(theme,{state,expectedVersion:doc.version});}
await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.hdLanBridge);
for(const theme of ['pixel','origami','pixel']){
 await page.locator('#theme'+(theme==='pixel'?'Pixel':'Origami')).click();
 await page.waitForFunction(t=>document.body.dataset.theme===t,theme);
 await page.waitForFunction(t=>document.querySelectorAll('.hud-art-icon').length===14&&[...document.querySelectorAll('.hud-art-icon')].every(x=>x.complete&&x.naturalWidth===128&&x.src.includes('/ui-hud-v59/'+t+'-')),theme);
 if(report.checks.length===2){report.checks.push({roundTripTheme:true,lanIconUpdated:true});break;}
 const refs=await page.locator('.quick-actions [data-go]:not([data-go="workshop"]) image').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')));assert.equal(refs.length,4);assert(refs.every(x=>x.includes('items-'+theme+'-products-0-v8.png')));
 await page.screenshot({path:out+'/'+theme+'-desktop.png'});
 await page.locator('.game-toolbar').screenshot({path:out+'/'+theme+'-toolbar.png'});
 await page.locator('.bottom-bar').screenshot({path:out+'/'+theme+'-bottom.png'});
 await page.locator('#bagBtn').click();await page.waitForSelector('.modal-overlay');await page.locator('.modal-overlay .close').first().click();await page.waitForSelector('.modal-overlay',{state:'hidden'});
 await page.locator('#lanGameOpen').click();await page.waitForSelector('#lanGameFrame');await page.locator('#lanGameClose').click();await page.waitForSelector('#lanGameOverlay',{state:'detached'});
 await page.setViewportSize({width:390,height:780});await page.screenshot({path:out+'/'+theme+'-compact.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const bounds=await page.locator('.hud-art-icon').evaluateAll(xs=>xs.map(x=>{const a=x.getBoundingClientRect(),b=x.closest('button').getBoundingClientRect();return {src:x.src,inside:a.x>=b.x-1&&a.y>=b.y-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1};}));
 assert(bounds.every(x=>x.inside),JSON.stringify(bounds.filter(x=>!x.inside)));
 report.checks.push({theme,icons:14,referenceIconsUnchanged:4,desktop:true,compact:true,bagOpens:true,lanOpens:true,iconsInsideButtons:true});
 await page.setViewportSize({width:1440,height:1000});
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.badAssets,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await service.close();}
console.log(JSON.stringify(report));
