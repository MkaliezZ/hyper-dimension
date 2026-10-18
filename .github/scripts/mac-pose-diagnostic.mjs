import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,sep,basename} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const digestText=text=>createHash('sha256').update(text).digest('hex');
const digest=file=>digestText(readFileSync(file));
async function bounded(promise,milliseconds){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Owned diagnostic observation timed out')),milliseconds))]);}finally{clearTimeout(timer);}}

async function main(){
 assert.equal(process.platform,'darwin','Native macOS diagnostic only');
 const root=process.cwd(),mode=process.env.HD_QA_POSE_MODE;
 assert(['default','pose-atlas'].includes(mode));
 assert.equal(JSON.parse(readFileSync(join(root,'package.json'),'utf8')).name,'hyper-dimension-island');
 const out=resolve(root,process.env.HD_QA_POSE_OUT||'qa/mac-pose-atlas');
 assert(out.startsWith(join(root,'qa')+sep));mkdirSync(out,{recursive:true});
 const test=join(root,'tests/v213-task-chain-browser.mjs'),ocean=join(root,'src/oceanShader.js'),source=readFileSync(ocean,'utf8');
 const candidateNames=['connectedSpriteSurface.js','poseAtlas.js'],candidateRoot=resolve(root,'../.github/diagnostics/pose-atlas'),candidateSources=new Map(candidateNames.map(name=>[name,readFileSync(join(candidateRoot,name),'utf8')]));
 const metadata={diagnosticOnly:true,productAcceptance:false,mode,sourceCommit:process.env.GITHUB_SHA||null,
  originalTestShaBefore:digest(test),originalOceanShaBefore:digest(ocean),browserLaunched:false,
  launchOptionsChanged:false,candidateHashes:Object.fromEntries([...candidateSources].map(([name,text])=>[name,digestText(text)])),routedModules:[],documentObservations:[]};
 const save=()=>writeFileSync(join(out,'pose-mode.json'),JSON.stringify(metadata,null,2)+'\n');
 if(process.argv[2]==='verify'){
  const observed=JSON.parse(readFileSync(join(out,'pose-mode.json'),'utf8'));
  assert.equal(observed.mode,mode);assert.equal(observed.originalTestShaBefore,observed.originalTestShaAfter);
  assert.equal(observed.originalOceanShaBefore,observed.originalOceanShaAfter);
  assert.equal(observed.launchOptionsChanged,false);assert.equal(observed.softwareRendererDetected,false);
  assert.match(observed.gpu.featureStatus['2d_canvas'],/^enabled/);
  assert.equal(observed.gpu.attributes.displayType,'ANGLE_METAL');
  if(mode==='pose-atlas')for(const name of candidateNames)assert(observed.routedModules.some(r=>r.name===name),'The actual candidate pose module must load: '+name);
  console.log(JSON.stringify({diagnosticOnly:true,mode,nativeGpuPreserved:true,originalTestAndSourceUnchanged:true}));return;
 }
 save();process.once('exit',code=>{metadata.exitCode=code;metadata.originalTestShaAfter=digest(test);metadata.originalOceanShaAfter=digest(ocean);save();});
 const require=createRequire(pathToFileURL(join(root,'package.json'))),{chromium}=require('playwright-core'),launch=chromium.launch;
 chromium.launch=async function(options){
  const browser=await launch.call(this,options);metadata.browserLaunched=true;metadata.browserVersion=browser.version();metadata.executable=basename(options.executablePath);save();
  let session;
  try{
   session=await browser.newBrowserCDPSession();const info=await bounded(session.send('SystemInfo.getInfo'),10000),gpu=info.gpu||{},aux=gpu.auxAttributes||{};
   metadata.gpu={devices:(gpu.devices||[]).map(d=>Object.fromEntries(['vendorId','deviceId','vendorString','deviceString','driverVendor','driverVersion'].filter(k=>k in d).map(k=>[k,d[k]]))),featureStatus:gpu.featureStatus||{},attributes:Object.fromEntries(['glRenderer','glVendor','glVersion','displayType'].filter(k=>k in aux).map(k=>[k,aux[k]]))};
   metadata.softwareRendererDetected=/swiftshader|llvmpipe|software rasterizer/i.test(JSON.stringify(metadata.gpu));save();
   assert.equal(metadata.softwareRendererDetected,false,'Software rendering is not a native comparison');
   assert.match(metadata.gpu.featureStatus['2d_canvas']||'',/^enabled/);assert.equal(metadata.gpu.attributes.displayType,'ANGLE_METAL');
  }catch(error){await browser.close();throw error;}
  finally{await session?.detach().catch(()=>{});}
  const createContext=browser.newContext;
  browser.newContext=async function(...args){
   const context=await createContext.apply(this,args);
   if(mode==='pose-atlas')for(const[name,body]of candidateSources)await context.route('**/src/'+name,async route=>{
    metadata.routedModules.push({name,sha256:digestText(body)});save();await route.fulfill({contentType:'text/javascript',body});
   });
   const close=context.close;
   context.close=async function(...closeArgs){
    for(const page of context.pages())try{
     const observation=await bounded(page.evaluate(async()=>{const s=window.islandInspect?.();return s?{theme:s.theme,startup:s.startup.busy,ocean:s.environment.art.backend,canvas:s.rendering.css,backing:s.rendering.backing,frameLoop:s.frameLoop,pose:(await import('/src/connectedSpriteSurface.js')).connectedSurfaceStatus()}:null;}),2000);
     if(observation)metadata.documentObservations.push(observation);
    }catch(error){metadata.documentObservations.push({observationError:error.message});}
    save();return close.apply(this,closeArgs);
   };
   return context;
  };
  return browser;
 };
 try{await import(pathToFileURL(test));}
 finally{chromium.launch=launch;metadata.originalTestShaAfter=digest(test);metadata.originalOceanShaAfter=digest(ocean);save();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
