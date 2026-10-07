import {chromium} from 'playwright-core';import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),out=[];
for(const theme of ['pixel','origami']){
 const p=await b.newPage({viewport:{width:1600,height:1150}});await p.goto('http://127.0.0.1:'+(theme==='pixel'?4173:4174)+'/?qa=1');
 const data=await p.evaluate(async theme=>{
  const {AVATARS}=await import('/src/avatarCatalog.js'),{avatarFrame}=await import('/src/avatars.js'),{artReady,itemFrame}=await import('/src/artStore.js'),{CATALOG_ITEMS}=await import('/src/contentCatalog.js'),{drawAnimatedCharacter}=await import('/src/characters.js'),{followPath}=await import('/src/movement.js');await artReady;
  const poses=AVATARS.flatMap(a=>Array.from({length:8},(_,h)=>({a,h,f:avatarFrame(a.id,theme,h)}))),items=CATALOG_ITEMS.map(i=>itemFrame(i.id,theme));
  await Promise.all([...poses,...items].map(v=>{const im=(v.f||v).img;return im.complete&&im.naturalWidth?Promise.resolve():new Promise((ok,no)=>{im.addEventListener('load',ok,{once:true});im.addEventListener('error',no,{once:true})})}));
  const results=[],screens=[];for(let group=0;group<3;group++){const c=document.createElement('canvas');c.width=1600;c.height=600;const g=c.getContext('2d');g.fillStyle='#f2e4c7';g.fillRect(0,0,1600,600);for(let row=0;row<4;row++)for(let h=0;h<8;h++){const a=AVATARS[group*4+row],theta=Math.PI/2+h*Math.PI/4,x=100+h*195,y=130+row*140,actor={appearance:a.id,x,y,direction:theta,path:[{x:x+Math.cos(theta)*20,y:y+Math.sin(theta)*20}],phase:.8,walking:true,walkMix:1};followPath(actor,.01,140);drawAnimatedCharacter(g,actor,theme,'#a4b088',false,1,1);const f=avatarFrame(a.id,theme,h);results.push({id:a.id,h,ready:f.ready,w:f.frame.w,flip:f.flip});g.fillStyle='#5b4835';g.font='15px sans-serif';g.textAlign='center';g.fillText(a.name+' '+h,x,y+24)}screens.push(c.toDataURL());}
  return {poses:results,items:items.map(i=>({id:i.id,ready:i.img.complete&&i.img.naturalWidth>0,w:i.frame.w,h:i.frame.h})),screens};
 },theme);
 for(const f of data.poses)assert.ok(f.ready&&f.w>8);for(const f of data.items)assert.ok(f.ready&&f.w>8&&f.h>8);
 for(let i=0;i<data.screens.length;i++)await writeFile('qa/v8-'+theme+'-avatar-directions-'+i+'.png',Buffer.from(data.screens[i].split(',')[1],'base64'));
 // Check profile text readability and actual decoded sheet crops in DOM.
 await p.locator('#playerBtn').click();await p.screenshot({path:'qa/v8-profile-final-'+theme+'.png'});
 out.push({theme,poses:data.poses.length,items:data.items.length});await p.close();
}
await b.close();console.log(JSON.stringify(out));

