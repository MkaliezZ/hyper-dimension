// Atlas rows have unequal heights. Explicit source rectangles avoid adjacent-row bleed.
const ranges={pixel:[[0,321],[324,635],[642,945],[951,1254]],origami:[[0,314],[324,628],[634,941],[950,1254]]};
export function residentPortraitMarkup(id,theme,name){
 if(!Number.isInteger(id)||id<0||id>15||!ranges[theme])return '';
 const row=Math.floor(id/4),column=id%4,[top,bottom]=ranges[theme][row],x=column*313.5+1,w=311.5;
 const label=String(name||'居民').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return '<svg class="half-portrait resident-atlas-portrait" role="img" aria-label="'+label+'的成人比例半身立绘" viewBox="'+x+' '+top+' '+w+' '+(bottom-top)+'" preserveAspectRatio="xMidYMid meet" overflow="hidden" style="overflow:hidden"><svg x="'+x+'" y="'+top+'" width="'+w+'" height="'+(bottom-top)+'" viewBox="'+x+' '+top+' '+w+' '+(bottom-top)+'" overflow="hidden"><image href="/assets/resident-portraits-'+theme+'-v6.png" width="1254" height="1254"/></svg></svg>';
}
