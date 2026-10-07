import {createHash,randomUUID} from 'node:crypto';
import {validatePartyProposal,partyPlanningContext,partyDraftStamp} from '../src/partyPlanning.js';
const fail=(message,status=400)=>Object.assign(Error(message),{status,code:'party_proposal_invalid'});
export function createPartyPlanningService({saves,suggest,now=()=>Date.now()}){
 const requests=new Map();
 async function propose(theme,data){
  if(!data||!/^[\w-]{1,80}$/.test(data.requestId||''))throw fail('缺少本次主题规划标识');
  const doc=await saves.current(theme);if(!doc)throw fail('先保存当前小岛再设计活动',409);
  if(doc.state.saveSlot!==data.worldKey)throw fail('小岛已经更换，请打开当前手账',409);
  const template=data.input?.template||'fishing',draftOf=doc=>template==='fireworks'?doc?.state.fireworksParty?.draft:template==='couture'?doc?.state.coutureParty?.draft:template==='market'?doc?.state.festivalParty?.draft:template==='night'?doc?.state.nightParty?.draft:doc?.state.fishingParty?.draft,sessionOf=doc=>template==='fireworks'?doc?.state.fireworksParty?.session:template==='couture'?doc?.state.coutureParty?.session:template==='market'?doc?.state.festivalParty?.session:template==='night'?doc?.state.partySession:doc?.state.fishingParty?.session;
  const d=draftOf(doc);
  if((d?.id||null)!==data.expectedId||(d?.version||null)!==data.expectedVersion||(data.expectedStamp??null)!==partyDraftStamp(d))throw fail('活动已经变化，请重新打开当前方案',409);
  if(sessionOf(doc))throw fail('先完成当前比赛再设计下一场相聚',409);
  const checked=validatePartyProposal(doc.state,{...data.input,guestId:null,guestReason:''});if(!checked.ok)throw fail(checked.reason);
  const key=theme+':'+doc.state.saveSlot+':'+data.requestId,signature=createHash('sha256').update(JSON.stringify([data.expectedId,data.expectedVersion,data.expectedStamp??null,checked.proposal])).digest('hex');
  const old=requests.get(key);if(old){if(old.signature!==signature)throw fail('同一规划标识不能用于不同主题',409);return old.promise;}
  for(const [k,r] of requests)if(r.settled&&now()-r.at>300000)requests.delete(k);
  if(requests.size>=50)throw fail('主题规划正在处理，请稍后再试',429);
  const record={signature,at:now(),settled:false};
  record.promise=(async()=>{
   try{
    const suggestion=await suggest({theme,input:checked.proposal,world:partyPlanningContext(doc.state,template)});
    const current=await saves.current(theme),draft=draftOf(current);
    if(current?.state.saveSlot!==data.worldKey||(draft?.id||null)!==data.expectedId||(draft?.version||null)!==data.expectedVersion||(data.expectedStamp??null)!==partyDraftStamp(draft)||sessionOf(current))throw fail('建议返回时活动已改变，请重新设计',409);
    const result=validatePartyProposal(current.state,{...checked.proposal,guestId:suggestion.guestId,guestReason:suggestion.reason});if(!result.ok)throw fail('模型建议未通过可行性检查：'+result.reason,503);
    if(typeof suggestion.reason!=='string'||!suggestion.reason.trim())throw fail('模型没有说明嘉宾与主题的关系，请重试或采用基础方案',503);
    return {...result.proposal,source:'deepseek',model:'deepseek-flash',proposalId:randomUUID(),worldRevision:current.revision,expectedId:data.expectedId,expectedVersion:data.expectedVersion,scopeNote:template==='fireworks'?'主题嘉宾观看三幕烟花；固定协作岗位、六枚有限烟花与真实输入评分结算，未发射者归还。':template==='couture'?'主题嘉宾观看三轮真实居民穿搭展示；六位固定评审/模特必须同意，服装留用，按实际输入评审与结算。':template==='market'?'主题嘉宾参加真实居民集市；三波12位顾客，有限商品、逐单交付与实际库存结算。':template==='night'?'主题嘉宾参加广场夜集；保持四盏星灯与公开投入奖励。':'主题嘉宾观赛与陪伴；比赛仍为三人六竿钓鱼，不额外生成小游戏。'};
   }finally{record.settled=true;record.at=now();}
  })();requests.set(key,record);return record.promise;
 }
 return {propose};
}
