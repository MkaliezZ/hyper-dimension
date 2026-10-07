import {writeFile} from 'node:fs/promises';
const r=await fetch('http://127.0.0.1:4174/api/hermes/command',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(95000),body:JSON.stringify({day:1,inventory:{wood:4,ore:2},built:[{id:0,name:'木作工坊',kind:'workshop',quality:45}],residents:[],recipes:['recipe_lantern'],events:[],executions:[],tasks:{},economy:{arrivals:0,rating:3.4},journey:{step:'做出第一盏星灯',guidance:'亲手制作灯笼',earned:[]},history:[{role:'user',content:'我把第一盏灯命名为「青柠晚风」，请记住它。'},{role:'assistant',content:'好的，这盏灯叫青柠晚风。'}],message:'我刚才给那盏灯起的名字是什么？只回答名字，无需安排任务。'})});
const d=await r.json(),result={http:r.status,source:d.source,model:d.model,answer:d.answer,commands:d.commands?.length||0,historyVerified:d.source==='hermes'&&d.answer.includes('青柠晚风'),errorCode:d.errorCode};
await writeFile('qa/v21/hermes-live-context.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

