// Layout preference is private and does not mutate game progress or settlement.
export function installJournalFold({document=globalThis.document,storage=globalThis.localStorage}={}){
 const panel=document.querySelector('.quest-panel'),toggle=document.getElementById('questToggle');if(!panel||!toggle)return;
 const key='hyper-dimension-ui-journal-folded';let initial=false;try{initial=storage.getItem(key)==='1'}catch{}
 function apply(folded){panel.classList.toggle('folded',folded);for(const id of ['questList']){const el=document.getElementById(id);if(el)el.hidden=folded;}const footer=panel.querySelector('.side-footer');if(footer)footer.hidden=folded;toggle.textContent=folded?'+':'−';toggle.setAttribute('aria-expanded',String(!folded));toggle.setAttribute('aria-controls','questList');toggle.setAttribute('aria-label',folded?'展开岛屿手账':'收起岛屿手账');toggle.title=folded?'展开岛屿手账':'收起岛屿手账';}
 apply(initial);toggle.onclick=e=>{e.preventDefault();e.stopPropagation();const folded=!panel.classList.contains('folded');apply(folded);try{storage.setItem(key,folded?'1':'0')}catch{}};
 return {folded:()=>panel.classList.contains('folded')};
}
