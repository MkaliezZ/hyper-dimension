import {homeForResident} from './islandGeography.js';
// Fixed world-clock shifts. Free-time appointments vary once per visual day, never per frame.
const shifts=[
 [6,15,21.5,5.5,14],[8,17,22,6.5,0],[10,19,23,7.5,21],
 [13,21,23.5,8,5],[7,16,22,6,3],[7,16,22,6,23],
 [5.5,14.5,21,5,17],[9,18,22.5,7,13],[5,13,21,4.5,16],
 [8,17,22,6.5,10],[8.5,17.5,22.5,7,11],[7,16,21.5,6,0],
 [11,20,23.5,8,12],[9,18,23,7,4],[9,18,22.5,7,18],[8,18,23,6.5,11]
];
export const RESIDENT_SHIFTS=Object.freeze(shifts.map(([start,end,sleep,wake,buildingId],id)=>Object.freeze({id,start,end,sleep,wake,buildingId})));
const mod=(n,m)=>((n%m)+m)%m;
function dailyChoice(day,id){let value=((day+1)*2654435761+(id+3)*2246822519)>>>0;value^=value>>>16;value=Math.imul(value,3266489917)>>>0;return (value>>>0)/4294967296;}
export function residentSchedule(id,environment){
 const shift=RESIDENT_SHIFTS[id];if(!shift||!Number.isFinite(environment?.hour))return null;
 const hour=mod(environment.hour,24),day=Math.floor(Number.isFinite(environment.cycles)?environment.cycles:0),sleeping=hour>=shift.sleep||hour<shift.wake,working=hour>=shift.start&&hour<shift.end;
 const eventStart=shift.end+.25+dailyChoice(day,id)*Math.max(0,shift.sleep-shift.end-2.25),eventEnd=Math.min(shift.sleep-.25,eventStart+1.5);
 return {...shift,day,hour,home:homeForResident(id),period:sleeping?'sleep':working?'work':'leisure',sleeping,working,eventStart,eventEnd,eventActive:!sleeping&&!working&&hour>=eventStart&&hour<eventEnd};
}
export function scheduledOptions(options,schedule,fallback=[]){
 if(!schedule)return options;if(schedule.sleeping)return [];
 const urgent=options.filter(o=>o.purposeId?.startsWith('need:')||o.facilityId);
 const rows=schedule.working?options.filter(o=>o.action==='work'||o.purposeId?.startsWith('need:')||o.facilityId):options.filter(o=>o.action!=='work'&&(o.action!=='social'||schedule.eventActive));
 return rows.length?rows:urgent.length?urgent:fallback;
}
export function scheduleText(schedule){
 if(!schedule)return '';
 const clock=n=>String(Math.floor(n)).padStart(2,'0')+':'+String(Math.round(n%1*60)).padStart(2,'0');
 return schedule.sleeping?'回'+schedule.home.name+'休息 · '+clock(schedule.wake)+'起床':schedule.working?'固定工作时段 '+clock(schedule.start)+'–'+clock(schedule.end):schedule.eventActive?'自由相遇时段 · 工作之外认识邻居':'下班后的个人生活';
}
