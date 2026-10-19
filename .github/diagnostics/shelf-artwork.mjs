// Read-only transport, native PNG and CPU observations around the original
// shelf fixture. No clock, state, image deadline or assertion is changed.
// The optional backdrop candidate changes only the served QA fixture source.
import {createRequire}from'node:module';
import{resolve,join}from'node:path';
import{pathToFileURL}from'node:url';
import{mkdir,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const root=resolve(process.env.HD_DIAGNOSTIC_APP_ROOT||'island'),out=resolve(process.env.HD_QA_OUT||join(root,'qa/v228/native-custom-shops'));
await mkdir(out,{recursive:true});process.env.HD_QA_OUT=out;process.env.HD_QA_WORK_JOURNAL='1';
const{chromium}=createRequire(join(root,'package.json'))('playwright-core'),launch=chromium.launch.bind(chromium);
const candidate=process.env.HD_QA_SHELF_STATIC_BACKDROP==='1';
const observations=[],pending=[];const cpuRate=Number(process.env.HD_DIAGNOSTIC_CPU_RATE||1);
if(![1,2,4].includes(cpuRate))throw Error('Unsupported declared CPU rate');
chromium.launch=async(...args)=>{
 const browser=await launch(...args),create=browser.newContext.bind(browser);
 browser.newContext=async(...args)=>{
  const context=await create(...args),newPage=context.newPage.bind(context),close=context.close.bind(context),row={index:observations.length,cpuRate,candidateStaticBackdrop:candidate,requests:[]};observations.push(row);let session,page;
  const route=context.route.bind(context);
  context.route=(pattern,handler,...options)=>route(pattern,actual=>{
   if(pattern!=='**/src/app.js')return handler(actual);
   return handler(new Proxy(actual,{get(target,key){
    if(key==='fetch')return async(...args)=>{const response=await target.fetch(...args);return new Proxy(response,{get(value,name){
     if(name==='text')return async()=>{
      let source=await value.text();
      const insert=(needle,replacement)=>{if(source.split(needle).length!==2)throw Error('Shelf observation hook changed');source=source.replace(needle,replacement);};
      insert('function render(){','function render(){window.__shelfPaintChecks=(window.__shelfPaintChecks||0)+1;');
      insert('function drawWorld(){','function drawWorld(){window.__shelfWorldDraws=(window.__shelfWorldDraws||0)+1;');
      if(candidate)insert('const personalWaiting=',"if(modal&&scene==='world'&&$('modalRoot').querySelector('.shopfront-modal')&&!render.invalidated)return;const personalWaiting=");
      return source;
     };
     const member=Reflect.get(value,name,value);return typeof member==='function'?member.bind(value):member;
    }});};
    const member=Reflect.get(target,key,target);return typeof member==='function'?member.bind(target):member;
   }}));
  },...options);
  context.newPage=async(...args)=>{
   page=await newPage(...args);session=await context.newCDPSession(page);
   await session.send('Performance.enable');await session.send('Profiler.enable');await session.send('Profiler.start');
   await page.addInitScript(()=>performance.setResourceTimingBufferSize(10000));
   if(cpuRate!==1)await session.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});
   const entries=new Map();
   page.on('request',request=>{if(!/^\/api\/cocreation\/(pixel|origami)\/art\//.test(new URL(request.url()).pathname))return;const item={url:request.url(),startedAt:Date.now()};entries.set(request,item);row.requests.push(item);});
   page.on('response',response=>{const item=entries.get(response.request());if(!item)return;Object.assign(item,{responseAt:Date.now(),status:response.status(),contentType:response.headers()['content-type']});pending.push(response.body().then(bytes=>Object.assign(item,{bodyReadAt:Date.now(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),pngSignature:bytes.subarray(0,8).toString('hex')})).catch(error=>item.bodyError=error.message));});
   page.on('requestfinished',request=>{const item=entries.get(request);if(item)item.finishedAt=Date.now();});
   page.on('requestfailed',request=>{const item=entries.get(request);if(item)Object.assign(item,{failedAt:Date.now(),failure:request.failure()});});
   return page;
  };
  context.close=async()=>{
   try{if(page&&!page.isClosed())row.final=await page.evaluate(async()=>{
    const{artStatus}=await import('/src/artStore.js');
    return{at:performance.now(),paintChecks:window.__shelfPaintChecks,worldDraws:window.__shelfWorldDraws,art:artStatus().loaded.filter(row=>row.file.startsWith('/api/cocreation/')),resources:performance.getEntriesByType('resource').filter(row=>row.name.includes('/art/')).map(row=>({name:row.name,start:row.startTime,requestStart:row.requestStart,responseStart:row.responseStart,responseEnd:row.responseEnd,duration:row.duration,transferSize:row.transferSize,encodedBodySize:row.encodedBodySize})),images:[...document.querySelectorAll('image')].map(image=>image.getAttribute('href')).filter(url=>url?.startsWith('/api/cocreation/'))};
   });}catch(error){row.finalObservationError=error.message;}
   try{row.metrics=(await session.send('Performance.getMetrics')).metrics;const{profile}=await session.send('Profiler.stop');await writeFile(join(out,'artwork-profile-'+row.index+'.cpuprofile'),JSON.stringify(profile));}catch(error){row.profileError=error.message;}
   await writeFile(join(out,'artwork-observations-'+row.index+'.json'),JSON.stringify(row,null,2));return close();
  };return context;
 };return browser;
};
try{process.chdir(root);await import(pathToFileURL(join(root,'tests/v228-custom-shops-browser.mjs')));}
finally{await Promise.all(pending);for(const row of observations)await writeFile(join(out,'artwork-observations-'+row.index+'.json'),JSON.stringify(row,null,2));}
