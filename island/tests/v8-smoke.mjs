import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
for(const port of [4173,4174]){
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port+'/?qa=1&rev=content-v8');
 await page.waitForTimeout(2200);
 await page.locator('#playerBtn').click();
 await page.screenshot({path:'qa/v8-profile-'+port+'.png'});
 console.log(port,'profile',await page.locator('#playerForm').count(),'errors',errors);
 await page.locator('#openWardrobe').click();
 console.log('male options',await page.locator('[data-avatar]').count());
 await page.locator('[data-avatar="male_3"]').click();
 await page.locator('[data-gender="女"]').click();
 console.log('female options',await page.locator('[data-avatar]').count());
 await page.screenshot({path:'qa/v8-wardrobe-'+port+'.png'});
 await page.locator('[data-avatar="female_2"]').click();
 await page.locator('#closeModal').click();
 await page.locator('#bagBtn').click();
 await page.locator('#bagFilter').selectOption('all');
 console.log('items',await page.locator('[data-item]').count());
 await page.screenshot({path:'qa/v8-catalog-'+port+'.png'});
 await page.locator('#closeModal').click();await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption('all');
 console.log('recipes',await page.locator('[data-recipe]').count());
 await page.locator('#closeModal').click();await page.locator('#residentsBtn').click();
 console.log('first resident',await page.locator('[data-npc]').first().getAttribute('data-npc'));
 console.log('final errors',errors);
 await page.close();
}
await browser.close();

