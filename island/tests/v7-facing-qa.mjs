import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-sandbox']});
const report={cases:[],screens:[],errors:[]};
try{for(const theme of ['pixel','origami']){
 const p=await b.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(`http://127.0.0.1:${theme==='pixel'?4173:4174}/?qa=1&rev=facing-v7`);
 await p.waitForFunction(async()=>{const {characterFrame}=await import('/src/characters.js');return ['pixel','origami'].every(t=>Array.from({length:24},(_,i)=>Array.from({length:8},(_,h)=>characterFrame(i%16,t,i>=16,h))).flat().every(f=>f.frame&&f.img.complete&&f.img.naturalWidth))},null,{timeout:30000});
 for(const visitor of [false,true])for(let group=0;group<(visitor?2:4);group++){
  const r=await p.evaluate(async({theme,visitor,group})=>{
   const {drawAnimatedCharacter,characterFrame}=await import('/src/characters.js');const {followPath}=await import('/src/movement.js');const {directionIndex}=await import('/src/directions.js');const {RESIDENTS}=await import('/src/world.js');
   const c=document.createElement('canvas');c.width=1440;c.height=680;const g=c.getContext('2d');g.fillStyle='#ede2ca';g.fillRect(0,0,c.width,c.height);const cases=[];
   for(let row=0;row<4;row++)for(let h=0;h<8;h++){
    const id=group*4+row,angle=Math.PI/2+h*Math.PI/4,x=90+h*178,y=140+row*165;
    const a={npcId:id,isVisitor:visitor,x,y,path:[{x:x+Math.cos(angle)*25,y:y+Math.sin(angle)*25}],phase:1,walking:true,direction:angle};
    let before={x:a.x,y:a.y};for(let tick=0;tick<22;tick++){
     before={x:a.x,y:a.y};followPath(a,1/60,60);drawAnimatedCharacter(g,a,theme,'#aaa',true,tick/60,1);
     const dx=a.x-before.x,dy=a.y-before.y;if(Math.hypot(dx,dy)>.001&&directionIndex(Math.atan2(dy,dx))!==a.facing8)throw Error(`movement/facing mismatch ${theme} ${id} ${h}`);
    }
    // Clear the cell and render one actual walking pose, preserving heading and gait.
    g.fillStyle='#ede2ca';g.fillRect(h*178,row*165,178,165);drawAnimatedCharacter(g,a,theme,'#aaa',true,1,1.3);
    const f=characterFrame(id,theme,visitor,h);if(f.frame.w/f.frame.h<.25)throw Error('compressed crop');
    cases.push({theme,visitor,id,heading:h,actual:a.facing8,asset:f.img.src.split('/').at(-1),cell:f.cell,ratio:f.frame.w/f.frame.h});
    g.fillStyle='#493e38';g.font='14px sans-serif';g.fillText((visitor?'游客'+(id+1):RESIDENTS[id].name)+' '+['↓','↙','←','↖','↑','↗','→','↘'][h],40+h*178,160+row*165);
   }
   // Reverse direction in one frame: no stale opposite pose is permitted.
   const turnCanvas=document.createElement('canvas'),turnCtx=turnCanvas.getContext('2d');const a={npcId:13,x:100,y:100,phase:2,path:[],direction:0};drawAnimatedCharacter(turnCtx,a,theme,'#aaa',true,2,1);a.path=[{x:99.5,y:100}];followPath(a,1/60,60);drawAnimatedCharacter(turnCtx,a,theme,'#aaa',true,2.016,1);
   if(a.facing8!==2||a.previousHeading!=null||a.direction!==Math.PI)throw Error('short-step / reverse-turn regression');
   return {cases,png:c.toDataURL('image/png')};
  },{theme,visitor,group});
  const file=`v7-${theme}-${visitor?'visitors':'residents'}-${group}-facing-screen.png`;await writeFile(file,Buffer.from(r.png.split(',')[1],'base64'));report.cases.push(...r.cases);report.screens.push(file);
 }
 // Actual town simulation: compare displacement with heading after each RAF.
 const live=process.argv.includes('--art-only')?{count:{},mismatches:[],skipped:true}:await p.evaluate(async()=>{const {directionIndex}=await import('/src/directions.js');const count={},mismatches=[];let previous=window.islandInspect();const start=performance.now();while(performance.now()-start<20000){await new Promise(requestAnimationFrame);const current=window.islandInspect();for(const n of current.npcs){const old=previous.npcs[n.id];if(n.inside!==old.inside)continue;const a=n.inside!=null?n.indoor:n,b=n.inside!=null?old.indoor:old;if(!a||!b||!a.walking)continue;const dx=a.x-b.x,dy=a.y-b.y;if(Math.hypot(dx,dy)>.01){count[n.id]=(count[n.id]||0)+1;const moved=directionIndex(Math.atan2(dy,dx));if(moved!==directionIndex(a.direction)||(n.inside==null&&a.facing!=null&&moved!==a.facing))mismatches.push({id:n.id,inside:n.inside,dx,dy,facing:a.facing,direction:a.direction})}}previous=current}return {count,mismatches}});
 if(!live.skipped)assert.ok(Object.keys(live.count).length>0,'no actual moving NPCs sampled');
 assert.equal(live.mismatches.length,0,JSON.stringify(live.mismatches.slice(0,4)));report[theme+'Live']=live;await p.close();
 }
 assert.equal(report.cases.length,384);assert.equal(report.errors.length,0);await writeFile(process.argv.includes('--art-only')?'v7-facing-art-qa.json':'v7-facing-qa.json',JSON.stringify(report,null,2));console.log(JSON.stringify({result:'PASS',cases:report.cases.length,screens:report.screens.length,live:[report.pixelLive,report.origamiLive],errors:report.errors}));
}finally{await b.close()}
