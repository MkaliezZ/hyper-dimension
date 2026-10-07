import {itemMarkup} from './artStore.js';
const motifs={
 role:'<path class="icon-main" d="M8 11h8l4 10H4z"/><path class="icon-light" d="M9 3h6v6H9z"/><path d="M9 14v4m6-4v4"/>',
 steward:'<path class="icon-main" d="M7 11h10l3 10H4z"/><path class="icon-light" d="M9 3h6v6H9z"/><path class="icon-paper" d="m9 11 3 7 3-7"/><path class="icon-gold" d="m18 3 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',
 residents:'<path class="icon-main" d="M3 15h8l2 6H1z"/><path class="icon-fold" d="M13 13h8l2 8H11z"/><path class="icon-light" d="M4 7h6v6H4zm10-2h6v6h-6z"/>',
 gather:'<path class="icon-main" d="M3 13 9 3l6 10z"/><path class="icon-fold" d="m10 17 6-10 6 10z"/><path class="icon-wood" d="M8 13h3v8H8zm7 4h3v4h-3z"/>',
 recipes:'<path class="icon-paper" d="M2 4h8l2 2 2-2h8v16h-8l-2 2-2-2H2z"/><path d="M12 7v12M5 8h4m-4 4h4m6-4h4m-4 4h4"/><path class="icon-main" d="M16 4h3v6l-1.5-1-1.5 1z"/>',
 business:'<path class="icon-main" d="m8 3 4 2 4-2-1 5 5 5v7H4v-7l5-5z"/><path class="icon-gold" d="M9 11h6v7H9z"/><path d="M9 8h6m-3 4v5"/>',
 admin:'<path class="icon-wood" d="M4 3h16v19H4z"/><path class="icon-paper" d="M7 6h10v13H7z"/><path class="icon-main" d="M8 1h8v5H8z"/><path d="M9 10h6m-6 4h6"/>',
 help:'<path class="icon-main" d="m7 2 10 0 5 5v10l-5 5H7l-5-5V7z"/><path class="icon-paper" d="m9 7 6 0 2 2v6l-2 2H9l-2-2V9z"/><path d="m7 2 2 5m8-5-2 5m7 10-5-2M7 22l2-5"/>',
 bag:'<path class="icon-wood" d="M4 8h16v13H4z"/><path class="icon-paper" d="M8 3h8v5H8z"/><path class="icon-main" d="M4 8h16v6H4z"/><path class="icon-gold" d="M10 12h4v5h-4z"/>',
 build:'<path class="icon-main" d="m2 11 10-9 10 9z"/><path class="icon-paper" d="M5 11h14v11H5z"/><path class="icon-wood" d="M10 15h4v7h-4z"/><path d="M7 14h1m8 0h1"/>',
 hammer:'<path class="icon-wood" d="m8 10 3-3 10 10-3 3z"/><path class="icon-main" d="m2 9 7-7 5 5-7 7z"/><path class="icon-light" d="m2 9 2-2 5 5-2 2z"/>',
 pixel:'<path class="icon-paper" d="M2 2h20v20H2z"/><path class="icon-gold" d="M5 5h4v4H5z"/><path class="icon-main" d="M3 16h4v-4h4v-4h4v4h3v4h3v5H3z"/><path class="icon-fold" d="M13 17h8v4h-8z"/>',
 origami:'<path class="icon-paper" d="m2 12 8-9 3 6 9-1-9 13-3-7z"/><path class="icon-main" d="m2 12 11-3-3 5z"/><path class="icon-fold" d="m13 9 9-1-9 13z"/><path d="m10 3 3 6-3 5"/>',
 island:'<path class="icon-gold" d="m3 17 9-4 9 4-9 5z"/><path class="icon-main" d="m4 14 8-4 8 4-8 4z"/><path class="icon-wood" d="M11 6h2v7h-2z"/><path class="icon-fold" d="m12 7-7-2 4-3 3 2 3-2 4 3z"/>'
};
export function uiIcon(name){
 return '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(motifs[name]||motifs.island)+'</svg>';
}
export function hudArtUrl(name,theme='origami'){return '/assets/ui-hud-v59/'+(theme==='pixel'?'pixel':'origami')+'-'+name+'.png';}
export function hudIllustration(name,theme='origami'){return '<img class="ui-icon hud-art-icon" src="'+hudArtUrl(name,theme)+'" width="128" height="128" alt="" aria-hidden="true" draggable="false">';}
export function applyHUDArt(theme){
 for(const [id,icon,label] of [['playerBtn','role','角色'],['stewardBtn','steward','管家'],['residentsBtn','residents','居民'],['gatherBtn','gather','采集'],['recipesBtn','recipes','配方'],['businessBtn','business','经营'],['adminBtn','admin','后台'],['helpBtn','help','？'],['bagBtn','bag','背包'],['buildBtn','build','建造']]){
  document.getElementById(id).innerHTML=hudIllustration(icon,theme)+'<span>'+label+'</span>';
 }
 document.getElementById('partyBtn').innerHTML='<span class="ui-item-art" aria-hidden="true">'+itemMarkup('firework',theme,'inline-icon')+'</span><span>派对</span>';
 const places={forest:['axe','林地'],farm:['hoe','农田'],mine:['pickaxe','矿洞'],plaza:['lantern','广场'],workshop:[null,'工坊']};
 document.querySelectorAll('[data-go]').forEach(el=>{const [item,label]=places[el.dataset.go];el.innerHTML=(item?'<span class="ui-item-art" aria-hidden="true">'+itemMarkup(item,theme,'inline-icon')+'</span>':hudIllustration('workshop',theme))+'<span>'+label+'</span>'});
 for(const [id,icon,label] of [['themePixel','pixel','像素'],['themeOrigami','origami','折纸']])document.getElementById(id).innerHTML=hudIllustration(icon,theme)+'<span>'+label+'</span>';
 document.querySelector('.brand-mark').innerHTML=uiIcon('island');
}
