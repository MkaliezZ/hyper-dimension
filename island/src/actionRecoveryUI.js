// One owner for interaction locks: independent recovery panels must never make each other inert.
const active=new Set(),contexts=new Map(),original=new Map();let observer=null,dock=null,recoveryDialog=false,queued=false,recoverAll=null;
function remember(el,value){if(!original.has(el))original.set(el,el.inert);el.inert=value;}
function restore(){for(const[el,value]of original)if(el.isConnected)el.inert=value;original.clear();}
function sync(){
 restore();if(dock){dock.hidden=!active.size;const work=[...active].map(bar=>contexts.get(bar));const pending=work.length&&work.every(c=>c?.canRecover===false),context=pending?work[0]:null;const title=dock.querySelector('.recovery-all strong'),message=dock.querySelector('.recovery-all p'),button=dock.querySelector('#recoveryAll');const t=context?.title||'恢复小岛进度',m=context?.message||'先核对已提交结果，再继续游玩。当前暂存会保留副本。';if(title.textContent!==t)title.textContent=t;if(message.textContent!==m)message.textContent=m;button.hidden=!!pending;}if(!active.size){observer?.disconnect();observer=null;return;}
 const allowed=[dock,document.getElementById('saveStatus'),document.getElementById('questToggle'),document.getElementById('businessToggle'),...(recoveryDialog?[document.getElementById('modalRoot')]:[])].filter(Boolean);
 function visit(el){if(['SCRIPT','STYLE','LINK'].includes(el.tagName))return;if(allowed.includes(el)){remember(el,false);return;}if(allowed.some(a=>el.contains(a))){remember(el,false);for(const child of el.children)visit(child);}else remember(el,true);}
 for(const el of document.body.children)visit(el);
}
function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});}
export function lockActionUI(bar,context=null){
 if(!dock){dock=document.createElement('div');dock.id='actionRecoveryDock';dock.setAttribute('aria-label','待确认操作');const header=document.createElement('div');header.className='recovery-all';header.innerHTML='<div><strong>恢复小岛进度</strong><p>先核对已提交结果，再继续游玩。当前暂存会保留副本。</p></div><button class="primary" id="recoveryAll">核对全部并继续</button>';dock.append(header);header.querySelector('button').onclick=()=>readRecoveryProgress(header,()=>recoverAll?.());document.body.append(dock);}
 active.add(bar);contexts.set(bar,context);if(bar.parentElement!==dock)dock.append(bar);
 // Recovery must remain available even without a pending command or conflict status.
 if(!bar.querySelector('[data-recovery-read]')){
  const button=document.createElement('button');button.type='button';button.className='secondary recovery-read';button.dataset.recoveryRead='true';button.textContent='核对进度并收起提示';
  button.onclick=()=>readRecoveryProgress(bar,()=>{if(!recoverAll)throw Error('进度恢复尚未就绪，请刷新后重试');return recoverAll();});
  (bar.querySelector('.gather-buttons')||bar).append(button);
 }
 if(!observer){observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});}
 sync();
}
export function unlockActionUI(bar){active.delete(bar);contexts.delete(bar);sync();}
// A scene overlay and recovery can overlap. Update the saved base value so
// releasing recovery cannot restore an already-closed overlay's stale inert flag.
export function setBaseUIInert(el,value){if(!el)return;if(original.has(el))original.set(el,!!value);el.inert=!!value;sync();}
export function setRecoveryDialog(value){recoveryDialog=!!value;document.body.classList.toggle('recovery-dialog-open',recoveryDialog);sync();}

export function isRecoveryTarget(target){return target instanceof Element&&!!target.closest('#actionRecoveryDock,#saveStatus,#questToggle,#businessToggle'+(recoveryDialog?',#modalRoot':''));}
let reading=false;
export async function readRecoveryProgress(bar,read,toast){
 if(reading)return;reading=true;
 const buttons=[...(dock?.querySelectorAll('button')||[])].map(button=>[button,button.disabled]);
 const main=dock?.querySelector('#recoveryAll'),label=main?.textContent;
 if(main)main.textContent='正在核对，请稍候…';dock?.setAttribute('aria-busy','true');
 for(const[button]of buttons)button.disabled=true;
 try{await read();}catch(error){const text=error.message||'暂时无法读取进度，记录已保留，请重试';const p=bar.querySelector('p');if(p)p.textContent=text;toast?.(text);}
 finally{reading=false;dock?.removeAttribute('aria-busy');if(main)main.textContent=label;for(const[button,disabled]of buttons)if(button.isConnected)button.disabled=disabled;}
}

export function configureActionRecovery(fn){recoverAll=fn;}

// A rejected autosave may pause movement without any operation-specific card.
// Always expose the same receipt-preserving recovery path in that case.
let saveRecoveryBar=null;
export function reflectSaveRecovery(status){
 const blocked=['conflict','action_pending','import_pending','blocked'].includes(status.status);
 if(!blocked){if(status.status==='recovering')return;if(saveRecoveryBar){unlockActionUI(saveRecoveryBar);saveRecoveryBar.remove();saveRecoveryBar=null;}return;}
 if(!saveRecoveryBar){saveRecoveryBar=document.createElement('section');saveRecoveryBar.id='saveRecoveryPrompt';saveRecoveryBar.className='gather-v46 recovery-text';saveRecoveryBar.innerHTML='<div><strong>小岛进度需要核对</strong><p role="status"></p></div><div class="gather-buttons"><button class="secondary" data-save-recovery-details>查看存档与恢复选项</button></div>';saveRecoveryBar.querySelector('[data-save-recovery-details]').onclick=()=>document.getElementById('saveStatus')?.click();}
 saveRecoveryBar.querySelector('p').textContent=status.message+'。核对后即可恢复移动和进入房屋，当前暂存会保留副本。';
 lockActionUI(saveRecoveryBar);
}
