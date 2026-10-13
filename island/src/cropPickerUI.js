import {CROPS,cropTime} from './farming.js';
import {canPlantCrop,cropSeasonLabel} from './cropSeasons.js';
export function cropPickerMarkup(environment,icon){
 const crops=Object.entries(CROPS).sort(([a],[b])=>Number(canPlantCrop(b,environment.season))-Number(canPlantCrop(a,environment.season)));
 return '<p class="hint">'+environment.seasonName+'季 · '+environment.weather.name+'。'+(environment.weather.watersCrops?'雨水会在下一次有效游戏进度保存时浇透露天田垄，无需另取水。':'播种后需要浇水。')+'换季不会破坏已种下的作物；通用种子每块田消耗 1 份。</p><div class="crop-picker">'+crops.map(([id,c])=>'<button class="crop-choice" data-crop="'+id+'" '+(!canPlantCrop(id,environment.season)?'disabled':'')+'>'+icon(id)+'<b>'+c.name+'</b><small>'+cropTime(c.seconds)+' · 收获 ×'+c.yield+'</small><small>'+cropSeasonLabel(id)+(canPlantCrop(id,environment.season)?' · 可播种':' · 等待适种季节')+'</small></button>').join('')+'</div>';
}
