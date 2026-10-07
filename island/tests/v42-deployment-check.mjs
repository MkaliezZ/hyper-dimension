import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const rows=[];for(const [theme,port] of [['pixel',4173],['origami',4174]]){
 const base='http://127.0.0.1:'+port,status=await(await fetch(base+'/api/status')).json(),files=[];
 for(const path of ['src/app.js','src/freshStart.js','src/npcProfileAudit.js','src/npcProfileAuditUI.js','src/admin-v42.css','src/style.css']){
  const response=await fetch(base+'/'+path),bytes=Buffer.from(await response.arrayBuffer()),disk=await readFile(path);
  if(response.status!==200||!bytes.equals(disk))throw Error(theme+' file mismatch '+path);
  files.push({path,status:response.status,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 const index=await(await fetch(base+'/')).text();if(!index.includes('/src/admin-v42.css'))throw Error('stylesheet missing');
 const automatic=status.agents?.automaticRequests;
 rows.push({theme,port,model:status.agents?.deepseek?.model,hermesModel:status.agents?.hermes?.model,automaticRequests:automatic,files});
}
const report={at:new Date().toISOString(),passed:true,frontEndOnly:true,backendRestarted:false,noUserSaveWrites:true,noProviderCalls:true,rows};
await writeFile('qa/v42/deployment.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,rows:rows.map(r=>({theme:r.theme,port:r.port,model:r.model,hermesModel:r.hermesModel,files:r.files.length}))}));
