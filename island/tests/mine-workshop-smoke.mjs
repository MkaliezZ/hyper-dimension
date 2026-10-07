import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function clickWorldCoord(wx,wy){const rect=await page.locator('#game').boundingBox();const scale=Math.max(rect.width/1000,rect.height/660);await page.mouse.click(rect.x+rect.width/2+(wx-500)*scale,rect.y+rect.height/2+(wy-330)*scale)}
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('hyper-dimension-pixel-v3')));
await page.goto('http://127.0.0.1:4173/?scene=mine');
for(let hit=0;hit<3;hit++){await clickWorldCoord(320,315);await page.locator('#mineStrike').waitFor({timeout:10000});await page.keyboard.press('Space');await page.waitForFunction(n=>JSON.parse(localStorage.getItem('hyper-dimension-pixel-v3'))?.inventory?.stone>=n,hit+9,{timeout:6000});await page.locator('#mineStrike').waitFor({state:'detached',timeout:6000})}
let s=await saved();assert.equal(s.tasks.mine,true);assert.ok(s.inventory.ore>=2);
await page.goto('http://127.0.0.1:4173/?scene=workshop&qa=1');await clickWorldCoord(500,385);await page.locator('.room-game').waitFor({timeout:35000});for(let i=0;i<3;i++){await page.waitForFunction(()=>{const g=window.islandInspect().roomGame,v=(Math.sin(g.t*2.8-Math.PI/2)+1)/2;return v>.40&&v<.46&&Math.cos(g.t*2.8-Math.PI/2)>0});await page.keyboard.press('Space');await page.waitForTimeout(240)}await page.locator('#gameFinish').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('hyper-dimension-pixel-v3'))?.inventory?.lantern>=1,{},{timeout:6000});
s=await saved();assert.equal(s.tasks.craft,true);assert.equal(errors.length,0,errors.join('\n'));
console.log(JSON.stringify({result:'PASS',mine:{stone:s.inventory.stone,ore:s.inventory.ore},craft:{lantern:s.inventory.lantern},pageErrors:errors}));await browser.close();

