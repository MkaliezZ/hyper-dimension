import {eventRequests,eventCost,validatePartyProposal} from './partyPlanning.js';
import {FISHING_EQUIPMENT} from './fishingParty.js';
import {MARKET_EQUIPMENT} from './marketRules.js';
import {COUTURE_EQUIPMENT} from './coutureRules.js';
import {FIREWORKS_EQUIPMENT} from './fireworksRules.js';
import {availableQuantity} from './resourceLedger.js';
import {relationshipInvitation} from './residentStories.js';
import {ITEM_BY_ID,RECIPE_BY_ID,recipeGate} from './contentCatalog.js';
import {RESIDENTS} from './world.js';

// Read-only guidance. Opening a guide never creates an invitation, reservation or reward.
export const PARTY_GUIDES=Object.freeze([
 {template:'night',field:'nightParty',name:'星灯夜集',item:'lantern',venue:'广场',openId:'nightPartyOpen',equipment:{},description:'四盏星灯，和伙伴一起放飞心愿。'},
 {template:'fishing',field:'fishingParty',name:'海风钓鱼大会',item:'rod',venue:'海边钓位',openId:'fishingPartyOpen',equipment:FISHING_EQUIPMENT,description:'看潮汐、把握六次提竿，分享茶点。'},
 {template:'market',field:'festivalParty',name:'海岛手作集市',item:'pottery',venue:'广场',openId:'marketPartyOpen',equipment:MARKET_EQUIPMENT,description:'陈列真实商品，为十二位居民装篮交付。'},
 {template:'couture',field:'coutureParty',name:'海岛穿搭大会',item:Object.keys(COUTURE_EQUIPMENT)[0],venue:'广场秀台',openId:'couturePartyOpen',equipment:COUTURE_EQUIPMENT,description:'三轮造型、四拍展示，让居民穿出个性。'},
 {template:'fireworks',field:'fireworksParty',name:'星海烟花大会',item:'firework',venue:'广场',openId:'fireworksPartyOpen',equipment:FIREWORKS_EQUIPMENT,description:'读懂海风，亲手编排三幕六枚烟花。'}
]);
const name=(s,id)=>s.npcProfiles?.[id]?.name||RESIDENTS[id]?.name||'岛民';
const activeSession=(s,c)=>c.template==='night'?s.partySession:s[c.field]?.session;
export function activePartyTemplate(s){
 return PARTY_GUIDES.find(c=>{const g=activeSession(s,c);return g&&(c.template==='night'||['checkin','running'].includes(g.phase));})?.template||null;
}
export function partyGuide(s,template){
 const c=PARTY_GUIDES.find(c=>c.template===template);if(!c)return null;
 const book=s[c.field],d=book?.draft,g=activeSession(s,c),active=activePartyTemplate(s);
 const base={...c,name:d?.name||g?.name||c.name,id:d?.id||g?.id||null,version:d?.version||g?.version||null,project:null,people:[],materials:[],missing:[],ready:false};
 if(g){
  const live=c.template==='night'||['checkin','running'].includes(g.phase),phase=g.game?.phase||g.phase;
  return {...base,phase:live?'active':'results',label:live?(phase==='checkin'?'正在赴约':phase==='results'?'等待领奖':'活动进行中'):'本场结果',message:live?(phase==='checkin'?'伙伴正在收尾工作，沿道路前往各自席位。':phase==='results'?'本场演出已结束，请打开现场核对并领取一次奖励。':'收起页面仍保留当前活动，回到现场继续。'):'查看成绩和纪念品，收起本场后再筹备下一场。',next:{kind:'book',label:live?'回到活动现场':'查看本场结果'},steps:[true,true,true,live&&phase!=='checkin',!live]};
 }
 const proposal=d||{template,name:c.name,description:'',tags:[template==='fishing'?'sea':template==='market'||template==='couture'?'craft':'stars'],difficulty:'normal',guestId:null,...(template==='night'?{fireworks:false}:{})};
 const gate=validatePartyProposal(s,proposal),cost={...eventCost(proposal),...c.equipment};
 const lockedItem=[...new Set([...Object.keys(cost),...eventRequests(proposal).map(r=>r.item)])].find(id=>{const recipe=RECIPE_BY_ID[ITEM_BY_ID[id]?.recipeId];return recipe&&!recipeGate(recipe,s).ready;});
 if(!d)return {...base,phase:gate.ok?'create':'locked',label:gate.ok?'可发起':'先解锁用品',message:gate.ok?'先写下主题，再备齐实际用品，逐位对话邀请。':gate.reason,next:{kind:gate.ok?'book':'item',item:lockedItem||c.item,label:gate.ok?'设计这场相聚':'查看用品解锁'},steps:[false,false,false,false,false]};
 const project=s.workProjects?.find(p=>p.id===d.projectId),planWaiting=!!project&&['preparing','paused'].includes(project.status),owner=project&&['preparing','paused','ready'].includes(project.status)?'project:'+project.id:null;
 const people=eventRequests(d).map(r=>{
  const gift=(d.inviteGifts?.[r.id]?.delivered?.[r.item]??d.invites?.[r.id]?.delivered?.[r.item]??0)>=r.quantity;
  const confirmed=d.invites?.[r.id]?.version===d.version;
  const willing=relationshipInvitation(s,r.id,eventRequests(d).map(p=>p.id));
  if(!gift)cost[r.item]=(cost[r.item]||0)+r.quantity;
  return {...r,name:name(s,r.id),gift,confirmed,willing:willing.ready,storyId:willing.storyId||null,reason:willing.reason||'',giftAvailable:gift||availableQuantity(s,r.item,owner)>=r.quantity,canInvite:!confirmed&&willing.ready&&(gift||!planWaiting&&availableQuantity(s,r.item,owner)>=r.quantity)};
 });
 const materials=Object.entries(cost).map(([item,quantity])=>({item,quantity,available:availableQuantity(s,item,owner),missing:Math.max(0,quantity-availableQuantity(s,item,owner))})),missing=materials.filter(r=>r.missing);
 const waiting=people.filter(p=>!p.confirmed),blocked=people.find(p=>!p.willing),due=waiting.find(p=>p.canInvite),used=s.lastPartyDay===s.day;
 Object.assign(base,{project:project?{id:project.id,title:project.title,status:project.status}:null,people,materials,missing,steps:[true,!missing.length&&!planWaiting,!waiting.length&&!blocked,false,false]});
 if(active)return {...base,phase:'waiting',label:'另一场正在举办',message:'本场筹备保留；先完成正在举办的活动，再召集下一场。',next:{kind:'active',template:active,label:'回到正在举办的活动'}};
 if(!gate.ok)return {...base,phase:'locked',label:'用品条件未齐',message:gate.reason,next:{kind:'item',item:lockedItem||c.item,label:'查看用品解锁'}};
 if(blocked)return {...base,phase:'relationship',label:'居民有顾虑',message:blocked.reason,next:{kind:'story',npcId:blocked.id,label:'听听'+blocked.name+'的顾虑'}};
 if(due)return {...base,phase:'inviting',label:'待亲自邀请',message:due.name+(due.gift?'已经收到赠物，请确认这版参加。':'的赠物已可用，可以亲自对话邀请。'),next:{kind:'invite',npcId:due.id,label:'与'+due.name+'对话邀请'}};
 if(planWaiting)return {...base,phase:'preparing',label:project.status==='paused'?'筹备已暂停':'伙伴正在筹备',message:project.status==='paused'?'打开任务板恢复筹备，未用物资仍由原计划留用。':'按真实配方与前置任务收集制作，整份清单备齐后再交付邀请。',next:{kind:'project',label:project.status==='paused'?'查看并继续筹备':'查看伙伴分工'}};
 if(missing.length)return {...base,phase:'preparing',label:'还需备齐用品',message:'本场仍缺'+missing.length+'类投入；已留给其他工作或穿着中的物品不可重复使用。',next:{kind:missing[0].item==='coins'?'book':'item',item:missing[0].item,label:missing[0].item==='coins'?'查看本场投入':'查看'+(ITEM_BY_ID[missing[0].item]?.name||'用品')+'来源'}};
 if(waiting.length)return {...base,phase:'inviting',label:'待确认本版',message:'赠物和当前版本同意需要分别确认。',next:{kind:'invite',npcId:waiting[0].id,label:'确认'+waiting[0].name+'的邀请'}};
 if(used)return {...base,phase:'tomorrow',label:'准备下次相聚',message:'今天的承办机会已使用。用品与同意保留，下一游戏日再开场。',next:{kind:'book',label:'查看已备齐的方案'}};
 return {...base,phase:'ready',label:'可以召集开场',ready:true,message:'物资、本版同意与居民关系已齐。到'+c.venue+'开场，等伙伴沿道路到齐。',next:{kind:'book',label:'进入手账 · 召集开场'}};
}
export function partyGuideSummary(s){
 const cards=PARTY_GUIDES.map(c=>partyGuide(s,c.template)),active=activePartyTemplate(s),due=cards.filter(c=>['inviting','ready','relationship'].includes(c.phase));
 return {day:s.day,used:s.lastPartyDay===s.day,active,cards,due:due.length};
}
