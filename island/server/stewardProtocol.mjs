// Bounded, plain conversation only. Tool/system messages from a client are never forwarded.
export function cleanStewardHistory(value){
 if(!Array.isArray(value))return [];
 return value.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.trim()).slice(-12).map(m=>({role:m.role,content:m.content.trim().slice(0,1400)}));
}
export function cleanJourneyBrief(value){
 if(!value||typeof value!=='object')return null;
 const str=(v,n)=>String(v??'').slice(0,n);
 const g=value.growth;const growth=g&&['garden','artisan','host'].includes(g.path)?{path:g.path,name:str(g.name,30),rank:Math.max(0,Math.min(5,Number(g.rank)||0)),next:(Array.isArray(g.next)?g.next:[]).slice(0,2).map(x=>str(x,90)),commission:g.commission?{item:str(g.commission.item,30),quality:Math.max(0,Math.min(100,Number(g.commission.quality)||0)),status:['accepted','delivered'].includes(g.commission.status)?g.commission.status:null}:null}:null;
 return {growth,step:str(value.step,50),guidance:str(value.guidance,200),ready:str(value.ready,50),earned:Array.isArray(value.earned)?value.earned.slice(0,4).map(x=>str(x,30)):[]};
}

