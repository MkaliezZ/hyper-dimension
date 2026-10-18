import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,sep,basename} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

// Official switch: gpu/config/gpu_finch_features.cc, IsSkiaGraphiteEnabled.
// https://chromium.googlesource.com/chromium/src/+/refs/heads/main/gpu/config/gpu_finch_features.cc
export function diagnosticLaunchSettings(options,mode){
 assert(['default','graphite-disabled'].includes(mode),'Unknown native-browser comparison mode');
 return mode==='default'?{...options}:{...options,args:[...(options.args||[]),'--disable-skia-graphite']};
}
const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');

async function main(){
 assert.equal(process.platform,'darwin','This diagnostic must execute on macOS');
 const root=process.cwd(),mode=process.env.HD_QA_NATIVE_MODE;
 assert.equal(JSON.parse(readFileSync(join(root,'package.json'),'utf8')).name,'hyper-dimension-island');
 diagnosticLaunchSettings({},mode);
 const out=resolve(root,process.env.HD_QA_NATIVE_MODE_OUT||'qa/mac-native-mode');
 assert(out.startsWith(join(root,'qa')+sep),'Diagnostic output must stay in this checkout qa directory');
 const metadataFile=join(out,'native-mode.json'),testFile=join(root,'tests/v213-task-chain-browser.mjs');
 if(process.argv[2]==='verify'){
  const metadata=JSON.parse(readFileSync(metadataFile,'utf8'));
  assert.equal(metadata.mode,mode);assert.equal(metadata.originalTestShaBefore,metadata.originalTestShaAfter);
  assert.deepEqual(metadata.changedLaunchFields,mode==='default'?[]:['args']);
  assert.equal(metadata.browserLaunched,true);assert.equal(metadata.softwareRendererDetected,false);
  console.log(JSON.stringify({diagnosticOnly:true,originalTestUnchanged:true,mode,softwareRendererDetected:false}));return;
 }
 const metadata={diagnosticOnly:true,productAcceptance:false,mode,platform:process.platform,arch:process.arch,
  sourceCommit:process.env.GITHUB_SHA||null,originalTestShaBefore:digest(testFile),browserLaunched:false};
 mkdirSync(out,{recursive:true});
 const save=()=>writeFileSync(metadataFile,JSON.stringify(metadata,null,2)+'\n');save();
 process.once('exit',code=>{metadata.exitCode=code;metadata.originalTestShaAfter=digest(testFile);save();});
 const require=createRequire(pathToFileURL(join(root,'package.json'))),{chromium}=require('playwright-core');
 const original=chromium.launch;
 chromium.launch=async function(options){
  const settings=diagnosticLaunchSettings(options,mode);
  metadata.changedLaunchFields=[...new Set([...Object.keys(options),...Object.keys(settings)])].filter(k=>options[k]!==settings[k]);
  assert.deepEqual(metadata.changedLaunchFields,mode==='default'?[]:['args']);
  const browser=await original.call(this,settings);metadata.browserLaunched=true;metadata.browserVersion=browser.version();metadata.executable=basename(settings.executablePath);save();
  let session,timer;
  try{
   session=await browser.newBrowserCDPSession();
   const info=await Promise.race([session.send('SystemInfo.getInfo'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned GPU metadata did not respond within10seconds')),10000);})]),gpu=info.gpu||{},aux=gpu.auxAttributes||{};
   metadata.gpu={devices:(gpu.devices||[]).map(d=>Object.fromEntries(['vendorId','deviceId','vendorString','deviceString','driverVendor','driverVersion'].filter(k=>k in d).map(k=>[k,d[k]]))),
    featureStatus:gpu.featureStatus||{},attributes:Object.fromEntries(['glRenderer','glVendor','glVersion','displayType'].filter(k=>k in aux).map(k=>[k,aux[k]]))};
   metadata.softwareRendererDetected=/swiftshader|llvmpipe|software rasterizer/i.test(JSON.stringify(metadata.gpu));save();
   assert.equal(metadata.softwareRendererDetected,false,'Software rendering cannot stand in for a native GPU comparison');
   assert.match(metadata.gpu.featureStatus['2d_canvas']||'',/^enabled/,'Native accelerated Canvas2D is required');
   assert.match(metadata.gpu.featureStatus.skia_graphite||'',mode==='default'?/^enabled/:/^disabled/,'The requested native Skia backend must actually be selected');
  }catch(error){await browser.close();throw error;}
  finally{clearTimeout(timer);await session?.detach().catch(()=>{});}
  return browser;
 };
 try{await import(pathToFileURL(testFile));}
 finally{chromium.launch=original;metadata.originalTestShaAfter=digest(testFile);save();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
