import {readFile} from 'node:fs/promises';
import {createRecruitmentStore} from '../server/recruitmentStore.mjs';
const [directory,file,requestId]=process.argv.slice(2);
const store=createRecruitmentStore({directory}),doc=JSON.parse(await readFile(file,'utf8'));
try{await store.start('pixel',doc,{requestId,projectId:'welcome'});process.send({ok:true})}catch(e){process.send({ok:false,code:e.code,message:e.message})}
setInterval(()=>{},1000);
