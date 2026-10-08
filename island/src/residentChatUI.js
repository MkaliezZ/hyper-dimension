import {worldFetch as fetch} from './worldSession.js';
import {modalNavigationToken} from './modalNavigation.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createResidentChatUI({state,theme,profile,portrait,openModal,back}){
 const drafts=new Map();
 async function request(url,body){const r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error||'暂时无法读取居民对话');return data;}
 function open(id){
  const style=theme(),worldKey=state().saveSlot||'legacy-'+style,p=profile(id),key=style+':'+worldKey+':'+id;
  openModal(esc(p.name)+' · 聊聊天',esc(p.job)+' · '+esc(p.personality),'<div class="resident-chat-layout"><aside class="resident-chat-portrait">'+portrait(id)+'<h3>'+esc(p.name)+'</h3><p>'+esc(p.lifeGoal)+'</p><span>你们的海岛来信</span></aside><section class="resident-chat-main"><div class="resident-chat-log" id="residentChatLog" role="log" aria-label="与'+esc(p.name)+'的对话" aria-live="polite"></div><p class="resident-chat-status" id="residentChatStatus" role="status">正在翻开聊天记录…</p><form id="residentChatForm" class="resident-chat-form"><label for="residentChatMessage">想和 '+esc(p.name)+' 说什么？</label><textarea id="residentChatMessage" maxlength="1200" rows="3" placeholder="聊聊近况、心情，或问问 TA 的想法…" required disabled></textarea><div><small>Enter 发送 · Shift + Enter 换行</small><button class="primary" id="residentChatSend" type="submit" disabled>发送</button></div></form></section></div>','<button class="secondary" id="residentChatBack">回居民手账</button>');
  const root=document.getElementById('residentChatForm'),nav=modalNavigationToken(),live=()=>root.isConnected&&nav.current()&&theme()===style&&(state().saveSlot||'legacy-'+style)===worldKey;
  document.querySelector('#modalRoot .modal').classList.add('resident-chat-modal');
  const log=document.getElementById('residentChatLog'),status=document.getElementById('residentChatStatus'),input=document.getElementById('residentChatMessage'),send=document.getElementById('residentChatSend'),url='/api/residents/'+style+'/'+id+'/chat';let busy=false,loaded=false;
  input.value=drafts.get(key)||'';input.oninput=()=>drafts.set(key,input.value);document.getElementById('residentChatBack').onclick=()=>back(id);
  const setBusy=value=>{busy=value;input.disabled=!loaded;send.disabled=!loaded||value;send.textContent=value?'正在回复…':'发送';};
  function paint(data){
   if(!live())return;loaded=true;const atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<80;
   log.innerHTML=data.turns.length?data.turns.map(t=>'<article class="resident-chat-turn"><div class="resident-chat-message from-player"><b>你</b><p>'+esc(t.message)+'</p></div>'+(t.status==='completed'?'<div class="resident-chat-message from-resident"><b>'+esc(p.name)+'</b><p>'+esc(t.reply)+'</p></div>':t.status==='pending'?'<div class="resident-chat-thinking"><i></i><i></i><i></i><span>'+esc(p.name)+' 正在想怎么回答</span></div>':'<div class="resident-chat-failure"><span>'+esc(t.error||'这次没有收到回复')+'</span><button class="secondary" type="button" data-retry-chat="'+esc(t.id)+'">重新发送</button></div>')+'</article>').join(''):'<div class="resident-chat-empty"><span>给海岛上的朋友，留一句话。</span><p>从今天的生活聊起，也可以分享你的想法。</p></div>';
   const waiting=data.turns.some(t=>t.status==='pending');setBusy(waiting);status.textContent=waiting?'可以先去岛上走走，回来继续看回复。':'聊天记录已保存在本机服务 · DeepSeek V4.1 Flash';
   if(atBottom||data.turns.length<=1)log.scrollTop=log.scrollHeight;
   log.querySelectorAll('[data-retry-chat]').forEach(b=>b.onclick=()=>{const turn=data.turns.find(t=>t.id===b.dataset.retryChat);if(turn&&!busy){input.value=turn.message;drafts.set(key,input.value);input.focus();}});
   if(waiting)setTimeout(()=>{if(live())void load();},1500);
  }
  async function load(){try{const data=await request(url+'?saveSlot='+encodeURIComponent(worldKey));paint(data);}catch(e){if(!live())return;setBusy(false);status.textContent=e.message;const b=document.createElement('button');b.className='secondary';b.textContent='重新读取';b.onclick=()=>void load();status.append(' ',b);}}
  root.onsubmit=async e=>{
   e.preventDefault();if(busy||!loaded||!input.value.trim())return;
   const message=input.value.trim(),body={saveSlot:worldKey,requestId:crypto.randomUUID(),message};setBusy(true);status.textContent=p.name+' 正在倾听…';
   try{const data=await request(url,body);if(drafts.get(key)?.trim()===message)drafts.delete(key);if(live()){if(input.value.trim()===message)input.value='';paint(data);log.scrollTop=log.scrollHeight;input.focus();}}
   catch(e){if(live()){setBusy(false);status.textContent=e.message+'；可重新打开对话查看已保存的结果。';}}
  };
  input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();root.requestSubmit();}};
  void load();
 }
 return {open};
}
