import {createRecruitmentStore} from './recruitmentStore.mjs';
// Persist the outcome before releasing a slot. A failed write never launches a second model run.
export function createRecruitmentService({directory,saves,run,cancel,pollMs=400,store=createRecruitmentStore({directory})}){
 const jobs=new Map();
 const jobKey=(theme,id,attempt)=>theme+':'+id+':'+attempt;
 const safeFailure=e=>e?.code==='provider_busy'?'管家正在处理其他委托，请稍后重试':'主子运行未完成；未收取游戏聘金，可重试或取消';
 function launch(theme,contract){
  const key=jobKey(theme,contract.id,contract.attempt);if(jobs.has(key))return;
  const job={key,theme,id:contract.id,attempt:contract.attempt,outcome:null,pumping:false,stopped:false};jobs.set(key,job);
  async function pump(){
   if(job.pumping||job.stopped)return;job.pumping=true;
   try{
    if(job.outcome){
     try{await store.complete(theme,job.id,job.attempt,job.outcome.run,job.outcome.failure)}
     catch(e){
      if(e.code!=='recruitment_evidence')throw e;
      job.outcome={run:null,failure:'主子运行缺少合法执行证据，未收取游戏聘金'};
      await store.complete(theme,job.id,job.attempt,null,job.outcome.failure);
     }
     job.stopped=true;clearInterval(job.timer);jobs.delete(key);
    }else{
     const current=await store.peek(theme,job.id);
     if(current.attempt!==job.attempt||!['planning','available','active'].includes(current.phase))await cancel(key);
    }
   }catch{job.persistencePending=true}
   finally{job.pumping=false}
  }
  job.timer=setInterval(()=>{void pump()},pollMs);job.timer.unref?.();
  job.promise=Promise.resolve().then(()=>run(contract.context,key))
   .then(result=>{job.outcome={run:result,failure:null}},e=>{job.outcome={run:null,failure:safeFailure(e)}})
   .then(()=>pump());
 }
 async function document(theme){const doc=await saves.current(theme);if(!doc)throw Object.assign(Error('请先保存小岛进度'),{status:409,code:'recruitment_save_required'});return doc}
 return {
  async status(theme){
   const doc=await document(theme);let result=await store.list(theme,doc);if(result.renewal?.phase==='available'&&doc.state.recruitment?.active?.id===result.renewal.id){await store.renewal_commit(theme,doc,result.renewal.id);result=await store.list(theme,doc);}const c=result.renewal||result.active;
   if(c&&['planning','cancelling'].includes(c.phase)&&c.ownerPid===process.pid&&!jobs.has(jobKey(theme,c.id,c.attempt))){
    await store.complete(theme,c.id,c.attempt,null,'招聘运行句柄已不存在，请重试；未收取游戏聘金');result=await store.list(theme,doc);
   }
   return result;
  },
  async policy(theme,input){return store.policy(theme,await document(theme),input)},
  async autonomy_observe(theme){return store.autonomy_observe(theme,await document(theme))},
  async autonomy_decide(theme,result){return store.autonomy_decide(theme,await document(theme),result)},
  async renew(theme,input){const result=await store.renew(theme,await document(theme),input);if(!result.replayed)launch(theme,result.contract);return result;},
  async candidate(theme,input){return store.candidate(theme,await document(theme),input)},
  async candidate_manage(theme,input){return store.candidate_manage(theme,await document(theme),input)},
  async recall(theme,{id,requestId,projectId}){const previous=await store.peek(theme,id);const result=await store.start(theme,await document(theme),{requestId,projectId,candidateId:previous.candidateId,source:'user',recallId:id});if(!result.replayed)launch(theme,result.contract);return result;},
  async hire(theme,input){
   if(input.source&&!['user','primary'].includes(input.source))throw Object.assign(Error('自主招聘尚需管家的授权记录'),{status:400,code:'recruitment_source'});
   const result=await store.start(theme,await document(theme),{...input,source:input.source||'user'});
   if(!result.replayed)launch(theme,result.contract);return result;
  },
  async retry(theme,{id}){const result=await store.retry(theme,await document(theme),id);launch(theme,result.contract);return result},
  async cancel(theme,{id}){return store.cancel(theme,await document(theme),id)},
  async activate(theme,{id}){return store.activate(theme,await document(theme),id)},
  async profile(theme,input){return store.profile(theme,await document(theme),input)},
  async departed(theme,{id}){return store.departed(theme,await document(theme),id)},
  async close(){for(const job of jobs.values())await cancel(job.key);await Promise.all([...jobs.values()].map(j=>j.promise));for(const job of jobs.values())clearInterval(job.timer)},
  pending(){return [...jobs.values()].map(j=>({id:j.id,theme:j.theme,attempt:j.attempt,persistencePending:!!j.persistencePending}))}
 };
}
