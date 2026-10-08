export const ENVIRONMENT_PROTOCOL=1;
export const SEASONS=Object.freeze(['spring','summer','autumn','winter']);
export const SEASON_NAMES=Object.freeze({spring:'春',summer:'夏',autumn:'秋',winter:'冬'});
export const DEFAULT_CLOCK=Object.freeze({schema:1,clockId:'local-preview',revision:1,epochMs:0,dayLengthMs:900000,seasonDays:30,phaseAtEpoch:10.5/24,seasonOffset:0,rate:1,source:'local'});
export function validEnvironmentClock(c){return !!c&&c.schema===1&&typeof c.clockId==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(c.clockId)&&Number.isSafeInteger(c.revision)&&c.revision>0&&Number.isFinite(c.epochMs)&&c.epochMs>=0&&c.epochMs<=1e15&&Number.isFinite(c.dayLengthMs)&&c.dayLengthMs>=60000&&c.dayLengthMs<=604800000&&Number.isInteger(c.seasonDays)&&c.seasonDays>=1&&c.seasonDays<=90&&Number.isFinite(c.phaseAtEpoch)&&c.phaseAtEpoch>=0&&c.phaseAtEpoch<1&&Number.isInteger(c.seasonOffset)&&c.seasonOffset>=0&&c.seasonOffset<4*c.seasonDays&&Number.isFinite(c.rate)&&c.rate>=.1&&c.rate<=16&&['local','central'].includes(c.source);}
export function copyEnvironmentClock(c){if(!validEnvironmentClock(c))throw Error('invalid_environment_clock');return Object.fromEntries(Object.keys(DEFAULT_CLOCK).map(k=>[k,c[k]]));}
const mod=(n,m)=>((n%m)+m)%m,clamp=n=>Math.max(0,Math.min(1,n));
export function environmentAt(c,serverNowMs){
 if(!validEnvironmentClock(c)||!Number.isFinite(serverNowMs))throw Error('invalid_environment_time');
 const cycles=(serverNowMs-c.epochMs)*c.rate/c.dayLengthMs+c.phaseAtEpoch,phase=mod(cycles,1),hour=phase*24,seasonCycle=(cycles+c.seasonOffset)/c.seasonDays,season=SEASONS[Math.floor(mod(seasonCycle,4))];
 const daylight=clamp((Math.sin((phase-.25)*Math.PI*2)+.16)/.65),night=1-daylight,dawn=Math.exp(-Math.pow((hour-6.1)/1.2,2)),dusk=Math.exp(-Math.pow((hour-18.1)/1.4,2));
 const minutes=Math.floor(hour*60+1e-7)%1440;
 const period=hour<5||hour>=20?'night':hour<8?'dawn':hour<17?'day':'dusk';
 return {schema:1,clockId:c.clockId,revision:c.revision,source:c.source,cycles,phase,hour,period,season,seasonName:SEASON_NAMES[season],seasonProgress:mod(seasonCycle,1),daylight,night,dawn,dusk,clockText:String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0'),dayLengthMs:c.dayLengthMs,seasonDays:c.seasonDays,rate:c.rate};
}
