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
   const p=profile(e.partnerId),delivery=e.stage==='work'?
    '<div class="story-delivery">'+itemArt(e.plan.resource)+'<div><b>'+esc(ITEM_BY_ID[e.plan.resource].name)+' · '+e.progress+' / 2 人完成</b>'+e.people.map(id=>'<span>'+esc(profile(id).name)+'：'+(e.contributions[id]?'已实际入库 '+e.contributions[id].amount+' 份':'仍在准备')+'</span>').join('')+'</div></div>':'';
   const stage=e.status==='resolved'?'共同经历已完成':e.status==='closed'?'尊重界限，暂时搁置':s.day<e.dueDay?'第 '+e.dueDay+' 天再相聚':e.status==='meeting'?'正在赴约交谈':e.stage==='work'?'分别备料，完成后核对':'今天在'+BUILDINGS[e.venue].name+'见面';
   const choices=e.canMediate?'<div class="story-dialogue"><blockquote>“我们还有没说清的顾虑。先听完，再决定怎样一起做事。”</blockquote><p>分别找两位居民聊聊，听取各自的顾虑，可以让他们愿意一起参加活动；约好的后续见面仍会继续。</p><div><button class="primary" data-story="'+e.id+'" data-version="'+e.version+'" data-choice="listen">我愿意听完，再说清分工</button><button class="secondary" data-story="'+e.id+'" data-version="'+e.version+'" data-choice="space">先给彼此一点空间</button></div></div>':e.mediation[npcId]?'<blockquote class="story-response">“'+esc(e.mediation[npcId].text)+'”</blockquote>':'';
   return '<article class="resident-story-card '+esc(e.kind)+'" data-story-id="'+esc(e.id)+'"><header><small>'+labels[e.kind]+'</small><span>'+esc(stage)+'</span></header><div class="story-people"><div class="story-partner-art">'+portrait(e.partnerId)+'</div><div><h3>'+esc(e.title)+'</h3><p>与 '+esc(p.name)+' · '+esc(p.job)+'</p><button class="secondary" data-neighbor="'+e.partnerId+'">查看 '+esc(p.name)+' 的手账</button><p class="story-origin">第 '+e.source.day+' 天：'+esc(e.source.summary)+'</p></div></div>'+delivery+choices+'<details class="story-timeline"><summary>共同经历 · '+e.timeline.length+' 条</summary><ol>'+e.timeline.map(t=>'<li><small>第 '+t.day+' 天</small><p>'+esc(t.text)+'</p></li>').join('')+'</ol></details></article>';
  };
  const empty='<div class="story-empty"><h3>共同经历，会从生活里慢慢长出来。</h3><p>居民真正见面、交流进度、谈起分歧或心意之后，才会留下接下来的约定。你也可以在有分歧时分别听听他们的顾虑。</p></div>';
  openModal(esc(n.name)+' · 邻里手账','今天的相处，会成为明天的约定。',
   '<div class="resident-stories"><div class="story-heading"><b>'+current.length+' 段正在继续的经历</b><span>第 '+s.day+' 天</span></div>'+(feedback?'<p class="story-feedback" role="status">'+esc(feedback)+'</p>':'')+(current.length?current.map(card).join(''):empty)+(past.length?'<h3 class="story-history-title">一起走过的日子</h3>'+past.slice(0,8).map(card).join(''):'')+'</div>',
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
