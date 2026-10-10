import {itemMarkup} from './artStore.js';
import {availableQuantity} from './resourceLedger.js';
import {cropInfo,soilCharges,harvestAmount,canFertilize,SOIL_CARE} from './farming.js';
export function createFarmCareUI({state,theme,scene,busy,modalOpen,openModal,closeModal,goFarm,begin,detail}){
 const button=document.createElement('button');button.id='farmCareBtn';button.className='farm-care-trigger hud-panel';button.type='button';button.hidden=true;document.getElementById('app').append(button);
 const stage=p=>['待松土','待播种','待浇水','正在生长','等待收获'][p.stage];
 let markupKey='';
 function paint(){button.hidden=scene()!=='farm'||modalOpen();if(button.hidden)return;button.disabled=busy();const count=availableQuantity(state(),SOIL_CARE.item),key=theme()+':'+count;if(key!==markupKey){markupKey=key;button.innerHTML=itemMarkup(SOIL_CARE.item,theme(),'farm-care-icon')+'<span><b>养土与施肥</b><small>可用肥料 '+count+' 袋</small></span>';}}
 function open(){if(busy())return;goFarm();const s=state(),available=availableQuantity(s,SOIL_CARE.item);openModal('田间养土','一袋肥料 · 一块田 · 三次有限增产',
 '<div class="farm-care-intro">'+itemMarkup(SOIL_CARE.item,theme(),'farm-care-icon')+'<p>选一块已播种的田垄，角色会到田边撒肥。未来三次收获各多一份作物，养分随收获消耗；成熟时间不变。</p></div><p class="hint">可用 '+available+' 袋，预留给其他作业的肥料不会取用。播种、浇水和收获仍需正常完成。</p><div class="farm-care-grid">'+s.plots.map((p,i)=>'<button class="farm-care-plot secondary" data-farm-care="'+i+'" '+(!canFertilize(p)||available<1?'disabled':'')+'><strong>田垄 '+(i+1)+'</strong>'+itemMarkup(p.stage>1?p.crop:'c14_8',theme(),'farm-care-icon')+'<b>'+cropInfo(p).name+' · '+stage(p)+'</b><span>养分 '+soilCharges(p)+' / '+SOIL_CARE.charges+' 次 · 本次收获 '+harvestAmount(p)+' 份</span></button>').join('')+'</div>',
 '<button id="farmCareRecipe" class="secondary">查看肥料制作</button><button id="farmCareBack" class="primary">继续照料农田</button>');
 document.querySelector('#modalRoot .modal').classList.add('farm-care-modal');
 document.getElementById('farmCareRecipe').onclick=()=>detail(SOIL_CARE.item);document.getElementById('farmCareBack').onclick=closeModal;
 document.querySelectorAll('[data-farm-care]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.farmCare);if(busy()||!canFertilize(state().plots[i])||availableQuantity(state(),SOIL_CARE.item)<1)return;closeModal();begin(i);});
 }
 button.onclick=open;return {paint,open};
}
