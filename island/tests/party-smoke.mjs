import {chromium} from 'playwright-core';
import {createState} from '../src/world.js';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4173/');
const state=createState();state.inventory.wheat=2;state.inventory.lantern=1;
await page.evaluate(data=>localStorage.setItem('hyper-dimension-pixel-v3',JSON.stringify(data)),state);
await page.reload();
await page.locator('#residentsBtn').click();
for(const i of [0,2]){
 await page.locator('[data-npc="'+i+'"]').click();
 await page.locator('#inviteNpc').click();
}
await page.locator('#partyBtn').click();
if(await page.locator('#hostParty').isDisabled())throw Error('party locked after invitations and materials');
await page.locator('#hostParty').click();
for(let i=0;i<4;i++)await page.locator('#launchLantern').click();
await page.waitForTimeout(2700);
const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('hyper-dimension-pixel-v3')));
if(result.activities!==1||result.inventory.lantern!==0||result.inventory.wheat!==0||Object.keys(result.partyInvites).length!==0)throw Error('party settlement mismatch '+JSON.stringify(result));
if(errors.length)throw Error(errors.join('; '));
console.log(JSON.stringify({result:'PASS',activities:result.activities,coins:result.coins,invites:Object.keys(result.partyInvites).length,pageErrors:errors}));
await browser.close();