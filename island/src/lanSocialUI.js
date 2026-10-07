import {BUILDINGS} from './world.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {itemMarkup} from './artStore.js';
import {avatarPortrait} from './avatars.js';
import {residentPortraitMarkup} from './residentPortraits.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={friendship:'初识与生活',negotiate:'交流与合作',dispute:'不同意见',reconcile:'尝试和解'};
function style(){if(document.querySelector('#lanSocialStyle'))return;const e=document.createElement('link');e.id='lanSocialStyle';e.rel='stylesheet';e.href='/src/lan-social-v68.css';document.head.append(e);}

function guestCooperationMarkup(e,theme,me,ownerId,home){
 const c=e.cooperation;
 if(!c)return home?'<p class="lan-cooperation">与伙伴一同登岛后，可以再与这位居民商量客岛共同试作，原聘约仍保留。</p>':'<div class="lan-cooperation"><p>邀请双方在主岛的工作台共同试作。先认可材料与成品归属，伙伴的原分工和工资独立保留。</p><button class="secondary" data-cooperate="propose" data-event="'+esc(e.id)+'">提议客岛共同试作</button><p class="lan-cooperation-status" role="status"></p></div>';
 const owner=ownerId||me?.ownerAccountId;if(!me&&c.hostAccountId!==owner)return '';
 const labels={proposed:'等候参与岛主与主岛认可',agreed:'已认可，等待主岛安排',assembling:'沿道路前往各自工位',working:'客岛共同试作中',completed:'成品已进入主岛仓库',declined:'这次暂不合作',cancelled:'本次合作已停止'},required=c.requiredOwners||[],seconds=Math.max(...c.parts.map(p=>p.duration)),progress=Math.min(100,Math.round((c.elapsed||0)/seconds*100));
 return '<section class="lan-cooperation lan-guest-work"><header><small>'+esc(labels[c.status]||c.status)+'</small><span>认可 '+c.accepted.length+' / '+required.length+'</span></header><h4>'+esc(c.title)+'</h4><p>供料与成品归属：<b>'+esc(c.hostIslandName)+'</b>。友好试作不另收岛币，原聘约和工资保留。</p>'+
 c.parts.map(p=>'<div class="lan-cooperation-part">'+itemMarkup(p.item,theme,'lan-cooperation-icon')+'<div><b>'+esc(p.name)+' · '+esc(p.itemName)+' × 1</b><small>工位：'+esc(BUILDINGS[p.command.buildingId].name)+(p.contract?' · 临时伙伴原聘约保留':'')+'</small><small class="lan-cooperation-cost">材料：'+Object.entries(p.cost).map(([id,n])=>esc(ITEM_BY_ID[id]?.name||id)+' × '+n).join('、')+'</small><p>'+esc(p.proof?'已完成，主岛入库':p.taskStatus==='running'?'正在工位制作':p.taskStatus==='approaching'?'前往工位':'待安排')+'</p></div></div>').join('')+
 '<p class="lan-guest-materials">主岛共需：'+Object.entries(c.cost).map(([id,n])=>esc(ITEM_BY_ID[id]?.name||id)+' × '+n).join('、')+'</p>'+
 (['assembling','working','completed'].includes(c.status)?'<div class="lan-guest-progress" role="progressbar" aria-label="共同试作进度" aria-valuemin="0" aria-valuemax="'+seconds+'" aria-valuenow="'+Math.min(seconds,c.elapsed||0)+'"><span style="width:'+progress+'%"></span></div><small>有效协作 '+Math.floor(c.elapsed||0)+' / '+seconds+' 秒 · 双方在工位才计时</small>':'')+
 '<p>'+esc(c.reason)+'</p>'+
 (c.status==='proposed'&&required.includes(owner)?(c.accepted.includes(owner)?'<p>你已认可，等待其余岛主决定。</p>':'<button class="primary" data-cooperate="accept" data-event="'+esc(e.id)+'">认可分工与成品归属</button>')+'<button class="secondary" data-cooperate="decline" data-event="'+esc(e.id)+'">暂不合作</button>':'')+
 (c.status==='agreed'?(c.hostAccountId===owner&&!home?'<button class="primary" data-cooperate="start" data-event="'+esc(e.id)+'">预留主岛材料并安排工位</button>':'<p>由主岛在本次会客中安排工位。</p>'):'')+
 (['proposed','agreed','assembling','working'].includes(c.status)?'<button class="secondary" data-cooperate="withdraw" data-event="'+esc(e.id)+'">搁置合作 · 退回未用材料</button>':'')+
 (c.effects?.length?'<p class="lan-cooperation-earned">'+c.effects.filter(x=>x.actorId===me?.actorId).map(x=>'这次合作：好感 +'+x.affinity+' · 信任 +'+x.trust).join('')+'</p>':'')+'<p class="lan-cooperation-status" role="status"></p></section>';
}
function cooperationMarkup(e,theme,actorId,ownerId,home){
 const me=e.people.find(p=>actorId?p.actorId===actorId:p.ownerAccountId===ownerId);if(e.cooperation?.mode==='host_workshop'||e.people.some(p=>p.kind==='agent_recruited'))return guestCooperationMarkup(e,theme,me,ownerId,home);if(!me)return '';
 const c=e.cooperation;if(!c)return '<div class="lan-cooperation"><p>把这次交流变成一次可核对的共同制作。</p><button class="secondary" data-cooperate="propose" data-event="'+esc(e.id)+'">提出制作合作</button><p class="lan-cooperation-status" role="status"></p></div>';
 const part=c.parts.find(p=>p.actorId===me.actorId),labels={proposed:'等候双方认可',agreed:'已约好，准备返岛制作',working:'正在各自岛上制作',completed:'双方真实成果已核对',declined:'这次暂不合作',cancelled:'旧约定已停止'};
 return '<section class="lan-cooperation"><small>'+esc(labels[c.status])+'</small><h4>'+esc(c.title)+'</h4>'+c.parts.map(p=>'<div class="lan-cooperation-part">'+itemMarkup(p.item,theme,'lan-cooperation-icon')+'<div><b>'+esc(p.name)+' · '+esc(p.itemName)+' × 1</b><small class="lan-cooperation-cost">材料：'+Object.entries(p.cost||{}).map(([id,n])=>esc(ITEM_BY_ID[id]?.name||id)+' × '+n).join('、')+'</small><p>'+esc(p.proof?'已制作并入库':p.taskStatus?'居民任务：'+({queued:'等待开始',running:'制作中',paused:'已暂停',cancelled:'已取消',done:'等待核对'}[p.taskStatus]||p.taskStatus):'尚未安排')+'</p></div></div>').join('')+'<p>'+esc(c.reason)+'</p><p>所做成品留在自己的岛上，用于陈列、使用或经营。两份成果均由生产收据确认后，双方增加合作信任。</p>'+
 (c.status==='proposed'?(c.accepted.includes(me.ownerAccountId)?'<p>你已认可，等待对方决定。</p>':'<button class="primary" data-cooperate="accept" data-event="'+esc(e.id)+'">认可这份分工</button>')+' <button class="secondary" data-cooperate="decline" data-event="'+esc(e.id)+'">暂不合作</button>':'')+
 (['agreed','working'].includes(c.status)&&!part.proof&&!part.taskStatus?(home?'<button class="primary" data-cooperate="queue" data-event="'+esc(e.id)+'">安排本岛居民制作</button>':'<p>返岛后，在这位居民的跨岛相遇手账中安排制作。</p>'):'')+
 (['agreed','working'].includes(c.status)?'<button class="secondary" data-cooperate="withdraw" data-event="'+esc(e.id)+'">搁置这份约定</button>':'')+(c.effects?.length?'<p class="lan-cooperation-earned">'+c.effects.filter(x=>x.actorId===me.actorId).map(x=>'这次合作：好感 +'+x.affinity+' · 信任 +'+x.trust+(x.tension?' · 分歧 '+x.tension:'')).join('')+'</p>':'')+'<p class="lan-cooperation-status" role="status"></p></section>';
}
async function cooperationRequest(button,{queue,refresh}){
 const op=button.dataset.cooperate,id=button.dataset.event,root=button.closest('.lan-cooperation'),status=root.querySelector('.lan-cooperation-status'),buttons=[...root.querySelectorAll('button')];
 for(const b of buttons)b.disabled=true;status.textContent='正在核对约定…';
 try{if(op==='queue'){if(!queue)throw Error('请返回本岛安排制作');await queue(id);}
 else {const r=await fetch('/api/lan/social/cooperate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:op,eventId:id}),signal:AbortSignal.timeout(12000)}),d=await r.json();if(!r.ok)throw Error(d.error||'约定暂未确认，请重试');}
 await refresh();
 }catch(e){if(status.isConnected)status.textContent=e.message;}
 finally{for(const b of buttons)if(b.isConnected)b.disabled=false;}
}

export function socialEventsMarkup(events,theme,actorId=null,ownerId=null){
 return events.slice().reverse().map(e=>'<article class="lan-social-event"><header><small>'+esc(labels[e.type]||'相遇')+'</small><time>'+esc(new Date(e.at).toLocaleString('zh-CN'))+'</time></header><div class="lan-social-people">'+e.people.map(p=>'<div>'+(p.appearance?avatarPortrait(p.appearance,theme,'half-portrait resident-atlas-portrait avatar-half'):residentPortraitMarkup(p.npcId,theme,p.name))+'<span><b>'+esc(p.name)+'</b><small>'+esc(p.homeIslandName||'朋友的小岛')+' · '+esc(p.job)+'</small></span></div>').join('')+'</div><h4>'+esc(e.summary)+'</h4><p class="lan-social-topic">'+esc(e.contextText||'在会客小岛相遇，交流工作和生活。')+'</p><details><summary>翻看这次交流</summary>'+e.lines.map(l=>'<p><b>'+esc(e.people.find(p=>p.actorId===l.actorId)?.name)+'：</b>'+esc(l.text)+'</p>').join('')+'</details><div class="lan-social-relations">'+e.changes.filter(c=>!actorId||c.actorId===actorId).map(c=>'<p>'+esc(e.people.find(p=>p.actorId===c.actorId)?.name)+' → '+esc(e.people.find(p=>p.actorId===c.peerId)?.name)+'：<b>'+esc(c.label)+'</b><small> 好感 '+c.affinity+' · 信任 '+c.trust+' · 分歧 '+c.tension+' · 相处 '+c.interactions+' 次</small></p>').join('')+'</div>'+cooperationMarkup(e,theme,actorId,ownerId,!!actorId)+'</article>').join('');
}
export function createLanSocialUI({context}){
 style();const root=document.createElement('section');root.id='lanSocial';root.className='lan-card lan-social-panel';root.hidden=true;document.getElementById('lanRoot').after(root);
 root.addEventListener('click',e=>{const b=e.target.closest('[data-cooperate]');if(b)void cooperationRequest(b,{refresh});});
 let roomId=null,timer=null,busy=false,closed=false,last='',data=null;
 function render(){if(!roomId)return;const key=JSON.stringify(data);if(key===last)return;last=key;const t=data?.task;
 const stage=t?.status==='approaching'?'居民正在沿路碰面':t?.status==='thinking'?'他们正在聊工作与生活':t?.status==='failed'?t.error:t?.status==='cancelled'?'这次会面已结束':'小岛上的相遇会慢慢留下故事';
 root.innerHTML='<header class="lan-social-heading"><div><small>ISLAND ENCOUNTERS</small><h3>岛上的相遇</h3></div><span>'+esc(stage)+'</span></header><p>来访居民会寻找兴趣相投或需要谈清分歧的邻居。共同经历随本人档案保留，回岛后可在居民手账查看。</p>'+socialEventsMarkup(data?.events||[],context().room.theme,null,context().me.id)+(!(data?.events||[]).length?'<p class="lan-social-empty">带一位居民来走走。碰面、交谈后，这里会留下双方的故事。</p>':'');}
 async function refresh(){if(busy||closed||!roomId)return;busy=true;const id=roomId;
 try{const r=await fetch('/api/lan/social/tick',{method:'POST',headers:{'Content-Type':'application/json','X-HD-Island':context().me.id},body:'{}',signal:AbortSignal.timeout(12000)}),v=await r.json();if(!r.ok)throw Error(v.error||'相遇手账稍后重试');if(roomId!==id)return;data=v;render();}
 catch(e){if(roomId===id&&!data)root.textContent=e.message;}
 finally{busy=false}}
 return{setContext(v){const next=v?.room?.id||null;if(next===roomId)return;roomId=next;data=null;last='';clearInterval(timer);root.hidden=!next;if(next){root.textContent='正在翻开相遇手账…';void refresh();timer=setInterval(refresh,5000);}},clear(){roomId=null;data=null;clearInterval(timer);root.hidden=true;},destroy(){closed=true;clearInterval(timer);root.remove();}};
}
export async function openResidentTravelHistory({npcId,theme,openModal,back,queue,contractId=null}){
 style();openModal('跨岛相遇手账','共同经历随本人档案保存','<div id="residentTravelHistory" class="lan-social-history">正在翻开手账…</div>','<button class="secondary" id="travelHistoryRefresh">刷新相遇记录</button><button class="secondary" id="travelHistoryBack">返回伙伴档案</button>');
 document.getElementById('travelHistoryBack').onclick=back;const root=document.getElementById('residentTravelHistory');
 async function refresh(){try{const r=await fetch('/api/lan/social/history/'+npcId+'?theme='+theme+(contractId?'&contractId='+encodeURIComponent(contractId):''),{cache:'no-store',signal:AbortSignal.timeout(12000)}),d=await r.json();if(!r.ok)throw Error(d.error||'相遇手账暂不可用');if(root.isConnected)root.innerHTML=socialEventsMarkup(d.events,theme,d.actorId)||'<p>还没有跨岛共同经历。下次邀请这位居民随行，去认识其他岛的邻居。</p>';}
 catch(e){if(root.isConnected)root.textContent=e.message;}}
 document.getElementById('travelHistoryRefresh').onclick=refresh;root.onclick=e=>{const b=e.target.closest('[data-cooperate]');if(b)void cooperationRequest(b,{queue,refresh});};await refresh();
}
