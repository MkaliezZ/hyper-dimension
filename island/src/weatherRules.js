// Shared deterministic weather: both renderers and server actions sample the same visual day.
export const WEATHER=Object.freeze({
 clear:Object.freeze({id:'clear',name:'晴',watersCrops:false,fishingAssist:0}),
 cloudy:Object.freeze({id:'cloudy',name:'多云',watersCrops:false,fishingAssist:0}),
 rain:Object.freeze({id:'rain',name:'雨',watersCrops:true,fishingAssist:1}),
 snow:Object.freeze({id:'snow',name:'雪',watersCrops:false,fishingAssist:0})
});
function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;return (n>>>0)/4294967296;}
export function weatherForEnvironment(e){
 const day=Math.floor(e.cycles),r=hash(e.clockId+':weather-v1:'+day),season=e.season;
 const id=season==='winter'?(r<.38?'snow':r<.64?'cloudy':'clear'):
  r<({spring:.35,summer:.30,autumn:.22}[season]??.3)?'rain':r<.58?'cloudy':'clear';
 return {...WEATHER[id],visualDay:day};
}
export function fishingWeather(weather){return weather?.id==='rain'?{id:'rain',assist:1}:{id:WEATHER[weather?.id]?weather.id:'clear',assist:0};}
export function validFishingWeather(w){return w===undefined||!!w&&Object.keys(w).length===2&&!!WEATHER[w.id]&&w.assist===(w.id==='rain'?1:0);}
