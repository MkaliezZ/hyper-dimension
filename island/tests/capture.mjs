import { chromium } from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>console.log('pageerror',e.message));await page.goto('http://127.0.0.1:4173/');await page.waitForTimeout(1800);await page.screenshot({path:'island-25-screen.png'});console.log(await page.title());await browser.close();
