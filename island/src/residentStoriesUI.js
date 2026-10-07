import {cooperationPlanFor,cooperationNeedState} from './residentCooperation.js';
import {residentStoryView,mediateResidentStory} from './residentStories.js';
import {esc} from './journeyUI.js';
import {BUILDINGS} from './world.js';
import {ITEM_BY_ID} from './contentCatalog.js';
const labels={conflict:'分歧与修复',cooperation:'共同备料',outing:'工作之外',friendship:'邻里约定'};
export function createResidentStoriesUI({state,profile,portrait,itemArt,openModal,persist,back}){
 const $=id=>document.getElementById(id);
 function open(npcId,feedback=''){
  const s=state(),rows=residentStoryView(s,npcId),n=profile(npcId),current=rows.filter(e=>e.active),past=rows.filter(e=>!e.active);
  const card=e=>{
   const p=profile(e.partnerId),need=e.stage==='work'?cooperationNeedState(s,e):null,places={forest:'林地',mine:'矿洞',farm:'农田',dock:'海边'};
   const delivery=e.stage==='work'?'<section class="story-deliveries"><b>'+esc(e.demand?'为「'+e.demand.name+'」分工准备':'各自的备料分工')+' · '+e.progress+' / 2 人交付</b>'+e.people.map(id=>{
    const plan=cooperationPlanFor(e,id),done=e.contributions[id],site=e.workSites?.[id],plot=s.plots?.[site?.farmIndex],where=site?'农田 · 第 '+(site.farmIndex+1)+' 块':plan.buildingId===null?places[plan.goal]:BUILDINGS[plan.buildingId].name;
    const status=done?'已实际入库 '+done.amount+' 份':e.active&&need.active&&need.needed.has(plan.resource)?e.inFlight[id]?'正在作业，等待实际入库':plot?.stage===3?'作物生长中，成熟后继续收获':'按分工准备中':e.demand?'该分工已不再需要':'未完成，已保留现有进展';
    return '<div class="story-delivery" data-story-worker="'+id+'">'+itemArt(plan.resource)+'<div><b>'+esc(profile(id).name)+' · '+esc(ITEM_BY_ID[plan.resource].name)+'</b><span>'+esc(where)+' · '+(plan.recipeId?'耗料制作':plan.goal==='farm'?'耕种至成熟收获':'实地采集')+'</span><span>'+esc(status)+'</span></div></div>';
   }).join('')+'</section>':'';
   const stage=e.status==='resolved'?'共同经历已完成':e.status==='closed'?'已结束，保留实际进展':s.day<e.dueDay?'第 '+e.dueDay+' 天再相聚':e.status==='meeting'?'正在赴约交谈':e.stage==='work'?'分别备料，完成后核对':'今天在'+BUILDINGS[e.venue].name+'见面';
   const choices=e.canMediate?'<div class="story-dialogue"><blockquote>“我们还有没说清的顾虑。先听完，再决定怎样一起做事。”</blockquote><p>分别找两位居民聊聊，听取各自的顾虑，可以让他们愿意一起参加活动；约好的后续见面仍会继续。</p><div><button class="primary" data-story="'+e.id+'" data-version="'+e.version+'" data-choice="listen">我愿意听完，再说清分工</button><button class="secondary" data-story="'+e.id+'" data-version="'+e.version+'" data-choice="space">先给彼此一点空间</button></div></div>':e.mediation[npcId]?'<blockquote class="story-response">“'+esc(e.mediation[npcId].text)+'”</blockquote>':'';
   return '<article class="resident-story-card '+esc(e.kind)+'" data-story-id="'+esc(e.id)+'"><header><small>'+labels[e.kind]+'</small><span>'+esc(stage)+'</span></header><div class="story-people"><div class="story-partner-art">'+portrait(e.partnerId)+'</div><div><h3>'+esc(e.title)+'</h3><p>与 '+esc(p.name)+' · '+esc(p.job)+'</p><button class="secondary" data-neighbor="'+e.partnerId+'">查看 '+esc(p.name)+' 的手账</button><p class="story-origin">第 '+e.source.day+' 天：'+esc(e.source.summary)+'</p></div></div>'+delivery+choices+'<details class="story-timeline"><summary>共同经历 · '+e.timeline.length+' 条</summary><ol>'+e.timeline.map(t=>'<li><small>第 '+t.day+' 天</small><p>'+esc(t.text)+'</p></li>').join('')+'</ol></details></article>';
  };
  const empty='<div class="story-empty"><h3>共同经历，会从生活里慢慢长出来。</h3><p>居民真正见面、交流进度、谈起分歧或心意之后，才会留下接下来的约定。你也可以在有分歧时分别听听他们的顾虑。</p></div>';
  openModal(esc(n.name)+' · 邻里手账','今天的相处，会成为明天的约定。',
   '<div class="resident-stories"><div class="story-heading"><b>'+current.length+' 段正在继续的经历</b><span>第 '+s.day+' 天</span></div>'+(feedback?'<p class="story-feedback" role="status">'+esc(feedback)+'</p>':'')+(current.length?current.map(card).join(''):past.length?'<p class="story-feedback">当前没有待履行的约定，已结束的经历记录在下方。</p>':empty)+(past.length?'<h3 class="story-history-title">一起走过的日子</h3>'+past.slice(0,8).map(card).join(''):'')+'</div>',
   '<button class="secondary" id="storyBack">返回居民</button><button class="primary" id="storyRefresh">查看最新进展</button>');
  $('modalRoot').querySelector('.modal').classList.add('resident-stories-modal');
  $('storyBack').onclick=()=>back(npcId);$('storyRefresh').onclick=()=>open(npcId);
  document.querySelectorAll('[data-neighbor]').forEach(button=>button.onclick=()=>open(Number(button.dataset.neighbor)));
  document.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>{
   const result=mediateResidentStory(s,button.dataset.story,npcId,button.dataset.choice,{version:Number(button.dataset.version)});
   if(result.ok)persist();open(npcId,result.ok?n.name+'：'+result.text:result.reason);
  });
 }
 return {open};
}
